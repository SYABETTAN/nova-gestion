import { describe, expect, it } from "vitest";
import {
  bulkSendReminderSimulationSchema,
  sendReminderSimulationSchema,
  pauseCollectionSchema,
} from "@/lib/reminder-validators";

describe("reminder validation", () => {
  it("recipientEmail invalide est refusé", () => {
    const result = sendReminderSimulationSchema.safeParse({
      invoiceId: "inv1",
      recipientEmail: "invalid",
      level: "FRIENDLY",
      subject: "Test",
      message: "Message",
    });
    expect(result.success).toBe(false);
  });

  it("subject obligatoire", () => {
    const result = sendReminderSimulationSchema.safeParse({
      invoiceId: "inv1",
      recipientEmail: "test@demo.local",
      level: "FRIENDLY",
      subject: "",
      message: "Message",
    });
    expect(result.success).toBe(false);
  });

  it("reason obligatoire pour pause", () => {
    const result = pauseCollectionSchema.safeParse({ invoiceId: "inv1", reason: "ab" });
    expect(result.success).toBe(false);
  });

  it("bulk invoiceIds non vide", () => {
    const result = bulkSendReminderSimulationSchema.safeParse({ invoiceIds: [] });
    expect(result.success).toBe(false);
  });
});
