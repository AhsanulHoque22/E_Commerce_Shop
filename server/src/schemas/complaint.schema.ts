import { z } from "zod";
import { COMPLAINT_STATUSES } from "../services/complaint/complaint.service.js";

export const complaintSchema = z.object({
  email: z.string().email(),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
});

export const complaintAdminUpdateSchema = z.object({
  status: z.enum(COMPLAINT_STATUSES),
});
