-- Churn insight for the "before you go" account-deletion flow.
-- Written server-side (service role) by /api/account/delete right before the
-- account is wiped. Intentionally NOT linked to a user id — the user is being
-- deleted, and we only want anonymous, aggregate reasons for product insight.
CREATE TABLE IF NOT EXISTS account_deletion_feedback (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reason     text,          -- too_pricey | no_time | not_for_me | technical | privacy | other
  detail     text,          -- optional free-text the user typed
  role       text,          -- coarse segmentation (free / beta / ff / coach)
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE account_deletion_feedback ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies — service role only (deny-by-default for everyone else).
GRANT SELECT, INSERT ON public.account_deletion_feedback TO service_role;
