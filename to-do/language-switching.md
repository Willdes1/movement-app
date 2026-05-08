# Language Switching (i18n)

## Goal
Allow users to switch the app's UI language, starting with Spanish. Future languages added as user base grows.

---

## Phase 1 — English + Spanish

**Target users for Spanish launch:**
- Latin American athletes (skateboarding, soccer, MMA community)
- US bilingual users
- Spanish-speaking coaches and PTs

---

## Technical Approach

**Recommended: next-intl**
- Purpose-built for Next.js App Router
- File-based translation keys (`messages/en.json`, `messages/es.json`)
- Works with server and client components
- Lightweight, no external service needed for static strings

**NOT recommended for Phase 1:**
- Google Translate API (machine translation for UI = inconsistent quality)
- i18next (heavier, more config than needed)

---

## What Gets Translated

| Content Type | Approach |
|---|---|
| UI labels, buttons, nav, errors | Translation files (next-intl) |
| Static page text (TOS, Privacy, onboarding) | Translation files |
| AI-generated content (plans, coaching cues, feed) | Claude prompt includes language instruction |
| User-entered content (bio, notes) | Not translated — shown as-is |
| Exercise names | Translation file for display names; keep normalized English key for DB |

For AI-generated content: append to system prompt — `"Respond entirely in [language]. Use [language] for all exercise names, coaching cues, and labels."`

---

## Language Selector
- Setting in `/account` — "Language" dropdown: English / Español (more coming)
- Saved to `profiles.preferred_language`
- Applied on every page load via middleware

Schema:
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'en'
  CHECK (preferred_language IN ('en', 'es'));
```

---

## Translation File Structure

```
messages/
  en.json   — English (source of truth)
  es.json   — Spanish
```

Example keys:
```json
{
  "nav": {
    "today": "Today",
    "plan": "My Plan",
    "log": "Log",
    "forYou": "For You"
  },
  "plan": {
    "generate": "Generate My Plan",
    "generating": "Building your plan...",
    "week": "Week"
  }
}
```

---

## Build Phases
1. Install next-intl, configure middleware and routing
2. Extract all hardcoded English strings to `messages/en.json`
3. Translate to `messages/es.json` (use Claude for draft, human review recommended)
4. Language selector in `/account`, saved to profiles
5. Update AI prompts to respond in user's preferred language
6. QA: full app walkthrough in Spanish mode
7. Future: add Portuguese, French, Japanese based on user demand

---

## Notes
- Keep all DB content in English (normalized keys) — language is a display-layer concern only
- Sport-specific terminology in Spanish should use athlete-native terms, not literal translations (e.g. "deadlift" stays "peso muerto", not a literal translation)
- AI-generated exercise instructions in Spanish should be reviewed by a native speaker before F&F beta in Spanish
