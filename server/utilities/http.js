// HTTP plumbing shared by controllers and services.
//
// Services throw HttpError for expected failures (not found, not allowed,
// invalid input) with the exact response body the client should get.
// Controllers wrap their handlers in handle(), which turns an HttpError into
// that response and any other error into a 500 with a generic message.

export class HttpError extends Error {
  constructor(status, body) {
    super(body?.message ?? `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }
}

export const fail = (status, message, extra = {}) => {
  throw new HttpError(status, { message, ...extra });
};

// handler(req, res) returns nothing (it responds itself); errorMessage is the
// 500 message for unexpected errors — details are logged, never sent.
export const handle = (handler, errorMessage) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (err) {
    if (err instanceof HttpError) {
      return res.status(err.status).json(err.body);
    }
    console.error(`${errorMessage}:`, err);
    res.status(500).json({ message: errorMessage });
  }
};
