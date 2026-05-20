-- Migration: Add hidden_subject_rules table
-- Admin can hide specific subjects for specific students from regular users (role 0)

CREATE TABLE IF NOT EXISTS hidden_subject_rules (
    id          BIGSERIAL PRIMARY KEY,
    msv         TEXT NOT NULL,
    subject_key TEXT NOT NULL,
    created_by  BIGINT REFERENCES nick(id) ON DELETE CASCADE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),
    note        TEXT,
    CONSTRAINT uq_hidden_msv_subject UNIQUE (msv, subject_key)
);

CREATE INDEX IF NOT EXISTS idx_hidden_subject_msv ON hidden_subject_rules(msv);
