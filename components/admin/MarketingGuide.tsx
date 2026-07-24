'use client'
import React from 'react'

// Read-only "How to use it" guide, living inside the Marketing tab so everything
// is in one place. Mirrors the standalone playbook, styled for the admin portal.

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#21262d', border: '#30363d',
  accent: '#FF5C35', text: '#e6edf3', textMid: '#b1bac4', textDim: '#6e7681',
}
const HUE = { content: '#FF5C35', leads: '#4E9FFF', ads: '#2ECC8F' }

const B = ({ children }: { children: React.ReactNode }) => <b style={{ color: C.text, fontWeight: 700 }}>{children}</b>

function Steps({ hue, items }: { hue: string; items: React.ReactNode[] }) {
  return (
    <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map((it, i) => (
        <li key={i} style={{ position: 'relative', paddingLeft: 42, fontSize: 14, color: C.textMid, lineHeight: 1.55 }}>
          <span style={{ position: 'absolute', left: 0, top: 0, width: 26, height: 26, borderRadius: 7, background: `${hue}20`, border: `1px solid ${hue}66`, color: hue, fontFamily: 'ui-monospace, monospace', fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
          {it}
        </li>
      ))}
    </ol>
  )
}

function StepLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: C.textDim, fontWeight: 600, margin: '24px 0 12px' }}>{children}</div>
}

function Note({ hue, children }: { hue: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 22, background: C.bg, border: `1px solid ${C.border}`, borderLeft: `3px solid ${hue}`, borderRadius: 10, padding: '13px 16px', fontSize: 13.5, color: C.textMid, lineHeight: 1.55 }}>
      <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: hue, fontWeight: 700, display: 'block', marginBottom: 5 }}>Good to know</span>
      {children}
    </div>
  )
}

function Section({ hue, chip, title, whatis, children }: { hue: string; chip: string; title: string; whatis: React.ReactNode; children: React.ReactNode }) {
  return (
    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 22, marginBottom: 18 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'ui-monospace, monospace', fontSize: 11.5, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: hue, background: `${hue}1f`, border: `1px solid ${hue}55`, borderRadius: 20, padding: '6px 13px' }}>{chip}</span>
      <h3 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', margin: '14px 0 0' }}>{title}</h3>
      <p style={{ color: C.textMid, fontSize: 14.5, margin: '10px 0 0', lineHeight: 1.55 }}>{whatis}</p>
      {children}
    </section>
  )
}

