import type { Request, Response } from "express";
import { complaintAdminUpdateSchema, complaintSchema } from "../schemas/complaint.schema.js";
import { parseBody } from "../utils/validate.js";
import { sendSuccess } from "../utils/response.js";
import {
  createComplaint,
  listComplaintsAdmin,
  updateComplaintStatusAdmin,
} from "../services/complaint/complaint.service.js";
import { paramString } from "../utils/routeParams.js";

export async function create(req: Request, res: Response): Promise<void> {
  const body = parseBody(complaintSchema, req.body);
  const data = await createComplaint({
    email: body.email,
    subject: body.subject,
    message: body.message,
    userId: req.user?.id,
  });
  sendSuccess(res, data, 201);
}

export async function adminList(req: Request, res: Response): Promise<void> {
  const rows = await listComplaintsAdmin();
  sendSuccess(res, rows);
}

export async function adminUpdate(req: Request, res: Response): Promise<void> {
  const body = parseBody(complaintAdminUpdateSchema, req.body);
  const data = await updateComplaintStatusAdmin(paramString(req.params.publicId), body.status);
  sendSuccess(res, data);
}
