import type { SearchEntityType } from "@prisma/client";

export type { SearchEntityType };

export type SearchResult = {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle?: string;
  description?: string;
  href: string;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "warning" | "success" | "destructive";
  amount?: number;
  currency?: string;
  date?: Date;
  status?: string;
  score: number;
  metadata?: Record<string, unknown>;
  isFavorite?: boolean;
};

export type SearchResultGroup = {
  type: SearchEntityType | "ACTION";
  label: string;
  results: SearchResult[];
};

export type GlobalSearchOptions = {
  organizationId: string;
  userId: string;
  permissions: string[];
  enabledModules: Set<string>;
  favoriteKeys: Set<string>;
  limitPerGroup?: number;
  globalLimit?: number;
  types?: SearchEntityType[];
};

export type GlobalSearchResponse = {
  query: string;
  groups: SearchResultGroup[];
  totalCount: number;
  error?: string;
};

export type QuickAction = {
  id: string;
  label: string;
  description?: string;
  href: string;
  icon: string;
  permission?: string;
  moduleKey?: string;
};
