import type { OrderStatus } from "@prisma/client";
import PDFDocument from "pdfkit";
import {
  invoiceDocumentPaymentLabel,
  orderAllowsInvoice,
} from "./orderStatusFlow.js";

export { orderAllowsInvoice };

type Addr = Record<string, unknown>;

function formatAddress(addr: unknown): string {
  if (!addr || typeof addr !== "object") {
    return "—";
  }
  const a = addr as Addr;
  const parts = [
    a.fullName,
    a.line1,
    a.line2,
    a.city,
    a.district,
    a.postalCode,
    a.country,
  ]
    .filter((x) => typeof x === "string" && x.trim())
    .map((x) => String(x).trim());
  return parts.length ? parts.join(", ") : "—";
}

export type InvoiceOrderInput = {
  invoicePublicId: string;
  invoiceIssuedAt: Date;
  orderPublicId: string;
  status: OrderStatus;
  createdAt: Date;
  currency: string;
  subtotal: string;
  shippingTotal: string;
  total: string;
  advancePercent: number;
  advanceAmount: string;
  paymentMethod: string | null;
  paymentStatus: string;
  paymentReference: string | null;
  receiptPublicId: string | null;
  contactEmail: string;
  contactPhone: string | null;
  shippingAddress: unknown;
  items: { name: string; quantity: number; unitPrice: string }[];
};

const PAGE_BOTTOM = 780;
const MARGIN = 50;
const COL_ITEM = MARGIN;
const COL_ITEM_W = 255;
const COL_QTY = 315;
const COL_QTY_W = 35;
const COL_UNIT = 360;
const COL_UNIT_W = 75;
const COL_LINE = 445;
const COL_LINE_W = 100;

export function buildInvoicePdf(o: InvoiceOrderInput): Promise<Buffer> {
  const docPayment = invoiceDocumentPaymentLabel(o.status);
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: MARGIN });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).font("Helvetica-Bold").text("Aurora Gadgets");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#444444");
    doc.text("Invoice (pre-payment document)");
    doc.fillColor("#000000");
    doc.moveDown(1.2);

    const issueStr = o.invoiceIssuedAt
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    doc.fontSize(10).font("Helvetica");
    doc.text(`Invoice ID: ${o.invoicePublicId}`);
    doc.text(`Order ID: ${o.orderPublicId}`);
    doc.text(`Issue date: ${issueStr} UTC`);
    doc.text(`Order placed: ${o.createdAt.toISOString().slice(0, 19).replace("T", " ")} UTC`);
    doc.text(`Order status: ${o.status}`);
    doc.moveDown(0.8);

    doc.font("Helvetica-Bold").text("Ship to");
    doc.font("Helvetica").text(formatAddress(o.shippingAddress), {
      width: 495,
    });
    doc.moveDown(0.6);

    doc.text(
      `Contact: ${o.contactEmail}${o.contactPhone ? ` · ${o.contactPhone}` : ""}`,
      { width: 495 }
    );
    doc.moveDown(1);

    let y = doc.y;
    doc.font("Helvetica-Bold").fontSize(9);
    doc.text("Item", COL_ITEM, y, { width: COL_ITEM_W });
    doc.text("Qty", COL_QTY, y, { width: COL_QTY_W, align: "right" });
    doc.text("Unit", COL_UNIT, y, { width: COL_UNIT_W, align: "right" });
    doc.text("Line", COL_LINE, y, { width: COL_LINE_W, align: "right" });
    y += 16;
    doc.moveTo(MARGIN, y).lineTo(545, y).stroke("#cccccc");
    y += 10;

    doc.font("Helvetica").fontSize(9);
    for (const i of o.items) {
      const lineTotal = (Number(i.unitPrice) * i.quantity).toFixed(2);
      const nameH = doc.heightOfString(i.name, {
        width: COL_ITEM_W,
      });
      const rowH = Math.max(nameH, 14);

      if (y + rowH > PAGE_BOTTOM) {
        doc.addPage();
        y = MARGIN;
      }

      doc.text(i.name, COL_ITEM, y, { width: COL_ITEM_W });
      doc.text(String(i.quantity), COL_QTY, y, {
        width: COL_QTY_W,
        align: "right",
      });
      doc.text(`${o.currency} ${i.unitPrice}`, COL_UNIT, y, {
        width: COL_UNIT_W,
        align: "right",
      });
      doc.text(`${o.currency} ${lineTotal}`, COL_LINE, y, {
        width: COL_LINE_W,
        align: "right",
      });
      y += rowH + 6;
    }

    y += 8;
    if (y + 140 > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN;
    }

    const labelX = 320;
    const valX = 400;
    const valW = 145;
    doc.font("Helvetica").fontSize(10);
    doc.text("Subtotal", labelX, y);
    doc.text(`${o.currency} ${o.subtotal}`, valX, y, {
      width: valW,
      align: "right",
    });
    y += 18;
    doc.text("Shipping", labelX, y);
    doc.text(`${o.currency} ${o.shippingTotal}`, valX, y, {
      width: valW,
      align: "right",
    });
    y += 18;
    doc.text(`Advance (${o.advancePercent}%)`, labelX, y);
    doc.text(`${o.currency} ${o.advanceAmount}`, valX, y, {
      width: valW,
      align: "right",
    });
    y += 22;
    doc.moveTo(labelX, y).lineTo(545, y).stroke("#333333");
    y += 10;
    doc.font("Helvetica-Bold").fontSize(11);
    doc.text("Total", labelX, y);
    doc.text(`${o.currency} ${o.total}`, valX, y, {
      width: valW,
      align: "right",
    });
    y += 28;

    doc.font("Helvetica-Bold").fontSize(10).text("Payment (invoice)");
    y = doc.y + 4;
    doc.font("Helvetica").fontSize(9);
    doc.text(`Method (selected): ${o.paymentMethod ?? "—"}`, MARGIN, y, {
      width: 495,
    });
    y = doc.y + 2;
    doc.text(`Internal status: ${o.paymentStatus}`, MARGIN, y, { width: 495 });
    y = doc.y + 2;
    doc.font("Helvetica-Bold").text(`Document payment status: ${docPayment}`, MARGIN, y, {
      width: 495,
    });
    if (docPayment === "COMPLETED" && o.receiptPublicId) {
      y = doc.y + 2;
      doc.font("Helvetica").text(
        `Payment receipt: ${o.receiptPublicId} (download separately).`,
        MARGIN,
        y,
        { width: 495 }
      );
    }
    if (o.paymentReference?.trim()) {
      y = doc.y + 2;
      doc.font("Helvetica").text(
        `Reference (if assigned): ${o.paymentReference}`,
        MARGIN,
        y,
        { width: 495 }
      );
    }

    doc.moveDown(2);
    doc.fontSize(9).fillColor("#666666");
    doc.text(
      docPayment === "INCOMPLETE"
        ? "Payment is pending — this invoice is not a proof of payment."
        : "Payment recorded — use the payment receipt as proof of payment.",
      { align: "center" }
    );

    doc.end();
  });
}
