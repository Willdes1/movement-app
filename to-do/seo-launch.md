# SEO launch checklist (for the atlasprime.app landing)

> STATUS 2026-07-20 — CORE DONE. Shipped: homepage metadata + OG/Twitter card
> (code-generated opengraph-image.tsx, confirmed in FB debugger), sitemap.ts,
> robots.ts, FAQ section + FAQPage schema. Google Search Console auto-verified
> (domain provider) + sitemap submitted; Bing imported from GSC. Remaining =
> optional long-tail only: a couple of content/blog pages, /auth + legal descriptions.

Do this once the landing copy is locked (it effectively is). Goal: when someone searches
"Atlas Prime" (or "AI workout plan", "online coaching software", "AI training programs")
the site is indexed, ranks, and unfurls into a real share card. Mostly one focused session.

Copy rule reminder: NO em dashes anywhere in site copy.

## 1. Per-page metadata (Next metadata API)
- Give `/` its own optimized `<title>` and `<meta name="description">` with real search terms.
  Homepage currently inherits the generic layout title. Example title:
  "Atlas Prime | AI Performance Training for Athletes and Coaches".
- Add descriptions for /auth and the legal pages too.
- Note: `app/page.tsx` is a client component, so put the homepage metadata in a route
  `metadata` export (may need a small server wrapper) or enrich `app/layout.tsx`.

## 2. Open Graph + Twitter share card
- Add `openGraph` and `twitter` metadata: title, description, url, and a 1200x630 image.
- CREATE the share image (branded, near-black + orange-red, the locked headline). Without it,
  texting/posting the link shows a plain preview. This is the piece that waits on locked copy.
- Test with the Facebook Sharing Debugger and X Card Validator after deploy.

## 3. Sitemap + robots
- Add `app/sitemap.ts` (Next generates sitemap.xml) listing the public pages.
- Add `app/robots.ts` (allow crawl, point to the sitemap).

## 4. Google Search Console (and Bing Webmaster)
- Verify domain ownership (DNS TXT or the existing Vercel setup).
- Submit the sitemap. Watch indexing status + which queries bring people in.
- This is the step that actually gets the site found for "Atlas Prime".

## 5. Structured data (expand what's already there)
- Landing already ships Organization + WebSite + SoftwareApplication + Offers (JSON-LD).
- Add an FAQ block (FAQPage schema) so Google can show rich results. Keep answers honest.

## 6. Keyword-worked copy + a little background content
- Weave target terms into the real copy (AI workout plan, personalized training program,
  online coaching platform, strength program generator, coach client app), honestly.
- Consider a short FAQ section and, later, a couple of content pages / a blog for long-tail.

## Already handled (counts toward ranking)
- Fast load + mobile responsive (Kinetic is light, no autoplay video, hardened to ~320px).
- Canonical domain: www + .fit + .health already 308-redirect to atlasprime.app.
