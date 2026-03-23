import { ProductStatus } from "@prisma/client";

export function statusAfterStockChange(
  stock: number,
  previous: ProductStatus
): ProductStatus {
  if (previous === ProductStatus.DISCONTINUED) {
    return ProductStatus.DISCONTINUED;
  }
  if (stock <= 0) {
    return ProductStatus.OUT_OF_STOCK;
  }
  return ProductStatus.ACTIVE;
}

