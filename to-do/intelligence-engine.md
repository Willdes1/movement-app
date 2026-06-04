# Atlas Prime Intelligence Engine (APIE)
## Architecture Brief & Build Plan

---

## Proper Technical Naming

Going forward, use these terms:

| What you've been calling it | Correct technical term |
|---|---|
| "The brain" or "the engine" | **Atlas Prime Intelligence Engine (APIE)** |
| "Internal knowledge library" | **Domain Knowledge Store (DKS)** |
| "AI pulls from its own knowledge" | **RAG — Retrieval-Augmented Generation** |
| "Multiple expert AI brains" | **Multi-Agent Agentic Pipeline** |
| "Stores and retrieves knowledge like a human" | **Vector Database + Semantic Search** |
| "Update-monitoring agent" | **Knowledge Curator Agent** |
| "Main coordinator agent" | **Orchestrator Agent** |
| "Checks the output for errors" | **Critic / Verification Agent** |

**Full system name:** Atlas Prime Intelligence Engine (APIE)
**Architecture type:** Multi-Agent Agentic RAG Pipeline
**Short reference in conversation:** "the APIE" or "the engine"

---

## What We Currently Have (as of 2026-05-07)

Five live single-pass AI APIs:
1. `generate-plan` — 7-day week of a 13-week periodized program
2. `generate-exercise-details` — Technique cues, cached in exercise_library
3. `generate-feed` — 6 personalized content cards (sport tips + warrior mindset)
4. `generate-recovery-plan` — Multi-phase injury recovery playbook
5. `generate-return-to-sport` — Sport-specific return-to-play progression

**What the current brain does NOT do:**
- No RAG — generates from scratch every time, no knowledge retrieval
- No multi-agent — single Claude call per request, no verification pass
- No persistent memory — each generation starts from zero context
- No knowledge base — expertise is baked into prompts, not a stored library
- No cross-plan coordination — recovery and training plans are independent
- No feedback loop — user outcomes don't improve future generations

---

## The Vision: What the APIE Becomes

### The Knowledge Architecture — How a Human Expert Works vs. How the APIE Works

A certified trainer spends years studying: NASM, ISSA, NSCA, CSCS, DPT programs, peer-reviewed journals, coaching systems, sport-specific clinics. They store all of this in their head and apply it when working with a client. They don't Google "how to program for a skateboarder" every session — they already know.

The APIE replicates this at scale:

```
[Domain Knowledge Store]
       ↓  (RAG — semantic retrieval)
[Orchestrator Agent]
       ↓  (routes to specialists)
[Agent Council]  ←→  [Critic Agent]
       ↓
[Plan Output]
```

---

## Agent Council — Roles & Responsibilities

### 1. Orchestrator Agent
- Receives user profile (sport, goal, training level, injuries, background, activities)
- Queries the Domain Knowledge Store for relevant knowledge chunks
- Routes context to each specialist agent
- Assembles final output from all agent responses
- Runs final coherence check before sending to client

### 2. Strength & Conditioning Agent
- Expert in: NSCA/CSCS principles, periodization, progressive overload, exercise selection, volume/intensity management
- Responsible for: Main workout block structure, rep/set schemes, loading progressions across 13 weeks
- Knowledge domains: Powerlifting, hypertrophy, athletic strength, functional training

### 3. Mobility & Movement Specialist Agent
- Expert in: FRC (Functional Range Conditioning), DNS, PRI, corrective exercise, joint health
- Responsible for: Warmup block, cooldown block, morning mobility (especially for recovery users)
- Knowledge domains: Joint capsule health, movement patterns, fascial systems, mobility progressions

### 4. Physical Therapy / Rehab Agent
- Expert in: Injury mechanisms, contraindications, pain science, tissue healing timelines
- Responsible for: Contraindication enforcement, injury-aware exercise substitution, recovery phase design
- Critical rule: This agent has VETO power — it can override any other agent's exercise selection if it violates injury safety
- Knowledge domains: Orthopedic PT, sports medicine, pain neuroscience, return-to-sport criteria

### 5. Sports Specialist Agent
- Expert in: Movement demands, energy systems, periodization requirements, and skill development across every major sport and activity
- Sports covered (initial list, expandable): skateboarding, snowboarding, golf, tennis, pickleball, basketball, soccer, football, baseball, volleyball, swimming, cycling, running, MMA/combat sports, gymnastics, derby, hockey, lacrosse, rugby, climbing, CrossFit, Olympic lifting, powerlifting, bodybuilding, dance, cheerleading, equestrian, and more
- Responsible for: Sport-specific movement prep, skill-transfer exercises, sport-schedule integration, in-season vs. off-season periodization
- Communicates with: Strength agent (to align loading with sport demands), PT agent (sport-specific injury patterns), Recovery agent (sport-specific recovery protocols)

### 6. Recovery & Performance Agent
- Expert in: HRV, sleep science, soft tissue recovery, deload programming, readiness assessment
- Responsible for: Recovery block design, deload week insertion, fatigue management across phases
- Future integration: Oura Ring / Apple Watch readiness data

