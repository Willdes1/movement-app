# /nite — Close for the Night

Run the standard end-of-session wrap-up for this project:

1. **Git stats** — run `node scripts/git-stats.js` and commit `lib/git-stats.json` with message "Update git-stats: [N] commits / [N] active days"

2. **AGENT_CONTEXT.md** — update section 4 ("What Was Built This Session") with a concise summary of everything built in this conversation. Update section 11 ("What to Work on Next") to reflect current priorities.

3. **Launchpad** — if anything was completed this session that isn't already in the `BUILT` array in `components/admin/LaunchpadTab.tsx`, add a one-line entry describing it.

4. **Memory** — save any new user preferences, project decisions, or feedback from this session to the memory system at `C:\Users\1will\.claude\projects\c--Dev-movement-app\memory\`.

5. **Commit and push** — stage and commit all changes (AGENT_CONTEXT.md, LaunchpadTab.tsx, git-stats.json, any memory files) with a clear commit message, then push to GitHub so Vercel deploys.

6. **Sign off** — tell the user what was committed and pushed, and what the top priority is for next session.
