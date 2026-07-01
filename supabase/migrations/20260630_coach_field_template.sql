-- ─────────────────────────────────────────────────────────────────────────────
-- Coach Field Template (Q1) — the coach's preferred STANDARD instruction-field
-- lineup: which of How/Breathing/Core/Common-Mistakes to show, and in what order.
-- Applied across their whole instruction editor. Null = the default four, in order.
--   Shape: ["how", "core", "tip"]   (omitted = removed; array order = display order)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coach_field_template jsonb;
