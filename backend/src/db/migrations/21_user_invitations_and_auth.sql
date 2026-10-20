-- Migration 21: User invitations, initial password setup, and password reset
ALTER TABLE public.app_users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    type VARCHAR(32) NOT NULL DEFAULT 'invitation',
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON public.user_invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_invitations_user ON public.user_invitations(user_id);
