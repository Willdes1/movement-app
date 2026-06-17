# Knowledge Base — Admin Portal Tab
**Priority: HIGH**

## Goal
A founder-facing knowledge base inside the admin portal that teaches the correct industry terminology for every feature we've built. As the platform grows, the founder needs to speak fluently about the product — to investors, coaches, PTs, and press — using the right language. This tab is a living reference and an AI-powered search layer over everything we've built.

---

## Where It Lives
Admin Portal → **"Knowledge Base"** tab (sidebar, Operations group)

---

## What It Contains

### 1. Feature Glossary
Every feature in the platform named, defined, and framed in industry terminology. Example entries:

| Our Feature | Industry Term | What It Means |
|---|---|---|
| AI plan generator | Personalized Program Generation Engine | AI that produces individualized periodized training plans |
| APIE | Multi-Agent Agentic RAG Pipeline | A council of specialized AI agents grounded in a curated Domain Knowledge Store |
| Exercise swap modal | Dynamic Exercise Substitution | Real-time replacement of exercises while preserving volume prescription |
| Coach portal | B2B SaaS Professional Portal | Software-as-a-Service tooling for fitness professionals to manage clients |
| Zoom In | Admin Impersonation | Authenticated session escalation for support and QA |
| Assign to client | Program Assignment Workflow | Attaching a structured training protocol to a specific client profile |
| Recovery playbooks | Phase-Based Rehabilitation Protocols | Structured, evidence-based recovery progressions by injury type |
| For You feed | AI-Curated Content Feed | Algorithmically personalized motivational and educational content delivery |

Admin can add, edit, and delete entries over time.

### 2. Industry Term Definitions
A searchable dictionary of fitness tech, SaaS, and business terms the founder needs to know:
- Periodization, progressive overload, RPE, RIR, deload
- TAM/SAM/SOM, CAC, LTV, ARR, MRR, churn rate
- RAG, vector embeddings, agentic pipeline, multi-agent orchestration
- B2B SaaS, white-label, marketplace flywheel, revenue-sharing
- HIPAA, GDPR, CCPA (in context of health data)

### 3. Competitor Quick Reference
One-paragraph summaries of each major competitor with their positioning, price point, and where we beat them. Scannable before a pitch.

---

## AI-Powered Search Bar

At the top of the tab — always visible. Ask anything about the platform or business:

**Example queries:**
- "How do we handle the injury portal?"
- "What's the billing structure for the Coach OS?"
- "What's the difference between our program generator and Fitbod's?"
- "What does periodization mean and how does ours work?"
- "How do I explain the APIE to someone who's never heard of RAG?"

**Response format:**
- Plain language answer (no jargon dumps)
- Industry-correct terminology called out in bold
- "How we implement this" section — specific to our platform
- One-liner you can use in a conversation

**API route:** `POST /api/admin/knowledge-search`
Uses Claude Sonnet 4.6 with system prompt pre-loaded with full platform context.
Token usage logged to `token_usage` with `operation: 'knowledge_search'`.

---

## Schema (for editable glossary entries)

```sql
CREATE TABLE knowledge_base (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category     text NOT NULL DEFAULT 'feature', -- 'feature' | 'term' | 'competitor'
  our_name     text,          -- what we call it internally
  industry_name text,         -- what the industry calls it
  definition   text NOT NULL,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kb_admin" ON knowledge_base FOR ALL TO authenticated
  USING ((SELECT is_admin FROM profiles WHERE id = auth.uid()))
  WITH CHECK ((SELECT is_admin FROM profiles WHERE id = auth.uid()));
```

---

## Build Phases
1. Static glossary — hard-coded feature list + industry terms, searchable client-side
2. AI search bar — API route + conversational interface
3. Editable entries — CRUD UI for glossary (admin adds/edits entries)
4. Competitor quick-reference section
5. Export — download full glossary as PDF for pitch prep
