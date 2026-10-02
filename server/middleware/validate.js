// Request validation.
//
// validate(schema) checks req.body against a zod schema and answers 400 with a
// readable message when it doesn't match. Schemas check types and sizes only;
// "required field" messages stay in the controllers, which already word them
// for the UI. The body is not modified.

const describe = (issue) =>
  issue.path.length
    ? `Invalid ${issue.path.join(".")}: ${issue.message}`
    : issue.message;

export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (result.success) return next();

  const { issues } = result.error;
  const message = describe(issues[0]);
  return res.status(400).json({
    message,
    ErrorMessage: message, // the users pages read ErrorMessage
    ErrorState: true,
    errors: issues.slice(0, 10).map((i) => ({
      path: i.path.join("."),
      message: i.message,
    })),
  });
};

// Query strings must be plain values. Express parses ?a[b]=c into objects,
// which would otherwise flow into Sequelize where-clauses.
export const rejectNestedQuery = (req, res, next) => {
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value !== "string") {
      return res
        .status(400)
        .json({ message: `Invalid query parameter: ${key}` });
    }
  }
  next();
};
