import PDFDocument from "pdfkit";
import { formatCurrency } from "@/lib/pricing";
import { moneyToNumber } from "@/lib/money";
import type { MoneyInput } from "@/lib/money";
import { formatDateShort } from "@/lib/utils";

export type InvoicePdfLine = {
  name: string;
  quantity: MoneyInput;
  unitPriceExcludingTax: MoneyInput;
  totalExcludingTax: MoneyInput;
  vatRate: MoneyInput;
};

export type InvoicePdfData = {
  invoiceNumber: string;
  title: string;
  issueDate: Date;
  dueDate: Date;
  currency: string;
  customerName: string;
  organizationName: string;
  lines: InvoicePdfLine[];
  totalExcludingTax: MoneyInput;
  totalVatAmount: MoneyInput;
  totalIncludingTax: MoneyInput;
  amountDue: MoneyInput;
};

function collectPdfBuffer(doc: InstanceType<typeof PDFDocument>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

export async function generateInvoicePdfBuffer(data: InvoicePdfData): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const bufferPromise = collectPdfBuffer(doc);

  doc.fontSize(18).text(data.organizationName, { continued: false });
  doc.moveDown(0.5);
  doc.fontSize(14).text(`Facture ${data.invoiceNumber}`);
  doc.fontSize(10).fillColor("#444");
  doc.text(data.title);
  doc.moveDown();

  doc.fillColor("#000").fontSize(10);
  doc.text(`Client : ${data.customerName}`);
  doc.text(`Date d'émission : ${formatDateShort(data.issueDate)}`);
  doc.text(`Échéance : ${formatDateShort(data.dueDate)}`);
  doc.moveDown();

  const tableTop = doc.y;
  const colX = [50, 280, 340, 400, 460];
  doc.fontSize(9).fillColor("#666");
  doc.text("Désignation", colX[0], tableTop);
  doc.text("Qté", colX[1], tableTop);
  doc.text("PU HT", colX[2], tableTop);
  doc.text("TVA", colX[3], tableTop);
  doc.text("Total HT", colX[4], tableTop);
  doc.moveDown(0.5);
  doc.strokeColor("#ddd").moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.3);

  doc.fillColor("#000").fontSize(9);
  for (const line of data.lines) {
    const y = doc.y;
    if (y > 700) {
      doc.addPage();
    }
    doc.text(line.name.slice(0, 40), colX[0], doc.y, { width: 220 });
    const rowY = doc.y - 12;
    doc.text(String(moneyToNumber(line.quantity)), colX[1], rowY);
    doc.text(formatCurrency(line.unitPriceExcludingTax, data.currency), colX[2], rowY);
    doc.text(`${moneyToNumber(line.vatRate)} %`, colX[3], rowY);
    doc.text(formatCurrency(line.totalExcludingTax, data.currency), colX[4], rowY);
    doc.moveDown(0.6);
  }

  doc.moveDown();
  doc.fontSize(10);
  doc.text(`Total HT : ${formatCurrency(data.totalExcludingTax, data.currency)}`, { align: "right" });
  doc.text(`TVA : ${formatCurrency(data.totalVatAmount, data.currency)}`, { align: "right" });
  doc.fontSize(12).text(`Total TTC : ${formatCurrency(data.totalIncludingTax, data.currency)}`, {
    align: "right",
  });
  doc.text(`Reste dû : ${formatCurrency(data.amountDue, data.currency)}`, { align: "right" });

  doc.end();
  return bufferPromise;
}
