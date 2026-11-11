CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
