import { OrderStatus, ProductStatus } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";

const REVENUE_STATUSES: OrderStatus[] = [
  OrderStatus.PAID,
  OrderStatus.SHIPPED,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
];

export async function getAdminOverview() {
  const [
    orderCount,
    revenueAgg,
    ordersByStatus,
    lowStock,
    productCount,
    recentOrders,
    topSelling,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.aggregate({
      where: { status: { in: REVENUE_STATUSES } },
      _sum: { total: true },
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.product.findMany({
      where: {
        status: { not: ProductStatus.DISCONTINUED },
        stock: { lte: env.LOW_STOCK_THRESHOLD, gt: 0 },
      },
      orderBy: { stock: "asc" },
      take: 20,
      select: {
        publicId: true,
        name: true,
        sku: true,
        stock: true,
        mainImageUrl: true,
        status: true,
      },
    }),
    prisma.product.count({
      where: { status: { not: ProductStatus.DISCONTINUED } },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: { select: { email: true } },
        items: true,
      },
    }),
    topSellingProducts(),
  ]);

  const totalRevenue = revenueAgg._sum.total ? Number(revenueAgg._sum.total) : 0;

  const statusCounts: Record<string, number> = {};
  for (const row of ordersByStatus) {
    statusCounts[row.status] = row._count._all;
  }

  return {
    orderCount,
    productCount,
    totalRevenue: totalRevenue.toFixed(2),
    ordersByStatus: statusCounts,
    lowStock,
    lowStockThreshold: env.LOW_STOCK_THRESHOLD,
    recentOrders: recentOrders.map((o) => ({
      publicId: o.publicId,
      status: o.status,
      total: Number(o.total).toFixed(2),
      paymentStatus: o.paymentStatus,
      userEmail: o.user.email,
      createdAt: o.createdAt,
      itemCount: o.items.length,
    })),
    topSellingProducts: topSelling,
  };
}

async function topSellingProducts() {
  const rows = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      order: {
        status: {
          in: [
            OrderStatus.PAID,
            OrderStatus.SHIPPED,
            OrderStatus.OUT_FOR_DELIVERY,
            OrderStatus.DELIVERED,
            OrderStatus.COMPLETED,
          ],
        },
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 10,
  });
  if (rows.length === 0) {
    return [];
  }
  const ids = rows.map((r) => r.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, publicId: true, name: true, sku: true, mainImageUrl: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  return rows.map((r) => {
    const p = byId.get(r.productId);
    return {
      productPublicId: p?.publicId ?? r.productId,
      name: p?.name ?? "Unknown",
      sku: p?.sku ?? "",
      quantitySold: r._sum.quantity ?? 0,
      mainImageUrl: p?.mainImageUrl ?? null,
    };
  });
}
