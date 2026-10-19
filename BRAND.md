# RYNEX — Brand & Project Reference

This file is the single source of truth for names, URLs, and contact details.
**Never use old placeholder names (Aurora Gadgets, R.B. Enterprise, aurora_gadgets, auroragadgets) in this codebase.**

## Site identity

| Field | Value |
|---|---|
| Brand name | **RYNEX** |
| Tagline | RYNEX — trusted tech in Chittagong |
| Page title | `RYNEX — Premium Tech Store` |
| Logo file | `scripts/Futuristic RYNEX Neon Tech Logo.png` |

## URLs

| Service | URL |
|---|---|
| Frontend (Vercel) | `https://rynex-bd-tech.vercel.app` |
| Frontend (Vercel alt) | `https://rynex-shop.vercel.app` |
| Backend API (Render) | `https://e-commerce-shop-api-m4b1.onrender.com` |
| GitHub repo | `https://github.com/AhsanulHoque22/E_Commerce_Shop` |
| Facebook page | `https://www.facebook.com/rynex.bd.tech` |

## Contact / support

| Field | Value |
|---|---|
| Support email | `support@rynex.com.bd` |
| WhatsApp | `+8801834123393` |
| Phone | `+8801820223003` |
| Location | `#3B, Bipani Bitan, New Market, Chittagong` |

## Admin account (seed only)

| Field | Value |
|---|---|
| Email | `admin@rynex.com.bd` |
| Default password | `Admin12345678!` — **change before production** |

Admin is created exclusively via `server/prisma/seed.ts`. No API endpoint can create or promote a user to ADMIN role.

## Color palette

| Token | Hex | Use |
|---|---|---|
| Background | `#07090F` | Page background |
| Surface | `#0E1320` | Cards, panels |
| Primary Blue | `#0066FF` | Buttons, links, CTA |
| Neon Cyan | `#00C8FF` | Accents, glow |
| Silver/White | `#E5EFFF` | Primary text |
| Muted text | `#7B8FB0` | Labels, secondary text |
| Border | `#1A2540` | Borders |
| Error | `#FF4747` | Error states |
| Success | `#00E676` | Success states |

Primary gradient: `linear-gradient(135deg, #0066FF 0%, #00C8FF 100%)`
Glow: `box-shadow: 0 0 24px rgba(0, 200, 255, 0.4)`

## What NOT to use

| Old (wrong) | New (correct) |
|---|---|
| Aurora Gadgets | RYNEX |
| R.B. Enterprise | RYNEX |
| AuroraGadgetsShop | RynexShop |
| aurora_gadgets / Aurora_Gadgets | rynex.bd.tech |
| admin@example.com | admin@rynex.com.bd |
| support@auroragadgets.test | support@rynex.com.bd |
