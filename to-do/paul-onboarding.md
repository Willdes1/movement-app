# Onboarding Paul (trainer + physical therapist, possible partner)

> Captured from Will 2026-08-05.
>
> **MAGIC PHRASE: "It's time to onboard Paul."**
> When Will says that, pause whatever roadmap task is in flight, run this file
> end to end, then return to the interrupted task.

## Who and why

Paul is a certified personal trainer **and** a physical therapist. Will is
considering bringing him on as a partner, because:

- His certifications add real credibility to the company.
- He can run the Coach Portal with his own actual clients, which is the first
  genuine real-world test the portal will have had.
- He can feed back recommendations from someone who coaches for a living.

## When

**Not immediately after Shawn.** Billing and pricing come first: Stripe wired,
Apple's requirements met, pricing finalised. That is the bigger priority. Will
may still interrupt at any point with the magic phrase.

## The process, from step one

1. **Paul creates an account** with his own email address.
2. **Give him the right permissions.**
3. **Let him help curate videos** for the Athlete Portal.
4. **Full visibility and access to the Coach Portal**, so he can use and test it
   as a real coach with real clients.
5. **Walk him through the complete coach onboarding experience.**
6. **Gather his feedback and make the adjustments it calls for.**

## What already exists for each step

Steps 2 and 3 are mostly built. Do not build new machinery for them.

- **Partner permissions already exist.** `admin_permissions` table plus the
  owner-only **Access Control** tab at `/admin#access`. Partners are NOT
  `is_admin`; access is granted per section. See [[project_admin_access]].
- **Video curation is grantable as a single section.** Granting Paul the `video`
  tab gives him curation without any other admin access. The **Video Trimming**
  tab was deliberately built with `trimmed_by` / `trimmed_at` columns so a
  teammate could work that queue independently, which is exactly this.
- **Coach Portal access** comes from `role = 'coach'`. Coaches already get the
  athlete app as well, so he can see both sides.
- **A coach onboarding wizard exists**: `components/coach/OnboardingOverlay.tsx`.
  Step 5 should walk the real thing, which is what the preview below is for.

## Open questions for Will

- Owner, partner-with-all-tabs, or a narrow grant? Different answer from Shawn's.
- Does partner status change anything in the app, or is it purely a business
  arrangement with normal coach + granted admin sections?

## Related

[[project_shawn_stiffler_ceo]] for the CEO onboarding that comes first, and
`to-do/coach-onboarding-preview.md` for step 5's walkthrough tool.
