# Marketing Hub (Admin Portal) — phased build

The admin **Marketing** tab is the growth engine. Build it in phases. Phase 1 is
live; phases 2 to 4 start as we get closer to launching the business (Will's call).

Copy rule: NO em dashes anywhere in generated copy.

---

## Phase 1 — Content Engine ✅ SHIPPED 2026-07-20
One-click, category-based SEO article generation grounded in the APIE knowledge
store, review-and-publish to the public /blog, per-article metadata + Article
schema + auto-sitemap. Files: components/admin/MarketingTab.tsx, app/blog,
app/api/admin/content, lib/{content,content-clusters,markdown}.ts. SQL:
20260720_content_posts. Strategy: win non-branded intent (the "Atlas Prime"
brand term is owned by the Warframe game; we flank on "AI workout plan",
"coaching software", etc.). Cadence: ~2 quality articles/week, human-in-the-loop.

### Phase 1 follow-ups (nice-to-have, not blocking)
- [x] Scheduled auto-generation (cron) — SHIPPED 2026-07-21. Daily cron
      /api/cron/content: auto-drafts to keep a buffer, you approve into a drip
      queue, approved posts publish on configured days (default Tue+Fri). Settings
      + drip queue in MarketingTab. SQL: 20260721_content_scheduling. Needs
      CRON_SECRET in Vercel env.
- [ ] Programmatic SEO: turn the 750+ exercise library into indexable how-to
      pages (huge indexable surface). Own topic-cluster later.
- [ ] OG image per article (reuse the code-generated card pattern from the
      homepage, per-post title).
- [ ] Internal linking between related posts (topic clusters / pillar pages).

---

## Phase 2 — Lead Investigation
Find and score outbound prospects.
- [ ] Search businesses by industry, local or worldwide: physical therapy
      clinics, personal training studios, commercial gyms, enterprise chains
      (24 Hour Fitness, LA Fitness, etc.).
- [ ] Classify each: Independent / Multi-location / Enterprise. Score the lead.
- [ ] Find owner / decision-maker, email, phone.
- [ ] Export lead lists (CSV).
- Research: which data source/API is compliant and affordable (Google Places,
  scraping legality, paid B2B data providers). Decide before building.

## Phase 3 — AI Outreach
Prepare everything so outreach is one click, even if sending is manual.
- [ ] AI-generated outreach templates + personalized email generation.
- [ ] Smarter Mailchimp-style sender that reduces Gmail/Outlook deliverability
      issues (warmup, SPF/DKIM/DMARC guidance, send throttling).
- [ ] Personalized DMs for trainers found on social; suggest outreach per coach
      profile.
- [ ] Cold-call scripts, SMS drafts.
- [ ] Dedicated agents: lead gen, prospect research, email, DM, SMS, cold-call
      script, keyword recs, audience targeting, campaign suggestions.

## Phase 4 — Ads Management
- [ ] Google Ads, Facebook/Meta, Instagram, TikTok campaign management from one
      console.
- [ ] Keyword recommendations, audience targeting, campaign suggestions.
- [ ] Ad spend ROI tracking + conversion funnels (ties into Product Telemetry).

---

Related memory: [[project_content_engine]], [[project_landing_page]] (SEO),
[[partner-outreach-agent]], [[retention-marketing]].
