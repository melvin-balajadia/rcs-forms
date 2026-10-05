// A user's sessions are tied to their roles: access tokens carry this
// fingerprint, and verifyJWT rejects a token once the roles no longer match.
export const rolesFingerprint = (user) =>
  [...(Array.isArray(user?.user_groups) ? user.user_groups : [])]
    .sort()
    .join(",");
