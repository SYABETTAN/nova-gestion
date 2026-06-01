import PDFDocument from "pdfkit";
import { formatCurrency } from "@/lib/pricing";
import { moneyToNumber } from "@/lib/money";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";

export type QuotePdfLine = {
  name: string;
  quantity: MoneyInput;
  unitPriceExcludingTax: MoneyInput;
  totalExcludingTax: MoneyInput;
};

export type QuotePdfData = {
  quoteNumber: string;
  title: string;
  issueDate: Date;
  validUntil: Date;
  currency: string;
  customerName: string;
  organizationName: string;
  lines: QuotePdfLine[];
  totalExcludingTax: MoneyInput;
  totalVatAmount: MoneyInput;
  totalIncludingTax: MoneyInput;
};

function collectPdfBuffer(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

export async function generateQuotePdfBuffer(data: QuotePdfData): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const bufferPromise = collectPdfBuffer(doc);

  doc.fontSize(18).text(data.organizationName);
  doc.moveDown(0.5);
  doc.fontSize(14).text(`Devis ${data.quoteNumber}`);
  doc.fontSize(10).fillColor("#444").text(data.title);
  doc.moveDown();

  doc.fillColor("#000").fontSize(10);
  doc.text(`Client : ${data.customerName}`);
  doc.text(`Date : ${formatDateShort(data.issueDate)}`);
  doc.text(`Valable jusqu'au : ${formatDateShort(data.validUntil)}`);
  doc.moveDown();

  for (const line of data.lines) {
    if (doc.y > 700) doc.addPage();
    doc.text(
      `${line.name} — ${moneyToNumber(line.quantity)} × ${formatCurrency(line.unitPriceExcludingTax, data.currency)} = ${formatCurrency(line.totalExcludingTax, data.currency)}`,
    );
    doc.moveDown(0.4);
  }

  doc.moveDown();
  doc.fontSize(10);
  doc.text(`Total HT : ${formatCurrency(data.totalExcludingTax, data.currency)}`, { align: "right" });
  doc.text(`TVA : ${formatCurrency(data.totalVatAmount, data.currency)}`, { align: "right" });
  doc.fontSize(12).text(`Total TTC : ${formatCurrency(data.totalIncludingTax, data.currency)}`, {
    align: "right",
  });

  doc.end();
  return bufferPromise;
}