### 7. Mindset & Performance Psychology Agent
- Expert in: Japanese warrior philosophy (Mushin, Kaizen, Shokunin, Zanshin, Fudoshin), sport psychology, visualization, arousal regulation
- Responsible for: Mindset content (For You feed), motivational coaching cues embedded in plan commentary
- Note: This agent already exists as a partial implementation in `generate-feed`. Needs to be formalized into the council.

### 8. Nutrition Agent (Phase 3 — separate track)
- Expert in: Sports nutrition, macronutrient periodization, meal timing, supplementation
- Responsible for: Meal plan generation synchronized to training phase and intensity
- Note: This agent gets its own dedicated brief. It may become a separate sub-engine with its own DKS layer.

### 9. Critic / Verification Agent
- Receives assembled plan output from Orchestrator
- Checks against a validation ruleset:
  - Exercise ordering (warmup before loading, cooldown after)
  - No contraindicated exercises given injury history
  - Phase-appropriate intensity (not too hard in Foundation, not too easy in Peak)
  - Equipment compliance (no equipment the user doesn't have)
  - Session length compliance (within user's stated time budget)
  - Coaching cue accuracy
- Returns: PASS or a list of specific corrections → Orchestrator re-runs affected blocks
- This agent does NOT generate content — it only validates

### 10. Knowledge Curator Agent (Phase 4 — async/background)
- Runs on a schedule (weekly or monthly), not on user request
- Monitors: New research publications, certification program updates, coaching methodology changes, injury science updates
- Sources: PubMed API, NSCA/NASM/ISSA publication feeds, respected coach/researcher output
- Workflow: Flags potential updates → presents to admin for review → admin approves → new chunks embedded into DKS
- Similar to how a school or certification program sends out "what we taught before has changed" notices

---

## Domain Knowledge Store (DKS) — The Internal Library

### What Goes In

**Tier 1 — Foundational Science (highest reliability)**
- NSCA CSCS textbook knowledge (strength & conditioning principles)
- NASM/ISSA/ACE CPT core curriculum
- ACSM guidelines for exercise testing and prescription
- Physical therapy: orthopedic PT clinical practice guidelines
- Kinesiology: biomechanics, motor learning, anatomical foundations
- Sports medicine: tissue healing science, injury classification

**Tier 2 — Advanced & Specialized**
- CSCS Advanced Sports Conditioning
- FRC (Functional Range Conditioning) principles
- DNS (Dynamic Neuromuscular Stabilization)
- PRI (Postural Restoration Institute)
- Periodization science: Bompa, Issurin, Zatsiorsky frameworks
- Pain neuroscience: Lorimer Moseley, NOI Group

**Tier 3 — Sport-Specific Expertise**
- Each sport's movement demands, common injury patterns, periodization needs
- Skateboarding, snowboarding, golf, combat sports, team sports, endurance
- Sources: Sport-specific coaching certifications, biomechanical research

**Tier 4 — Credible Practitioners**
- Squat University (Aaron Horschig) — barbell mechanics, injury prevention
- Jeremy Ethier — evidence-based hypertrophy programming
- Renaissance Periodization (Dr. Mike Israetel) — volume landmarks, RIR
- Knees Over Toes (ATG) — knee/hip longevity progressions
- Athlean-X (Jeff Cavaliere) — corrective exercise, biomechanics
- Bob & Brad / E3 Rehab / [P]rehab — clinical rehab protocols
- Huberman Lab — sleep/recovery science
- (Expandable list — admin can add/remove sources)

### How the DKS Works Technically

```
[Source Document / Knowledge Chunk]
       ↓
[Embedding Pipeline]  →  text-embedding-3-small or Voyage AI
       ↓
[pgvector in Supabase]  ←→  metadata (domain, source, tier, last_verified)
       ↓
[Semantic Search Query]  ←  user profile + request context
       ↓
[Top-K relevant chunks returned]
       ↓
[Injected into agent prompts as context]
```

### Schema (new tables needed)

```sql
CREATE TABLE mie_knowledge_chunks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        text NOT NULL,  -- 'strength', 'mobility', 'pt', 'sports', 'recovery', 'nutrition'
  source        text NOT NULL,  -- 'NSCA_CSCS', 'squat_university', 'pubmed_12345', etc.
  tier          int NOT NULL CHECK (tier BETWEEN 1 AND 4),
  title         text,
  content       text NOT NULL,
  embedding     vector(1536),   -- text-embedding-3-small dimensions
  sport_tags    text[],         -- ['skateboarding', 'golf'] or empty for universal
  verified_at   timestamptz NOT NULL DEFAULT now(),
  flagged_for_review boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON mie_knowledge_chunks USING ivfflat (embedding vector_cosine_ops);

CREATE TABLE mie_generation_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES auth.users(id),
  trigger         text,  -- 'plan_generate', 'recovery_plan', 'return_to_sport'
  chunks_used     uuid[],  -- which knowledge chunks were retrieved
  agents_involved text[],  -- which agents ran
  total_tokens    int,
  input_tokens    int,
  output_tokens   int,
  latency_ms      int,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

---

## Token Efficiency Strategy

### Current State (as of 2026-05-07)
- ~6,500–8,000 tokens per initial user setup (plan + exercise details + feed)
- No caching at the knowledge level — everything regenerated from scratch

### APIE Token Efficiency Approach

**1. Profile Signature Caching**
Hash the user's profile fields → if the same profile generated a plan recently, retrieve cached structure instead of regenerating. Only re-run agents for changed fields.

**2. Knowledge Chunk Retrieval (RAG) replaces long prompts**
Instead of baking all expertise into the system prompt, retrieve only the relevant 3-5 knowledge chunks per agent. 500-token retrieval vs. 3,000-token hardcoded prompt.

**3. Exercise Library as L1 Cache**
Already implemented — exercise details generated once, cached forever. Extend this pattern to: sport-specific warm-up sequences, phase templates, recovery protocols.

**4. Agent Specialization = Smaller Prompts**
Each specialist agent only needs expertise in its domain. A Strength Agent doesn't need PT knowledge in its context window. Smaller, focused prompts = lower token cost per agent.

**5. Critic Agent = Catch-and-Fix (not Regenerate-All)**
Critic flags specific blocks. Only flagged blocks are re-run, not the entire plan. Estimated savings: 60-70% of regeneration cost when critic fires.

---

## Build Phases

### Phase 0 (Immediate — do now)
**Inject existing profile fields into current plan prompt**
- training_level, workout_background, activities already in DB
- Add them to `buildPrompt()` in `generate-plan/route.ts`
- Zero infrastructure cost, immediate quality improvement
- **Status: NEXT ACTION**

### Phase 1 — Foundation (4–6 weeks)
**Build the Domain Knowledge Store**
- Set up pgvector extension in Supabase
- Build embedding pipeline (script to chunk, embed, and store knowledge)
- Seed Tier 1 content (NSCA/NASM core principles, key sport demands)
- Build admin UI for browsing, adding, and flagging knowledge chunks
- Build semantic search function for querying chunks

### Phase 2 — Agent Council v1 (4–6 weeks)
**Implement Orchestrator + 3 core agents**
- Orchestrator Agent
- Strength & Conditioning Agent (with DKS retrieval)
- Physical Therapy / Rehab Agent (with veto logic)
- Critic / Verification Agent
- Wire into existing `generate-plan` route as a drop-in upgrade
- A/B compare output quality vs. single-pass current system

### Phase 3 — Full Council (4–6 weeks)
**Add remaining specialists**
- Mobility Agent
- Sports Specialist Agent (with full sport taxonomy)
- Recovery Agent
- Mindset Agent (formalize existing feed generator)
- Connect all agents through Orchestrator
- Extend to `generate-recovery-plan` and `generate-return-to-sport`

### Phase 4 — Curator & Continuous Learning (ongoing)
**Knowledge Curator Agent**
- Background job that monitors knowledge sources
- Admin review workflow for flagged updates
- Knowledge chunk versioning (old chunk archived, new chunk takes precedence)
- Generation log analytics (which chunks get retrieved most → prioritize quality there)

### Phase 5 — Coach Portal Integration
**APIE powers the Coach Portal plan generator**
- Coaches specify client context → same agent council runs
- Coach can see which agents influenced which parts of the plan
- Coach override: reject an agent's output and replace manually
- (Separate brief — discussed when coach portal Step 6 is in scope)

---

## What We Need Before Starting Phase 1

1. pgvector enabled in Supabase (check if already enabled: `SELECT * FROM pg_extension WHERE extname = 'vector'`)
2. An embedding API key (OpenAI text-embedding-3-small is cheapest at $0.02/1M tokens, or Voyage AI for domain-specific embeddings)
3. Admin UI for knowledge management (fits inside Admin Portal v2)
4. Decision on knowledge sourcing: we summarize/paraphrase from source material (legally safer) vs. store verbatim excerpts (more precise but requires licensing review)

---

## What This Is NOT

- Not a web scraper that searches the internet at runtime
- Not a fine-tuned model (we don't own or train LLMs)
- Not a replacement for human coaches in clinical situations
- Not a guarantee of medical accuracy — all outputs carry the same fitness-guidance disclaimer

---

## One-Line Summary for Any Stakeholder

> "The Atlas Prime Intelligence Engine is a multi-agent RAG system where a council of specialized AI agents — each grounded in our internal Domain Knowledge Store — collaborates to produce training plans that reflect the combined expertise of a certified strength coach, physical therapist, sports specialist, and recovery expert, rather than a single general-purpose AI."

---

## Smoke Test (end of Phase 3)

1. User profile: skateboarding, intermediate level, left knee restriction, off-season
2. APIE generates plan
3. Inspect generation log → confirm Sports Agent, Strength Agent, PT Agent, Mobility Agent all ran
4. PT Agent should have flagged any knee-loading exercises in early phases
5. Sports Agent should have included skateboarding-specific prep (ankle mobility, hip flexor, upper body for falls)
6. Plan coaching cues should reference skate-specific language, not generic gym language
7. Critic Agent PASS/FAIL log should be visible in admin
8. Token count should be lower than current single-pass baseline for equivalent plan quality
