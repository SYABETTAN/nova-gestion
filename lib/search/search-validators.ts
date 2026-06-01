import { z } from "zod";

export const globalSearchInputSchema = z.object({
  query: z.string().max(100).optional().default(""),
  types: z.array(z.string()).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const searchHistoryInputSchema = z.object({
  query: z.string().min(2).max(100),
});

export const searchResultClickInputSchema = z.object({
  query: z.string().min(1).max(100),
  resultType: z.string(),
  resultId: z.string(),
  resultTitle: z.string(),
});

export const addFavoriteEntityInputSchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  href: z.string().min(1),
});

export const removeFavoriteEntityInputSchema = z.object({
  id: z.string().optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

export const searchPageFilterInputSchema = z.object({
  query: z.string().max(100).optional(),
  type: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
});
