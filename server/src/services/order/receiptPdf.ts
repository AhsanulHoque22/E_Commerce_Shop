import PDFDocument from "pdfkit";

export type ReceiptOrderInput = {
  receiptPublicId: string;
  receiptIssuedAt: Date;
  orderPublicId: string;
  currency: string;
  amountPaid: string;
  paymentMethod: string | null;
  /** Non-sensitive reference only (e.g. gateway txn id). */
  paymentReference: string | null;
  contactEmail: string;
  contactPhone: string | null;
};

export function buildReceiptPdf(o: ReceiptOrderInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).font("Helvetica-Bold").text("Aurora Gadgets");
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#444444");
    doc.text("Payment receipt");
    doc.fillColor("#000000");
    doc.moveDown(1.2);

    const dateStr = o.receiptIssuedAt
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
    doc.fontSize(10).font("Helvetica");
    doc.text(`Receipt ID: ${o.receiptPublicId}`);
    doc.text(`Order ID: ${o.orderPublicId}`);
    doc.text(`Payment date: ${dateStr} UTC`);
    doc.moveDown(0.8);

    doc.font("Helvetica-Bold").text("Payment status");
    doc.font("Helvetica").text("COMPLETED");
    doc.moveDown(0.8);

    doc.font("Helvetica-Bold").text("Amount paid");
    doc.font("Helvetica").fontSize(12).text(`${o.currency} ${o.amountPaid}`);
    doc.fontSize(10);
    doc.moveDown(0.6);

    doc.font("Helvetica-Bold").text("Payment method");
    doc.font("Helvetica").text(o.paymentMethod ?? "—");
    doc.moveDown(0.6);

    if (o.paymentReference?.trim()) {
      doc.font("Helvetica-Bold").text("Transaction / reference ID");
      doc.font("Helvetica").text(o.paymentReference.trim(), { width: 495 });
      doc.moveDown(0.6);
    }

    doc.font("Helvetica-Bold").text("Customer");
    doc
      .font("Helvetica")
      .text(
        `${o.contactEmail}${o.contactPhone ? ` · ${o.contactPhone}` : ""}`,
        { width: 495 }
      );

    doc.moveDown(2);
    doc.fontSize(9).fillColor("#666666");
    doc.text("This receipt confirms payment for the above order.", {
      align: "center",
    });

    doc.end();
  });
}
