import { z } from "zod";

export const dashboardPeriodFilterSchema = z
  .object({
    preset: z
      .enum([
        "THIS_MONTH",
        "LAST_MONTH",
        "THIS_QUARTER",
        "LAST_QUARTER",
        "THIS_YEAR",
        "LAST_12_MONTHS",
        "CUSTOM",
      ])
      .default("THIS_MONTH"),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.preset === "CUSTOM") {
      if (!data.startDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Date de début requise", path: ["startDate"] });
      }
      if (!data.endDate) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Date de fin requise", path: ["endDate"] });
      }
      if (data.startDate && data.endDate && data.endDate < data.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La date de fin doit être postérieure ou égale à la date de début",
          path: ["endDate"],
        });
      }
    }
  });

export const dashboardExportSchema = z.object({
  preset: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type DashboardPeriodFilterInput = z.infer<typeof dashboardPeriodFilterSchema>;
