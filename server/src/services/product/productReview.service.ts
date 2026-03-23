import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { newPublicId } from "../../utils/ids.js";
import { storefrontWhere } from "./product.service.js";

function displayAuthor(first: string | null, last: string | null, email: string) {
  const n = [first, last].filter(Boolean).join(" ").trim();
  if (n) {
    return n;
  }
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

export async function getReviewSummaryForProductPublicId(publicId: string) {
  const product = await prisma.product.findFirst({
    where: { publicId, ...storefrontWhere },
    select: { id: true },
  });
  if (!product) {
    return { count: 0, average: null as number | null };
  }
  const agg = await prisma.productReview.aggregate({
    where: { productId: product.id },
    _avg: { rating: true },
    _count: { _all: true },
  });
  const avg = agg._avg.rating;
  return {
    count: agg._count._all,
    average: avg === null ? null : Math.round(avg * 10) / 10,
  };
}

export async function listReviewsForProductPublicId(
  publicId: string,
  limit = 50
) {
  const product = await prisma.product.findFirst({
    where: { publicId, ...storefrontWhere },
    select: { id: true },
  });
  if (!product) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }
  const rows = await prisma.productReview.findMany({
    where: { productId: product.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });
  return {
    items: rows.map((r) => ({
      publicId: r.publicId,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      authorName: displayAuthor(
        r.user.firstName,
        r.user.lastName,
        r.user.email
      ),
    })),
  };
}

export async function createProductReview(
  userId: string,
  productPublicId: string,
  body: { rating: number; comment: string }
) {
  const product = await prisma.product.findFirst({
    where: { publicId: productPublicId, ...storefrontWhere },
  });
  if (!product) {
    throw new AppError(404, "Product not found", "NOT_FOUND");
  }
  const rating = Math.round(body.rating);
  if (rating < 1 || rating > 5) {
    throw new AppError(400, "Rating must be 1–5", "VALIDATION");
  }
  const comment = body.comment.trim();
  if (comment.length < 2) {
    throw new AppError(400, "Comment is too short", "VALIDATION");
  }
  if (comment.length > 4000) {
    throw new AppError(400, "Comment is too long", "VALIDATION");
  }
  try {
    const r = await prisma.productReview.create({
      data: {
        publicId: newPublicId("rev"),
        productId: product.id,
        userId,
        rating,
        comment,
      },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });
    return {
      publicId: r.publicId,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt.toISOString(),
      authorName: displayAuthor(
        r.user.firstName,
        r.user.lastName,
        r.user.email
      ),
    };
  } catch (e: unknown) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "P2002"
    ) {
      throw new AppError(409, "You already reviewed this product", "DUPLICATE");
    }
    throw e;
  }
}

export async function userHasReviewedProduct(
  userId: string,
  productPublicId: string
) {
  const product = await prisma.product.findUnique({
    where: { publicId: productPublicId },
    select: { id: true },
  });
  if (!product) {
    return false;
  }
  const row = await prisma.productReview.findUnique({
    where: {
      productId_userId: { productId: product.id, userId },
    },
  });
  return Boolean(row);
}
