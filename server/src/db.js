import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  join_code TEXT UNIQUE NOT NULL,
  teacher_passcode_hash TEXT NOT NULL,
  turns_unlocked INTEGER NOT NULL DEFAULT 1, -- capped from the start; the teacher advances this as students complete work
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS civilizations (
  id SERIAL PRIMARY KEY,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  civ_name TEXT,
  language_name TEXT,
  turn_number INTEGER NOT NULL DEFAULT 1,
  resources JSONB NOT NULL DEFAULT '{"nourriture":0,"production":0,"argent":0,"science":0,"culture":0}',
  bonheur_index INTEGER NOT NULL DEFAULT 2,
  croyance TEXT,
  gouvernance TEXT,
  owned_cards JSONB NOT NULL DEFAULT '[]',
  built_districts JSONB NOT NULL DEFAULT '[]',
  map JSONB NOT NULL DEFAULT '[]',
  journal JSONB NOT NULL DEFAULT '[]',
  event_state JSONB NOT NULL DEFAULT '{}',
  turn_state JSONB NOT NULL DEFAULT '{}',
  tutorial_seen BOOLEAN NOT NULL DEFAULT false,
  onboarded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_name)
);

-- Additive migrations for columns introduced after the tables first shipped.
-- ADD COLUMN IF NOT EXISTS is a no-op once the column already exists, so a
-- later default-value change (like the 999999 -> 1 turn-pacing default) needs
-- its own explicit ALTER COLUMN to actually take effect on existing databases.
ALTER TABLE classes ADD COLUMN IF NOT EXISTS turns_unlocked INTEGER NOT NULL DEFAULT 1;
ALTER TABLE classes ALTER COLUMN turns_unlocked SET DEFAULT 1;
ALTER TABLE civilizations ADD COLUMN IF NOT EXISTS turn_state JSONB NOT NULL DEFAULT '{}';
`;

export async function initSchema() {
  await pool.query(SCHEMA);
}

export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
