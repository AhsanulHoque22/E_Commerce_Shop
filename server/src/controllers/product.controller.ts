import type { Request, Response } from "express";
import { z } from "zod";
import { listShowcaseBrandsPublic } from "../services/brand/shopBrand.service.js";
import {
  getProductByPublicId,
  getProductFacets,
  listHotProducts,
  listProducts,
} from "../services/product/product.service.js";
import {
  createProductReview,
  listReviewsForProductPublicId,
  getReviewSummaryForProductPublicId,
  userHasReviewedProduct,
} from "../services/product/productReview.service.js";
import { isFavorite } from "../services/favorite/favorite.service.js";
import { listProductsQuerySchema } from "../schemas/product.schema.js";
import { parseBody, parseQuery } from "../utils/validate.js";
import { sendSuccess } from "../utils/response.js";
import { paramString } from "../utils/routeParams.js";

const reviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(2).max(4000),
});

export async function list(req: Request, res: Response): Promise<void> {
  const q = parseQuery(listProductsQuerySchema, req.query);
  if (q.hot) {
    const data = await listHotProducts(q.limit);
    sendSuccess(res, data);
    return;
  }
  let minPrice = q.minPrice;
  let maxPrice = q.maxPrice;
  if (
    minPrice !== undefined &&
    maxPrice !== undefined &&
    minPrice > maxPrice
  ) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }
  const data = await listProducts({
    page: q.page,
    limit: q.limit,
    search: q.search,
    categoryPublicId: q.category,
    brand: q.brand,
    minPrice,
    maxPrice,
    featured: q.featured,
  });
  sendSuccess(res, data);
}

export async function facets(_req: Request, res: Response): Promise<void> {
  const data = await getProductFacets();
  sendSuccess(res, data);
}

export async function showcaseBrands(
  _req: Request,
  res: Response
): Promise<void> {
  const data = await listShowcaseBrandsPublic();
  sendSuccess(res, data);
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const publicId = paramString(req.params.publicId);
  const data = await getProductByPublicId(publicId);
  let reviewSummary: { count: number; average: number | null } = {
    count: 0,
    average: null,
  };
  try {
    reviewSummary = await getReviewSummaryForProductPublicId(publicId);
  } catch {
    /* e.g. missing product_reviews table before migration */
  }
  let isFavorited: boolean | undefined;
  let canSubmitReview: boolean | undefined;
  if (req.user?.role === "CUSTOMER") {
    try {
      isFavorited = await isFavorite(req.user.id, publicId);
    } catch {
      isFavorited = false;
    }
    try {
      const already = await userHasReviewedProduct(req.user.id, publicId);
      canSubmitReview = !already;
    } catch {
      canSubmitReview = false;
    }
  }
  sendSuccess(res, {
    ...data,
    reviewSummary,
    isFavorited,
    canSubmitReview,
  });
}

export async function listReviews(req: Request, res: Response): Promise<void> {
  const data = await listReviewsForProductPublicId(
    paramString(req.params.publicId)
  );
  sendSuccess(res, data);
}

export async function addReview(req: Request, res: Response): Promise<void> {
  const body = parseBody(reviewBodySchema, req.body);
  const row = await createProductReview(
    req.user!.id,
    paramString(req.params.publicId),
    body
  );
  sendSuccess(res, row, 201);
}
