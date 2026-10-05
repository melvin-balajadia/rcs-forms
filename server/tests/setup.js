// Fixed secrets for tests. Set before the app loads; dotenv never overrides
// variables that already exist, so a local .env can't leak into tests.
process.env.ACCESS_TOKEN_SECRET = "test-access-secret";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret";
