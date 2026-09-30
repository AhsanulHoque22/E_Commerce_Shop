import { prisma } from "../../config/db.js";
import { AppError } from "../../utils/AppError.js";
import { newPublicId } from "../../utils/ids.js";

export type AddressInput = {
  label?: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  area?: string;
  postalCode?: string;
  lat?: number;
  lng?: number;
  isDefault?: boolean;
};

export async function listAddresses(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

export async function createAddress(userId: string, data: AddressInput) {
  return prisma.$transaction(async (tx) => {
    const existingCount = await tx.address.count({ where: { userId } });
    const isDefault = data.isDefault ?? existingCount === 0;
    if (isDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.address.create({
      data: {
        publicId: newPublicId("addr"),
        userId,
        label: data.label ?? "Home",
        fullName: data.fullName,
        phone: data.phone,
        line1: data.line1,
        line2: data.line2,
        city: data.city,
        area: data.area,
        postalCode: data.postalCode,
        lat: data.lat,
        lng: data.lng,
        isDefault,
      },
    });
  });
}

export async function updateAddress(
  userId: string,
  publicId: string,
  data: Partial<AddressInput>
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { publicId, userId } });
    if (!existing) {
      throw new AppError(404, "Address not found", "NOT_FOUND");
    }
    if (data.isDefault === true) {
      await tx.address.updateMany({
        where: { userId, isDefault: true, id: { not: existing.id } },
        data: { isDefault: false },
      });
    }
    return tx.address.update({
      where: { id: existing.id },
      data: {
        ...(data.label !== undefined && { label: data.label }),
        ...(data.fullName !== undefined && { fullName: data.fullName }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.line1 !== undefined && { line1: data.line1 }),
        ...(data.line2 !== undefined && { line2: data.line2 }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.area !== undefined && { area: data.area }),
        ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
        ...(data.lat !== undefined && { lat: data.lat }),
        ...(data.lng !== undefined && { lng: data.lng }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    });
  });
}

export async function deleteAddress(userId: string, publicId: string) {
  const existing = await prisma.address.findFirst({ where: { publicId, userId } });
  if (!existing) {
    throw new AppError(404, "Address not found", "NOT_FOUND");
  }
  await prisma.address.delete({ where: { id: existing.id } });
  if (existing.isDefault) {
    const next = await prisma.address.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (next) {
      await prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
}

export async function setDefaultAddress(userId: string, publicId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { publicId, userId } });
    if (!existing) {
      throw new AppError(404, "Address not found", "NOT_FOUND");
    }
    await tx.address.updateMany({
      where: { userId, isDefault: true, id: { not: existing.id } },
      data: { isDefault: false },
    });
    return tx.address.update({ where: { id: existing.id }, data: { isDefault: true } });
  });
}
