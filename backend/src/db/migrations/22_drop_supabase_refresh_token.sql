-- Migration 22: Drop legacy supabase_refresh_token column from refresh_tokens table
-- Eliminates residual Supabase schema artifact for 100% native authentication architecture.

ALTER TABLE public.refresh_tokens 
DROP COLUMN IF EXISTS supabase_refresh_token;