export default function MarketingGuide() {
  return (
    <div style={{ maxWidth: 780 }}>
      {/* Intro */}
      <section style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.02em', margin: 0 }}>One tab, three jobs a whole team usually does</h2>
        <p style={{ color: C.textMid, fontSize: 14.5, margin: '12px 0 0', lineHeight: 1.6 }}>
          Your Marketing tab is a complete acquisition machine in one place. It does the three things startups normally pay a marketing team to do, powered by the same AI engine that runs the app, in your voice. <B>You stay the decision maker. The AI does the heavy lifting, and you approve and send.</B>
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: '18px 0 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            [HUE.content, 'Inbound (Content):', 'pulls in strangers already searching Google for what you offer.'],
            [HUE.leads, 'Outbound (Leads):', 'finds and ranks the businesses worth pitching, then writes the pitch for each one.'],
            [HUE.ads, 'Paid (Ads):', 'builds launch-ready campaigns for Google, Meta, Instagram, and TikTok.'],
          ].map(([hue, k, v], i) => (
            <li key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', fontSize: 14, color: C.textMid }}>
              <span style={{ flexShrink: 0, width: 7, height: 7, borderRadius: '50%', background: hue as string, marginTop: 7 }} />
              <div><B>{k}</B> {v}</div>
            </li>
          ))}
        </ul>
        <p style={{ color: C.textMid, fontSize: 14, margin: '16px 0 0', lineHeight: 1.6 }}>
          Everything you generate is <B>saved</B>, so nothing disappears when you refresh. Use the switcher above to flip between Content, Leads, and Ads.
        </p>
      </section>

      {/* CONTENT */}
      <Section hue={HUE.content} chip="📝 Content" title="Get found on Google, on autopilot"
        whatis={<>The Content tab <B>writes SEO blog articles</B> that help people find Atlas Prime when they search, then publishes them to your public blog at atlasprime.app/blog. It can run itself: it drafts articles for you to approve, and publishes the approved ones on a schedule.</>}>
        <StepLabel>Write one article, right now</StepLabel>
        <Steps hue={HUE.content} items={[
          <>Open <B>Marketing</B> and make sure you are on the <B>Content</B> tab.</>,
          <>Pick a <B>category</B>: coach software, recovery and rehab, AI training, or sport specific.</>,
          <>Click <B>Generate</B>. The engine picks a fresh topic you have not covered, writes a full expert article, and hands you a draft. (Want a specific topic? Open "steer the topic" and type one.)</>,
          <><B>Read and edit</B> the draft. Change the title, meta description, or body. You are the editor.</>,
          <>Then <B>Approve to queue</B> to schedule it, or <B>Publish now</B> to send it live immediately.</>,
        ]} />
        <StepLabel>Let it run on autopilot</StepLabel>
        <Steps hue={HUE.content} items={[
          <>In the <B>Auto-pilot</B> panel, keep <B>Auto-generate drafts</B> on. The engine keeps a buffer of drafts waiting for you.</>,
          <>Set your <B>Publish days</B> (default Tuesday and Friday) and how many drafts to keep buffered.</>,
          <><B>Approve</B> the drafts you like. They line up in the <B>Drip queue</B>.</>,
          <>On each publish day, the next queued article goes live <B>automatically</B>.</>,
        ]} />
        <Note hue={HUE.content}>Nothing publishes without your approval, which keeps quality high and protects your Google ranking. <B>Two genuinely good articles a week beats daily filler.</B></Note>
      </Section>

      {/* LEADS */}
      <Section hue={HUE.leads} chip="🎯 Leads" title="Find who to pitch, and how to pitch them"
        whatis={<>The Leads tab <B>finds businesses worth pitching</B> (gyms, training studios, PT clinics), scores each for how good a fit it is, and keeps them in a permanent list. Inside any lead, it also writes a personalized outreach kit.</>}>
        <StepLabel>Build your list</StepLabel>
        <Steps hue={HUE.leads} items={[
          <>Open the <B>Leads</B> tab.</>,
          <>Pick an <B>industry</B>, type a <B>location</B> (like "Austin, TX") or leave it blank for worldwide, choose the scope, and set how many.</>,
          <>Click <B>Find leads</B>. Each result is scored <B>0 to 100</B> with a badge for Independent, Multi-location, or Enterprise. Independents and small clinics score highest, since they are easiest to reach and most likely to need you.</>,
          <><B>Expand</B> any lead to see why it scored that way, add notes, and view contact details.</>,
          <>Move each lead through your pipeline: <B>New, Qualified, Contacted, Archived</B>.</>,
          <>Use the <B>filters</B> to focus, and <B>Export CSV</B> to take the list anywhere.</>,
        ]} />
        <StepLabel>Draft the outreach</StepLabel>
        <Steps hue={HUE.leads} items={[
          <>Expand a lead and find the <B>Outreach kit</B> section.</>,
          <>Pick a <B>tone</B>: Warm, Direct, or Problem-first.</>,
          <>Click <B>Draft outreach</B>. The AI writes a personalized <B>email</B> (subject and body), a <B>social DM</B>, an <B>SMS</B>, and a <B>cold-call script</B>, tailored to that business.</>,
          <>Hit <B>Copy</B> on any one and paste it into your email, phone, or DMs. The kit saves, and <B>Regenerate</B> gives a fresh angle.</>,
        ]} />
        <Note hue={HUE.leads}>Right now Leads runs on <B>realistic sample data</B> so you can learn the workflow. When you choose a data source (Google Places or Apollo), the same tool pulls real businesses with no rebuild. Your lists are <B>saved permanently</B> until you delete them.</Note>
      </Section>

      {/* ADS */}
      <Section hue={HUE.ads} chip="📣 Ads" title="Launch-ready campaigns in one click"
        whatis={<>The Ads tab <B>builds complete ad campaigns</B> for Google, Meta, Instagram, and TikTok. You pick what you are promoting, and it writes the keywords, audience targeting, ad copy, creative ideas, and budget plan, ready to paste into each platform's ads manager.</>}>
        <StepLabel>Build a campaign</StepLabel>
        <Steps hue={HUE.ads} items={[
          <>Open the <B>Ads</B> tab.</>,
          <>Pick a <B>platform</B>: Google Search, Meta, Instagram, or TikTok.</>,
          <>Choose what you are <B>promoting</B> (the athlete app or the coach product), an <B>objective</B>, and a <B>daily budget</B>.</>,
          <>Optional: add a line of <B>direction</B>, like "target skateboarders" or "push the free trial".</>,
          <>Click <B>Generate campaign</B>. You get keywords or audience targeting, at least two ad-copy variations that fit the platform's rules, creative hooks, a budget and bidding suggestion, and setup notes.</>,
          <>Hit <B>Copy</B> on any section and paste it into the platform's ads manager. Campaigns save with a status (Draft, Active, Archived).</>,
        ]} />
        <Note hue={HUE.ads}>These are launch-ready <B>plans to paste in</B>. Launching directly through the platforms and tracking spend against conversions comes later (Phase 4b), once you have funded ad accounts.</Note>
      </Section>

      {/* TAKEAWAYS */}
      <section style={{ marginTop: 26 }}>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: C.accent, fontWeight: 700 }}>Keep these in your back pocket</div>
        <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-.02em', margin: '10px 0 0' }}>Founder takeaways</h2>
        <p style={{ color: C.textMid, fontSize: 14, margin: '8px 0 0' }}>How to talk about each of these when someone asks what you have built. Benefits, not features.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 20 }}>
          {[
            [HUE.content, 'On Content', 'You turned content from a chore you would never do into a button you click while your coffee brews. Every article you approve is another page pulling in searchers your competitors are ignoring, and it works while you build the app.'],
            [HUE.leads, 'On Leads', 'This is not a list, it is a ranked hit list. It does not dump 500 gyms on you. It tells you which 20 are actually reachable and sellable, so you spend your energy on the conversations that matter.'],
            [HUE.ads, 'On Ads', 'The work that used to take a marketer a full day (research the audience, find the angle, write the copy, plan the budget) is now one click. You review and launch. That compression is a real advantage.'],
            [C.accent, 'The whole engine', 'Atlas Prime is not just the product, it is the growth system around it. One console finds your customers, ranks who to chase, writes the pitch, and builds the ads, all powered by the same AI that runs the app. That means you can go from zero to customers without hiring a marketing department. That story is worth as much as the app itself.'],
          ].map(([hue, cat, text], i) => (
            <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `4px solid ${hue}`, borderRadius: 12, padding: '18px 20px' }}>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 700, color: hue as string }}>{cat}</span>
              <p style={{ margin: '9px 0 0', fontSize: 14.5, color: C.text, lineHeight: 1.6 }}>{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
