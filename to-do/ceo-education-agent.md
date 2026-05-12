# CEO Education Agent
**Priority: HIGH — Build soon**

## Goal
A dedicated tab in the admin portal that functions as a personal education agent for the founder/CEO. The goal is to help you sound sharper in pitch conversations, investor meetings, and client calls — by continuously educating you on your own platform, the competitive landscape, real industry scenarios, and business strategy concepts.

This is not a feature for users. It is an internal tool that makes the founder more dangerous.

---

## Where It Lives
Admin Portal → new **"CEO Briefing"** tab (top-level nav item, high visibility)

---

## Tab 1: Daily Brief

### Format
A full-length article generated fresh on every visit — like a daily intelligence briefing from a startup advisor who knows your product inside and out. Never repeats. Has a **Refresh** button to generate a new one on demand.

### Article Types (randomly selected each load)
Claude picks one type per load, rotates randomly so nothing repeats:

| Type | Description |
|---|---|
| **Industry Deep Dive** | A concept from fitness tech, SaaS, or health tech explained in plain language with examples |
| **Competitor Teardown** | One competitor analyzed in detail — what they do well, where they fall short, how we beat them |
| **Feature Explainer** | One of our own features explained as if you were pitching it to an investor or PT clinic |
| **CEO Scenario** | "You're in a meeting and someone asks X — here's how to answer it confidently" |
| **Market Signal** | A trend in fitness, AI, or health tech — what it means for us and what we should do about it |
| **Business Concept** | A founder/CEO concept (CAC, LTV, TAM/SAM/SOM, moat, flywheel) explained using our platform as the example |
| **Pitch Coach** | Breaks down one section of your pitch (problem, solution, moat, business model) and strengthens it |

### Article Structure
Each article should include:
- **Headline** — punchy, specific (not generic)
- **The 30-Second Version** — 2-3 sentences. What you need to know if someone asks right now.
- **The Full Picture** — 4-8 paragraphs. Real depth. Industry terms used correctly, explained in context.
- **How This Applies to Us** — direct connection to the platform, our positioning, or our roadmap
- **One Line You Can Use** — a single quotable sentence for a pitch or conversation

### Visual Design
- Full-width article layout, like a premium newsletter
- Large headline, clear section dividers
- Color-coded callout boxes for key terms, stats, and "use this line" moments
- Refresh button in top-right corner with a subtle animation
- Shows article type badge (e.g., "COMPETITOR TEARDOWN") and estimated read time

---

## Tab 2: Ask Me Anything

### What It Does
A conversational AI interface — ask anything about the platform, competitors, industry, or business strategy. The agent has full context about the product, roadmap, competitive landscape, and business model baked into its system prompt.

### Example Questions It Can Handle
- "How do coaching platforms usually handle workout generation — manual or AI? How do we compare?"
- "What's the difference between TAM and SAM? What's ours?"
- "If a PT clinic asks me why they should use us instead of Trainerize, what do I say?"
- "Explain periodization like I'm explaining it to someone at a dinner party"
- "What's a 'moat' and do we have one?"
- "How should I describe the MIE to someone who doesn't know what RAG is?"

### Interface
- Clean chat UI — question input at the bottom, response renders above
- Each response includes:
  - **Direct Answer** — plain language, no jargon dumps
  - **Industry Context** — how this fits into the broader landscape
  - **Our Angle** — how it applies to our platform specifically
  - **One-Liner** — a sharp sentence you can quote
- Conversation history persists within the session (not across sessions — this is a briefing tool, not a memory system)
- "Clear & Start Over" button

---

## System Prompt Context (for both tabs)

The agent should be pre-loaded with:
- Full product description (all current features + roadmap)
- MIE architecture (multi-agent RAG pipeline, all 9 agents)
- Business model (B2C + B2B + marketplace)
- Competitive landscape (Nike Training Club, Whoop, Fitbod, Trainerize, TrueCoach, Athlean-X, MyFitnessPal)
- Market data (TAM $96B, CAGR 22.8%, AI health $45B, PT software $3.2B)
- Differentiators (MIE architecture, recovery + training combined, warrior mindset IP, sports specialist, two-sided flywheel)
- Target audiences (B2C: athletes 22-45, injury recovery, fitness enthusiasts; B2B: PTs, trainers, coaches)
- Pricing tiers (when finalized)

---

## API Route
`POST /api/admin/ceo-brief` — generates the daily article
`POST /api/admin/ceo-ask` — handles AMA questions

Both use Claude Sonnet 4.6 with the shared context system prompt.

Token usage should be logged to `token_usage` table with `operation: 'ceo_brief'` or `operation: 'ceo_ask'`.

---

## Build Phases
1. **Tab structure** — CEO Briefing tab with two sub-tabs (Daily Brief / Ask Me Anything)
2. **Daily Brief** — API route + article renderer + refresh button + all 7 article types
3. **Ask Me Anything** — chat interface + conversational API route
4. **Polish** — article type badge, read time estimate, one-liner callout box, visual design
5. **Deferred** — save favorite articles, export to PDF, share as a document

---

## Notes
- This tab is admin-only. No user ever sees it.
- Token costs are acceptable here — this is a founder tool, not a high-volume consumer feature.
- The tone should feel like a brilliant advisor talking to a peer, not a textbook or a customer service bot.
- Never generic. Always specific to this platform, this market, and this founder's situation.
