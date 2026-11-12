-- Anonymous product metrics (City Route). No names, e-mails, place names or locations.
-- device = truncated SHA-256 of a random per-device id; it only tells "same device came back".
CREATE TABLE IF NOT EXISTS metric_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,          -- YYYY-MM-DD (UTC)
  at TEXT NOT NULL,           -- ISO timestamp
  type TEXT NOT NULL,         -- one of the allow-listed events in metrics.js
  city TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  n INTEGER                   -- optional count (e.g. places in a pasted list)
);
CREATE INDEX IF NOT EXISTS metric_events_day_type ON metric_events(day,type);
