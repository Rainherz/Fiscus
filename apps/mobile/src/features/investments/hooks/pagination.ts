/** TanStack Query getNextPageParam for offset pages: a short page means there is no next one. */
export function nextPageParam<T>(lastPage: T[], allPages: T[][], pageSize: number): number | undefined {
  return lastPage.length === pageSize ? allPages.length : undefined;
}
