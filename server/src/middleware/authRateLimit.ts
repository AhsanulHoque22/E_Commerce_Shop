import rateLimit from "express-rate-limit";

// Tight per-IP limiter for credential-guessing / OTP-spam-prone endpoints
// (login, OTP request/verify, forgot-password), layered under the generic
// global API limiter which is too loose (300/15min) to stop targeted abuse.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts, try again later" },
});
