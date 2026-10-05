type HttpError = { response?: { status?: number } };

// HTTP status of a failed API call (Axios error), if the server answered
export const statusOf = (error: unknown): number | undefined =>
  (error as HttpError)?.response?.status;

// React Query `retry`: don't retry when the server has answered "not found" or
// "not allowed" — the answer won't change, and retrying keeps the page on a
// spinner for seconds. Other failures (network, 5xx) are retried twice.
export const retryUnlessDenied = (failureCount: number, error: unknown) => {
  const status = statusOf(error);
  return status !== 404 && status !== 403 && failureCount < 2;
};
