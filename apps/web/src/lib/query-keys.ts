/** Canonical React Query keys for branch-scoped tenant data. */
export const branchQueryKeys = {
  all: (resource: string) => [resource] as const,
  list: (resource: string, branchId: string | null | undefined, suffix?: string) =>
    [resource, { branchId: branchId ?? "all" }, ...(suffix ? [suffix] : [])] as const
};
