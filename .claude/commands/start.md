# /start — Begin a New Session

Run this at the start of every new conversation to get fully briefed before doing any work.

1. **Read AGENT_CONTEXT.md** — full project briefing: what was built last session, current architecture, key patterns, pending SQL migrations, and what to work on next.

2. **Read memory/MEMORY.md** — scan the index, then read any memory files that are relevant to today's work (project state, user preferences, feedback).

3. **Check for pending SQL migrations** — look at section 4 of AGENT_CONTEXT.md for any "Pending SQL Migrations" listed. If there are any, surface them immediately so the user knows to run them before building features that depend on them.

4. **Brief the user** — in a short, punchy summary (no walls of text), tell the user:
   - What was built last session (2–4 bullet points max)
   - What the top 3 priorities are right now
   - Any pending SQL migrations that still need to be run
   - One question if anything is unclear about direction

Do not start building anything until the user confirms what they want to work on.
