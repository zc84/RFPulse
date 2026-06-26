-- Migration: allow deals to be created without a known budget.
-- Run this against an existing database to apply schema changes without data loss.

ALTER TABLE deals
  ALTER COLUMN budget DROP NOT NULL;
