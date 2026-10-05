// One password rule for every place a password is set: a user's own reset,
// an admin reset, create user and edit user.
const PASSWORD_RULE = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^a-zA-Z0-9]).{8,}$/;

export const PASSWORD_RULE_MESSAGE =
  "Password must be at least 8 characters and include an uppercase letter, a number, and a special character.";

export const isStrongPassword = (password) =>
  typeof password === "string" && PASSWORD_RULE.test(password);
