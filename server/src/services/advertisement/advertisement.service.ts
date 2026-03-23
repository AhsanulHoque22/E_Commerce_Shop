import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { newPublicId } from "../../utils/ids.js";

export async function listActiveAds(placement?: string) {
  const now = new Date();
  return prisma.advertisement.findMany({
    where: {
      isActive: true,
      ...(placement ? { placement } : {}),
      OR: [
        { startsAt: null, endsAt: null },
        {
          AND: [
            { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
            { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
          ],
        },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function createAd(data: {
  title: string;
  imageUrl: string;
  imagePublicId?: string;
  linkUrl?: string;
  linkProductPublicId?: string;
  linkCategoryPublicId?: string;
  placement?: string;
  sortOrder?: number;
}) {
  if (data.linkProductPublicId) {
    const p = await prisma.product.findUnique({
      where: { publicId: data.linkProductPublicId },
    });
    if (!p) {
      throw new AppError(400, "Invalid link product", "BAD_LINK");
    }
  }
  if (data.linkCategoryPublicId) {
    const c = await prisma.category.findUnique({
      where: { publicId: data.linkCategoryPublicId },
    });
    if (!c) {
      throw new AppError(400, "Invalid link category", "BAD_LINK");
    }
  }
  return prisma.advertisement.create({
    data: {
      publicId: newPublicId("ad"),
      title: data.title,
      imageUrl: data.imageUrl,
      imagePublicId: data.imagePublicId,
      linkUrl: data.linkUrl,
      linkProductPublicId: data.linkProductPublicId,
      linkCategoryPublicId: data.linkCategoryPublicId,
      placement: data.placement ?? "home_hero",
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function listAdsAdmin() {
  return prisma.advertisement.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function updateAd(
  publicId: string,
  data: Partial<{
    title: string;
    imageUrl: string;
    imagePublicId: string | null;
    linkUrl: string | null;
    linkProductPublicId: string | null;
    linkCategoryPublicId: string | null;
    placement: string;
    sortOrder: number;
    isActive: boolean;
  }>
) {
  const existing = await prisma.advertisement.findUnique({ where: { publicId } });
  if (!existing) {
    throw new AppError(404, "Advertisement not found", "NOT_FOUND");
  }
  if (data.linkProductPublicId) {
    const p = await prisma.product.findUnique({
      where: { publicId: data.linkProductPublicId },
    });
    if (!p) {
      throw new AppError(400, "Invalid link product", "BAD_LINK");
    }
  }
  if (data.linkCategoryPublicId) {
    const c = await prisma.category.findUnique({
      where: { publicId: data.linkCategoryPublicId },
    });
    if (!c) {
      throw new AppError(400, "Invalid link category", "BAD_LINK");
    }
  }
  return prisma.advertisement.update({
    where: { publicId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      ...(data.imagePublicId !== undefined && {
        imagePublicId: data.imagePublicId ?? undefined,
      }),
      ...(data.linkUrl !== undefined && { linkUrl: data.linkUrl ?? undefined }),
      ...(data.linkProductPublicId !== undefined && {
        linkProductPublicId: data.linkProductPublicId,
      }),
      ...(data.linkCategoryPublicId !== undefined && {
        linkCategoryPublicId: data.linkCategoryPublicId,
      }),
      ...(data.placement !== undefined && { placement: data.placement }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}
