import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { newPublicId } from "../../utils/ids.js";

export type DiscountType = "percent" | "fixed";

/** Pure discount math — no DB access, safe to unit test directly. */
export function computeDiscount(
  discountType: DiscountType,
  discountValue: number,
  subtotal: number,
  maxDiscount?: number | null
): number {
  if (subtotal <= 0) {
    return 0;
  }
  if (discountType === "percent") {
    let discount = (subtotal * discountValue) / 100;
    if (maxDiscount != null) {
      discount = Math.min(discount, maxDiscount);
    }
    return Math.min(discount, subtotal);
  }
  // fixed
  return Math.min(discountValue, subtotal);
}

export async function validateCoupon(code: string, userId: string, subtotal: number) {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.trim() } });
  if (!coupon) {
    throw new AppError(404, "Coupon not found", "COUPON_NOT_FOUND");
  }
  if (!coupon.isActive) {
    throw new AppError(400, "This coupon is no longer active", "COUPON_INACTIVE");
  }
  const now = new Date();
  if (coupon.startsAt && now < coupon.startsAt) {
    throw new AppError(400, "This coupon is not active yet", "COUPON_NOT_STARTED");
  }
  if (coupon.endsAt && now > coupon.endsAt) {
    throw new AppError(400, "Coupon expired", "COUPON_EXPIRED");
  }
  if (coupon.minSubtotal != null && subtotal < Number(coupon.minSubtotal)) {
    throw new AppError(
      400,
      `Minimum order of ${Number(coupon.minSubtotal).toFixed(2)} not met`,
      "COUPON_MIN_SUBTOTAL"
    );
  }
  if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
    throw new AppError(400, "Coupon usage limit reached", "COUPON_LIMIT_REACHED");
  }
  if (coupon.perUserLimit != null) {
    const userRedemptions = await prisma.couponRedemption.count({
      where: { couponId: coupon.id, userId },
    });
    if (userRedemptions >= coupon.perUserLimit) {
      throw new AppError(
        400,
        "You've already used this coupon the maximum number of times",
        "COUPON_PER_USER_LIMIT"
      );
    }
  }

  const discount = computeDiscount(
    coupon.discountType as DiscountType,
    Number(coupon.discountValue),
    subtotal,
    coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null
  );

  return {
    couponId: coupon.id,
    publicId: coupon.publicId,
    code: coupon.code,
    discountType: coupon.discountType as DiscountType,
    discount: Number(discount.toFixed(2)),
  };
}

/**
 * Records a coupon use and atomically bumps usageCount. Pass the active
 * transaction client (`tx`) when calling from inside another `$transaction`
 * (e.g. order creation) so the redemption commits with the order or not at
 * all; defaults to the top-level `prisma` client for standalone use.
 */
export async function recordCouponRedemption(
  couponId: string,
  userId: string,
  orderId: string,
  amount: number,
  client: Prisma.TransactionClient | typeof prisma = prisma
) {
  await client.couponRedemption.create({ data: { couponId, userId, orderId, amount } });
  await client.coupon.update({
    where: { id: couponId },
    data: { usageCount: { increment: 1 } },
  });
}

export type CouponAdminInput = {
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  minSubtotal?: number;
  maxDiscount?: number;
  usageLimit?: number;
  perUserLimit?: number;
  isActive?: boolean;
  startsAt?: Date;
  endsAt?: Date;
};

export async function listCouponsAdmin() {
  return prisma.coupon.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createCouponAdmin(data: CouponAdminInput) {
  const existing = await prisma.coupon.findUnique({ where: { code: data.code.trim() } });
  if (existing) {
    throw new AppError(400, "Coupon code already exists", "COUPON_CODE_TAKEN");
  }
  return prisma.coupon.create({
    data: {
      publicId: newPublicId("cpn"),
      code: data.code.trim(),
      description: data.description,
      discountType: data.discountType,
      discountValue: data.discountValue,
      minSubtotal: data.minSubtotal,
      maxDiscount: data.maxDiscount,
      usageLimit: data.usageLimit,
      perUserLimit: data.perUserLimit,
      isActive: data.isActive ?? true,
      startsAt: data.startsAt,
      endsAt: data.endsAt,
    },
  });
}

export async function updateCouponAdmin(publicId: string, data: Partial<CouponAdminInput>) {
  const existing = await prisma.coupon.findUnique({ where: { publicId } });
  if (!existing) {
    throw new AppError(404, "Coupon not found", "NOT_FOUND");
  }
  if (data.code && data.code.trim() !== existing.code) {
    const clash = await prisma.coupon.findUnique({ where: { code: data.code.trim() } });
    if (clash) {
      throw new AppError(400, "Coupon code already exists", "COUPON_CODE_TAKEN");
    }
  }
  return prisma.coupon.update({
    where: { publicId },
    data: {
      ...(data.code !== undefined && { code: data.code.trim() }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.discountType !== undefined && { discountType: data.discountType }),
      ...(data.discountValue !== undefined && { discountValue: data.discountValue }),
      ...(data.minSubtotal !== undefined && { minSubtotal: data.minSubtotal }),
      ...(data.maxDiscount !== undefined && { maxDiscount: data.maxDiscount }),
      ...(data.usageLimit !== undefined && { usageLimit: data.usageLimit }),
      ...(data.perUserLimit !== undefined && { perUserLimit: data.perUserLimit }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.startsAt !== undefined && { startsAt: data.startsAt }),
      ...(data.endsAt !== undefined && { endsAt: data.endsAt }),
    },
  });
}

export async function deleteCouponAdmin(publicId: string) {
  const existing = await prisma.coupon.findUnique({ where: { publicId } });
  if (!existing) {
    throw new AppError(404, "Coupon not found", "NOT_FOUND");
  }
  if (existing.usageCount > 0) {
    throw new AppError(
      400,
      "Coupon has redemption history; deactivate it instead of deleting",
      "COUPON_HAS_HISTORY"
    );
  }
  await prisma.coupon.delete({ where: { publicId } });
}

export async function toggleCouponActiveAdmin(publicId: string) {
  const existing = await prisma.coupon.findUnique({ where: { publicId } });
  if (!existing) {
    throw new AppError(404, "Coupon not found", "NOT_FOUND");
  }
  return prisma.coupon.update({
    where: { publicId },
    data: { isActive: !existing.isActive },
  });
}

export async function getCouponUsageStatsAdmin(publicId: string) {
  const coupon = await prisma.coupon.findUnique({ where: { publicId } });
  if (!coupon) {
    throw new AppError(404, "Coupon not found", "NOT_FOUND");
  }
  const agg = await prisma.couponRedemption.aggregate({
    where: { couponId: coupon.id },
    _count: { _all: true },
    _sum: { amount: true },
  });
  return {
    publicId: coupon.publicId,
    code: coupon.code,
    usageCount: coupon.usageCount,
    usageLimit: coupon.usageLimit,
    redemptionCount: agg._count._all,
    totalDiscountGiven: Number(agg._sum.amount ?? 0).toFixed(2),
  };
}
