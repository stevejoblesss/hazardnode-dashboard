-- Create table for node_reports
-- Run this on your Supabase Postgres database

CREATE TABLE IF NOT EXISTS node_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  node_id INTEGER NOT NULL,
  temp NUMERIC,
  hum NUMERIC,
  pitch NUMERIC,
  roll NUMERIC,
  smoke_analog NUMERIC,
  smoke_digital BOOLEAN,
  danger BOOLEAN,
  inserted_at TIMESTAMPTZ DEFAULT now()
);
