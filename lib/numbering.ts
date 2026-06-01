import {
  NumberingResetPeriod,
  NumberingSequenceType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";

export type NumberingSequenceData = {
  prefix: string;
  nextNumber: number;
  padding: number;
  suffix: string;
  resetPeriod: NumberingResetPeriod;
};

function replaceDateTokens(template: string, date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return template
    .replace(/\{YYYY\}/g, String(year))
    .replace(/\{YY\}/g, String(year).slice(-2))
    .replace(/\{MM\}/g, month)
    .replace(/\{DD\}/g, day);
}

export function formatNumberPreview(
  sequence: NumberingSequenceData,
  date: Date = new Date(),
): string {
  const prefix = replaceDateTokens(sequence.prefix, date);
  const suffix = replaceDateTokens(sequence.suffix, date);
  const number = String(sequence.nextNumber).padStart(sequence.padding, "0");
  return `${prefix}${number}${suffix}`;
}

export function shouldResetSequence(
  resetPeriod: NumberingResetPeriod,
  lastResetAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (resetPeriod === "NEVER") return false;
  if (!lastResetAt) return false;

  if (resetPeriod === "YEARLY") {
    return lastResetAt.getFullYear() !== now.getFullYear();
  }

  if (resetPeriod === "MONTHLY") {
    return (
      lastResetAt.getFullYear() !== now.getFullYear() ||
      lastResetAt.getMonth() !== now.getMonth()
    );
  }

  return false;
}

export async function generateNextNumber(
  organizationId: string,
  type: NumberingSequenceType,
  userId?: string,
): Promise<string> {
  return prisma.$transaction(async (tx) => {
    const sequence = await tx.numberingSequence.findUnique({
      where: {
        organizationId_type: { organizationId, type },
      },
    });

    if (!sequence) {
      throw new Error(`Séquence de numérotation introuvable : ${type}`);
    }

    let nextNumber = sequence.nextNumber;
    let lastResetAt = sequence.lastResetAt;

    if (shouldResetSequence(sequence.resetPeriod, lastResetAt)) {
      nextNumber = 1;
      lastResetAt = new Date();
    }

    const formatted = formatNumberPreview(
      {
        prefix: sequence.prefix,
        nextNumber,
        padding: sequence.padding,
        suffix: sequence.suffix,
        resetPeriod: sequence.resetPeriod,
      },
      new Date(),
    );

    await tx.numberingSequence.update({
      where: { id: sequence.id },
      data: {
        nextNumber: nextNumber + 1,
        lastResetAt,
      },
    });

    await createAuditLog({
      organizationId,
      userId,
      action: "NUMBER_GENERATED",
      entityType: "NumberingSequence",
      entityId: sequence.id,
      entityLabel: `${type} → ${formatted}`,
      newValues: { generatedNumber: formatted, type },
    });

    return formatted;
  });
}

export { replaceDateTokens, NumberingSequenceType, NumberingResetPeriod };
