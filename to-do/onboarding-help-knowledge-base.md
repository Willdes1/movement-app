# Onboarding Help + Internal Knowledge Base + AI "Ask the App"

> Captured from Will 2026-06-30. **Priority idea — revisit before/with onboarding.**

## The vision (one content source → three surfaces)
Keep all "how this feature works" help text in ONE structured store (a `.md` /
DB table of help entries, keyed by UI element / feature). That single source powers:

1. **Contextual hover hints (first-use onboarding).** When a user hovers an item they
   haven't used yet, show a short tooltip explaining what it does *before* they click.
   - Track per-user "have they used/clicked this element yet?" (e.g. a `user_feature_seen`
     table or localStorage keyed by feature id). Un-used → show the hint; once used → the
     hint fades away. When they've used everything, hints stop entirely. Gentle, self-completing
     onboarding (same "vanish when done" spirit as the curation panels).

2. **Internal Knowledge Base (FAQ / how-to).** A browsable KB of "how do I use X" entries
   for the platform — for users and coaches. Same content that feeds the tooltips.

3. **AI "Ask the App" chat.** A "Come here and chat" surface: user asks a question in
   natural language → AI answers from the KB (RAG over the help content). Cheap because the
   corpus is our own internal help text — small, controlled, no hallucination risk if grounded.
   - Mirrors the existing APIE / admin knowledge-search pattern (pgvector + retrieve + answer).

## Why it's worth it
- Reduces support load + confusion (the exact friction we keep hitting while testing).
- Onboarding that teaches by doing, then gets out of the way.
- The AI chat is a differentiator and reuses infra we already have (embeddings + retrieval).

## Build notes / how it slots in
- Content store first: a `help_entries` table (or `.md` files) — { feature_id, title, body,
  tags }. This is the single source for all three surfaces.
- Tooltips: a small `<HelpHint featureId="...">` wrapper + `user_feature_seen` tracking.
- KB page: list/search of help_entries.
- AI chat: embed help_entries → pgvector → retrieve + answer (reuse `retrieveKnowledge` pattern).
- Ties to the admin Study Hub / knowledge infra already built.

## Sequencing
Do this AROUND the onboarding work (it IS onboarding, done well). Not blocking the coached-mode
epic — but flagged priority so it's not forgotten.
