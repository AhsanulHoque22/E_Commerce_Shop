import { prisma } from "../../config/db.js";
import { newPublicId } from "../../utils/ids.js";

const HOURS_72_MS = 72 * 60 * 60 * 1000;

export async function createComplaint(input: {
  email: string;
  subject: string;
  message: string;
  userId?: string;
}) {
  const resolutionDueAt = new Date(Date.now() + HOURS_72_MS);
  const c = await prisma.complaint.create({
    data: {
      publicId: newPublicId("cmp"),
      email: input.email,
      subject: input.subject,
      message: input.message,
      userId: input.userId,
      resolutionDueAt,
    },
  });
  return { publicId: c.publicId, resolutionDueAt: c.resolutionDueAt };
}

export async function listComplaintsAdmin() {
  return prisma.complaint.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}
