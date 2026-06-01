"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { requirePermission, hasPermission } from "@/lib/permissions";
import {
  globalSearch,
  loadEnabledModules,
  loadFavoriteKeys,
  searchByType,
} from "@/lib/search/search-service";
import {
  addFavoriteEntityInputSchema,
  globalSearchInputSchema,
  removeFavoriteEntityInputSchema,
  searchHistoryInputSchema,
  searchResultClickInputSchema,
} from "@/lib/search/search-validators";
import { isQueryLongEnough } from "@/lib/search/search-utils";
import { getQuickActions } from "@/lib/search/quick-actions";
import { prisma } from "@/lib/prisma";
import type { SearchEntityType } from "@prisma/client";

export async function globalSearchAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "GLOBAL_SEARCH_USE");
  const data = globalSearchInputSchema.parse(input);
  const enabledModules = await loadEnabledModules(user.organizationId);
  const favoriteKeys = await loadFavoriteKeys(user.organizationId, user.id);
  const result = await globalSearch(user, data.query ?? "", {
    enabledModules,
    favoriteKeys,
    limitPerGroup: 5,
    globalLimit: data.limit ?? 50,
  });
  return result;
}

export async function getSearchInitialStateAction() {
  const user = await requireAuth();
  requirePermission(user, "GLOBAL_SEARCH_USE");
  const [recent, favorites, enabledModules] = await Promise.all([
    listRecentSearchesAction(),
    listFavoriteEntitiesAction(),
    loadEnabledModules(user.organizationId),
  ]);
  const quickActions = getQuickActions(user, enabledModules);
  return { recent, favorites, quickActions };
}

export async function searchByTypeAction(
  type: SearchEntityType,
  query: string,
  limit = 20,
) {
  const user = await requireAuth();
  requirePermission(user, "GLOBAL_SEARCH_USE");
  const enabledModules = await loadEnabledModules(user.organizationId);
  const { canSearchEntityType } = await import("@/lib/search/search-permissions");
  if (!canSearchEntityType(user, type, enabledModules)) return [];
  return searchByType(type, user.organizationId, query, limit);
}

export async function recordSearchAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "SEARCH_HISTORY_READ");
  const data = searchHistoryInputSchema.parse(input);
  if (!isQueryLongEnough(data.query)) return { success: true as const };
  await prisma.searchHistory.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      query: data.query,
    },
  });
  return { success: true as const };
}

export async function recordSearchClickAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "SEARCH_HISTORY_READ");
  const data = searchResultClickInputSchema.parse(input);
  await prisma.searchHistory.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      query: data.query,
      resultType: data.resultType as SearchEntityType,
      resultId: data.resultId,
      resultTitle: data.resultTitle,
      clicked: true,
    },
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SEARCH_RESULT_OPENED",
    entityType: data.resultType,
    entityId: data.resultId,
    entityLabel: data.resultTitle,
  });
  return { success: true as const };
}

export async function listRecentSearchesAction() {
  const user = await requireAuth();
  requirePermission(user, "SEARCH_HISTORY_READ");
  const rows = await prisma.searchHistory.findMany({
    where: { organizationId: user.organizationId, userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const seen = new Set<string>();
  const unique: { query: string; clicked: boolean; createdAt: Date }[] = [];
  for (const row of rows) {
    const key = row.query.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ query: row.query, clicked: row.clicked, createdAt: row.createdAt });
    if (unique.length >= 10) break;
  }
  return unique;
}

export async function clearRecentSearchesAction() {
  const user = await requireAuth();
  requirePermission(user, "SEARCH_HISTORY_CLEAR");
  await prisma.searchHistory.deleteMany({
    where: { organizationId: user.organizationId, userId: user.id },
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "SEARCH_HISTORY_CLEARED",
    entityType: "SearchHistory",
    entityLabel: "Historique effacé",
  });
  revalidatePath("/search");
  return { success: true as const };
}

export async function listFavoriteEntitiesAction() {
  const user = await requireAuth();
  requirePermission(user, "FAVORITES_READ");
  return prisma.favoriteEntity.findMany({
    where: { organizationId: user.organizationId, userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function addFavoriteEntityAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "FAVORITES_UPDATE");
  const data = addFavoriteEntityInputSchema.parse(input);
  const existing = await prisma.favoriteEntity.findFirst({
    where: {
      organizationId: user.organizationId,
      userId: user.id,
      entityType: data.entityType as SearchEntityType,
      entityId: data.entityId,
    },
  });
  if (existing) return { success: true as const, favorite: existing };

  const count = await prisma.favoriteEntity.count({
    where: { organizationId: user.organizationId, userId: user.id },
  });
  if (count >= 20) {
    throw new Error("Limite de 20 favoris atteinte");
  }

  const favorite = await prisma.favoriteEntity.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      entityType: data.entityType as SearchEntityType,
      entityId: data.entityId,
      title: data.title,
      subtitle: data.subtitle,
      href: data.href,
    },
  });
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "FAVORITE_ENTITY_ADDED",
    entityType: "FavoriteEntity",
    entityId: favorite.id,
    entityLabel: data.title,
  });
  return { success: true as const, favorite };
}

export async function removeFavoriteEntityAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "FAVORITES_UPDATE");
  const data = removeFavoriteEntityInputSchema.parse(input);
  if (data.id) {
    await prisma.favoriteEntity.deleteMany({
      where: { id: data.id, organizationId: user.organizationId, userId: user.id },
    });
  } else if (data.entityType && data.entityId) {
    await prisma.favoriteEntity.deleteMany({
      where: {
        organizationId: user.organizationId,
        userId: user.id,
        entityType: data.entityType as SearchEntityType,
        entityId: data.entityId,
      },
    });
  }
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "FAVORITE_ENTITY_REMOVED",
    entityType: "FavoriteEntity",
    entityLabel: data.entityId ?? data.id ?? "",
  });
  return { success: true as const };
}

export async function toggleFavoriteEntityAction(input: Record<string, unknown>) {
  const user = await requireAuth();
  requirePermission(user, "FAVORITES_UPDATE");
  const data = addFavoriteEntityInputSchema.parse(input);
  const existing = await prisma.favoriteEntity.findFirst({
    where: {
      organizationId: user.organizationId,
      userId: user.id,
      entityType: data.entityType as SearchEntityType,
      entityId: data.entityId,
    },
  });
  if (existing) {
    await removeFavoriteEntityAction({ entityType: data.entityType, entityId: data.entityId });
    return { success: true as const, favorited: false };
  }
  await addFavoriteEntityAction(input);
  return { success: true as const, favorited: true };
}

export async function openGlobalSearchAction() {
  const user = await requireAuth();
  if (!hasPermission(user, "GLOBAL_SEARCH_USE")) return;
  await createAuditLog({
    organizationId: user.organizationId,
    userId: user.id,
    action: "GLOBAL_SEARCH_OPENED",
    entityType: "Search",
    entityLabel: "Palette ouverte",
  });
}
