import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcrypt";
import { randomUUID } from "crypto";
import { prisma } from "../../config/db.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/AppError.js";
import { newPublicId } from "../../utils/ids.js";

const googleClient = new OAuth2Client();

export async function verifyGoogleIdToken(idToken: string): Promise<{
  email: string;
  sub: string;
  givenName?: string;
  familyName?: string;
}> {
  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError(503, "Google sign-in is not configured", "OAUTH_GOOGLE");
  }
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const p = ticket.getPayload();
  if (!p?.email) {
    throw new AppError(400, "Google account has no email address", "OAUTH_EMAIL");
  }
  return {
    email: p.email.toLowerCase(),
    sub: p.sub,
    givenName: p.given_name,
    familyName: p.family_name,
  };
}

export async function verifyFacebookAccessToken(
  accessToken: string
): Promise<{ id: string; email: string; name?: string }> {
  if (!env.FACEBOOK_APP_ID || !env.FACEBOOK_APP_SECRET) {
    throw new AppError(503, "Facebook sign-in is not configured", "OAUTH_FACEBOOK");
  }
  const debugUrl =
    `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(accessToken)}` +
    `&access_token=${encodeURIComponent(`${env.FACEBOOK_APP_ID}|${env.FACEBOOK_APP_SECRET}`)}`;
  const dbg = await fetch(debugUrl);
  const dbgJson = (await dbg.json()) as {
    data?: { is_valid?: boolean; app_id?: string };
  };
  if (
    !dbgJson.data?.is_valid ||
    String(dbgJson.data.app_id) !== String(env.FACEBOOK_APP_ID)
  ) {
    throw new AppError(401, "Invalid Facebook session", "OAUTH_FACEBOOK_INVALID");
  }
  const meUrl =
    `https://graph.facebook.com/me?fields=id,email,name&access_token=${encodeURIComponent(accessToken)}`;
  const me = await fetch(meUrl);
  const meJson = (await me.json()) as { id?: string; email?: string; name?: string };
  if (!meJson.id || !meJson.email) {
    throw new AppError(
      400,
      "Facebook did not return an email (grant email permission)",
      "OAUTH_EMAIL"
    );
  }
  return {
    id: meJson.id,
    email: meJson.email.toLowerCase(),
    name: meJson.name,
  };
}

type UserTokenSlice = {
  id: string;
  publicId: string;
  email: string;
  role: "CUSTOMER" | "ADMIN";
};

export async function upsertGoogleUser(profile: {
  email: string;
  sub: string;
  givenName?: string;
  familyName?: string;
}): Promise<UserTokenSlice> {
  let user = await prisma.user.findFirst({
    where: { OR: [{ googleId: profile.sub }, { email: profile.email }] },
  });
  if (user) {
    if (!user.googleId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId: profile.sub },
      });
    }
    return {
      id: user.id,
      publicId: user.publicId,
      email: user.email,
      role: user.role,
    };
  }
  const passwordHash = await bcrypt.hash(randomUUID() + randomUUID(), 12);
  user = await prisma.user.create({
    data: {
      publicId: newPublicId("usr"),
      email: profile.email,
      passwordHash,
      googleId: profile.sub,
      firstName: profile.givenName,
      lastName: profile.familyName,
      consentAt: new Date(),
      role: "CUSTOMER",
    },
  });
  return {
    id: user.id,
    publicId: user.publicId,
    email: user.email,
    role: user.role,
  };
}

export async function upsertFacebookUser(profile: {
  id: string;
  email: string;
  name?: string;
}): Promise<UserTokenSlice> {
  let user = await prisma.user.findFirst({
    where: { OR: [{ facebookId: profile.id }, { email: profile.email }] },
  });
  if (user) {
    if (!user.facebookId) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { facebookId: profile.id },
      });
    }
    return {
      id: user.id,
      publicId: user.publicId,
      email: user.email,
      role: user.role,
    };
  }
  const parts = profile.name?.trim().split(/\s+/) ?? [];
  const passwordHash = await bcrypt.hash(randomUUID() + randomUUID(), 12);
  user = await prisma.user.create({
    data: {
      publicId: newPublicId("usr"),
      email: profile.email,
      passwordHash,
      facebookId: profile.id,
      firstName: parts[0] || undefined,
      lastName: parts.slice(1).join(" ") || undefined,
      consentAt: new Date(),
      role: "CUSTOMER",
    },
  });
  return {
    id: user.id,
    publicId: user.publicId,
    email: user.email,
    role: user.role,
  };
}
