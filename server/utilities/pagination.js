// Page and page size from the query string, clamped so one request can't ask
// for an unbounded number of rows. The UI's tables offer up to 100 rows per
// page; the user list allows more because the Forms page loads it whole to
// pick approvers.
export const DEFAULT_MAX_PAGE_SIZE = 100;

export const getPagination = (
  query,
  { maxPageSize = DEFAULT_MAX_PAGE_SIZE } = {},
) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, parseInt(query.pageSize) || 10),
  );
  return { page, pageSize, offset: (page - 1) * pageSize };
};
