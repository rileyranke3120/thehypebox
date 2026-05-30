-- Migration: Security Audit 4 — atomic rate limiters, account lockout, new rate-limit tables
-- Run this before deploying the fourth security audit fixes.

-- ── New tables ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_rate_limits (
  ip TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_daily_limits (
  ip TEXT NOT NULL,
  day TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (ip, day)
);

CREATE TABLE IF NOT EXISTS contact_rate_limits (
  ip TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS checkout_rate_limits (
  ip TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  ip TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL
);

-- ── Account lockout columns ──────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- ── Atomic rate-limit stored procedures ─────────────────────────────────────
-- Each returns TRUE if the request is allowed, FALSE if rate-limited.
-- Uses FOR UPDATE to prevent the read-then-write race condition.

CREATE OR REPLACE FUNCTION check_and_increment_chat_rate_limit(
  p_ip TEXT,
  p_max INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_hits INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  SELECT hits, window_start INTO v_hits, v_window_start
  FROM chat_rate_limits WHERE ip = p_ip FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO chat_rate_limits(ip, hits, window_start) VALUES(p_ip, 1, NOW())
    ON CONFLICT (ip) DO UPDATE SET hits = 1, window_start = NOW();
    RETURN TRUE;
  END IF;

  IF EXTRACT(EPOCH FROM (NOW() - v_window_start)) > p_window_seconds THEN
    UPDATE chat_rate_limits SET hits = 1, window_start = NOW() WHERE ip = p_ip;
    RETURN TRUE;
  END IF;

  IF v_hits >= p_max THEN RETURN FALSE; END IF;

  UPDATE chat_rate_limits SET hits = hits + 1 WHERE ip = p_ip;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION check_and_increment_chat_daily_limit(
  p_ip TEXT,
  p_day TEXT,
  p_max INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_hits INTEGER;
BEGIN
  SELECT hits INTO v_hits
  FROM chat_daily_limits WHERE ip = p_ip AND day = p_day FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO chat_daily_limits(ip, day, hits) VALUES(p_ip, p_day, 1)
    ON CONFLICT (ip, day) DO UPDATE SET hits = 1;
    RETURN TRUE;
  END IF;

  IF v_hits >= p_max THEN RETURN FALSE; END IF;

  UPDATE chat_daily_limits SET hits = hits + 1 WHERE ip = p_ip AND day = p_day;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION check_and_increment_contact_rate_limit(
  p_ip TEXT,
  p_max INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_hits INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  SELECT hits, window_start INTO v_hits, v_window_start
  FROM contact_rate_limits WHERE ip = p_ip FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO contact_rate_limits(ip, hits, window_start) VALUES(p_ip, 1, NOW())
    ON CONFLICT (ip) DO UPDATE SET hits = 1, window_start = NOW();
    RETURN TRUE;
  END IF;

  IF EXTRACT(EPOCH FROM (NOW() - v_window_start)) > p_window_seconds THEN
    UPDATE contact_rate_limits SET hits = 1, window_start = NOW() WHERE ip = p_ip;
    RETURN TRUE;
  END IF;

  IF v_hits >= p_max THEN RETURN FALSE; END IF;

  UPDATE contact_rate_limits SET hits = hits + 1 WHERE ip = p_ip;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION check_and_increment_checkout_rate_limit(
  p_ip TEXT,
  p_max INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_hits INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  SELECT hits, window_start INTO v_hits, v_window_start
  FROM checkout_rate_limits WHERE ip = p_ip FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO checkout_rate_limits(ip, hits, window_start) VALUES(p_ip, 1, NOW())
    ON CONFLICT (ip) DO UPDATE SET hits = 1, window_start = NOW();
    RETURN TRUE;
  END IF;

  IF EXTRACT(EPOCH FROM (NOW() - v_window_start)) > p_window_seconds THEN
    UPDATE checkout_rate_limits SET hits = 1, window_start = NOW() WHERE ip = p_ip;
    RETURN TRUE;
  END IF;

  IF v_hits >= p_max THEN RETURN FALSE; END IF;

  UPDATE checkout_rate_limits SET hits = hits + 1 WHERE ip = p_ip;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION check_and_increment_auth_rate_limit(
  p_ip TEXT,
  p_max INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN LANGUAGE plpgsql AS $$
DECLARE
  v_hits INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  SELECT hits, window_start INTO v_hits, v_window_start
  FROM auth_rate_limits WHERE ip = p_ip FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO auth_rate_limits(ip, hits, window_start) VALUES(p_ip, 1, NOW())
    ON CONFLICT (ip) DO UPDATE SET hits = 1, window_start = NOW();
    RETURN TRUE;
  END IF;

  IF EXTRACT(EPOCH FROM (NOW() - v_window_start)) > p_window_seconds THEN
    UPDATE auth_rate_limits SET hits = 1, window_start = NOW() WHERE ip = p_ip;
    RETURN TRUE;
  END IF;

  IF v_hits >= p_max THEN RETURN FALSE; END IF;

  UPDATE auth_rate_limits SET hits = hits + 1 WHERE ip = p_ip;
  RETURN TRUE;
END;
$$;
