/** Stable key for matching `Product.brand` values (case/spacing insensitive). */
export function normalizeBrandKey(brand: string): string {
  return brand.trim().toLowerCase().replace(/\s+/g, " ");
}
