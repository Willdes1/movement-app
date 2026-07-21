'use client'
import { useEffect, useRef } from 'react'

// ============================================================================
//  ATLAS PRIME — public marketing landing page (atlasprime.app "/").
//  Direction: "Kinetic" — the app's real palette (near-black + orange-red
//  #FF5C35 + emerald), blue trust cue for coaches. Matches the logged-in app.
//
//  SWAP THE LOGO HERE ▸ search this file for "LOGO SWAP". The brand mark is a
//  plain wordmark placeholder (no image) so you can replace it in one place when
//  your real logo is ready: the nav mark and the footer mark. Drop an <img> in
//  each and you're done.
//
//  Reversibility ▸ gated by LANDING_LIVE in lib/flags.ts. Flip it to false and
//  "/" goes back to the plain sign-in page instantly.
//
//  Fully responsive: fluid type via clamp(), stacking grids, .aplp{overflow-x}
//  guard, and small-screen rules down to ~320px. CSS is namespaced under .aplp
//  so it can never touch the app's global styles.
// ============================================================================

const CSS = `
.aplp{--bg:#0c0c0f;--surface:#131318;--surface2:#1a1a22;--surface3:#22222e;
  --border:rgba(255,255,255,.08);--border2:rgba(255,255,255,.14);
  --text:#f2f0f7;--text-mid:#9993aa;--text-dim:#5a5566;
  --accent:#FF5C35;--accent2:#FF3A1A;--accent-warm:#FF8C42;--accent-bg:rgba(255,92,53,.1);
  --green:#2ECC8F;--blue:#4E9FFF;--blue-bg:rgba(78,159,255,.1);
  --sans:system-ui,-apple-system,"Segoe UI Variable","Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
  background:var(--bg);color:var(--text);font-family:var(--sans);line-height:1.55;-webkit-font-smoothing:antialiased;overflow-x:hidden;min-height:100vh}
.aplp *{box-sizing:border-box}
.aplp a{color:inherit;text-decoration:none}
.aplp h1,.aplp h2,.aplp h3{margin:0;font-weight:800;letter-spacing:-.03em;line-height:1;text-wrap:balance}
.aplp .wrap{max-width:1160px;margin:0 auto;padding:0 26px}
.aplp .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);font-weight:600}
.aplp .tnum{font-variant-numeric:tabular-nums}
.aplp .nav{position:fixed;inset:0 0 auto 0;z-index:40;background:rgba(12,12,15,.72);backdrop-filter:blur(14px);border-bottom:1px solid var(--border)}
.aplp .nav-in{display:flex;align-items:center;justify-content:space-between;height:60px}
.aplp .brand{font-weight:900;letter-spacing:-.02em;font-size:18px;display:flex;align-items:center;gap:9px}
.aplp .brand .spark{width:10px;height:10px;border-radius:2px;background:var(--accent);box-shadow:0 0 14px var(--accent);transform:rotate(45deg);flex-shrink:0}
.aplp .brand em{font-style:normal;color:var(--accent)}
.aplp .nav-links{display:flex;gap:26px;font-size:13.5px;color:var(--text-mid);font-weight:500}
.aplp .nav-links a:hover{color:var(--text)}
.aplp .nav-right{display:flex;align-items:center;gap:18px}
.aplp .login{font-size:13.5px;color:var(--text-mid);font-weight:600}.aplp .login:hover{color:var(--text)}
.aplp .btn{font-family:var(--sans);font-size:13.5px;font-weight:800;padding:11px 20px;border-radius:10px;border:0;cursor:pointer;display:inline-block;text-align:center;background:var(--accent);color:#0c0c0f;transition:transform .14s,box-shadow .2s,background .2s}
.aplp .btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(255,92,53,.4);background:var(--accent-warm)}
.aplp .btn.ghost{background:transparent;color:var(--text);border:1px solid var(--border2)}
.aplp .btn.ghost:hover{border-color:var(--accent);color:var(--accent);box-shadow:none}
.aplp .btn.blue{background:var(--blue);color:#06111f}.aplp .btn.blue:hover{box-shadow:0 10px 30px rgba(78,159,255,.4);background:#7AB8FF}
@media(max-width:800px){.aplp .nav-links{display:none}}
@media(max-width:400px){.aplp .login{display:none}.aplp .wrap{padding:0 18px}}
.aplp .hero{position:relative;padding:150px 0 60px;overflow:hidden}
.aplp #ekg{position:absolute;left:0;right:0;bottom:0;width:100%;height:280px;z-index:0;opacity:.9}
.aplp .hero::before{content:"";position:absolute;top:-10%;right:-5%;width:min(640px,90vw);height:min(640px,90vw);border-radius:50%;background:radial-gradient(circle,rgba(255,92,53,.16),transparent 62%);z-index:0;pointer-events:none}
.aplp .hero-in{position:relative;z-index:2;max-width:960px}
.aplp .hero h1{font-size:clamp(40px,9vw,116px);letter-spacing:-.045em}
.aplp .hero h1 .o{color:var(--accent)}
.aplp .hero .sub{font-size:clamp(16px,2.2vw,23px);color:var(--text-mid);max-width:56ch;margin:26px 0 0;line-height:1.45;font-weight:450}
.aplp .hero .sub b{color:var(--text);font-weight:700}
.aplp .cta-row{display:flex;gap:13px;flex-wrap:wrap;margin-top:34px}
.aplp .statline{display:flex;gap:38px;flex-wrap:wrap;margin-top:56px;padding-top:26px;border-top:1px solid var(--border)}
.aplp .stat .n{font-size:clamp(26px,5vw,34px);font-weight:900;letter-spacing:-.03em}
.aplp .stat .n .u{color:var(--accent)}
.aplp .stat .l{font-family:var(--mono);font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--text-dim);margin-top:3px}
.aplp .proof{border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--surface);padding:16px 0;overflow:hidden}
.aplp .proof .track{display:flex;gap:44px;white-space:nowrap;font-family:var(--mono);font-size:12.5px;letter-spacing:.08em;color:var(--text-mid);align-items:center;animation:aplpSlide 26s linear infinite;width:max-content}
.aplp .proof .track span{display:inline-flex;gap:12px;align-items:center}
.aplp .proof .track b{color:var(--accent)}
@keyframes aplpSlide{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media(prefers-reduced-motion:reduce){.aplp .proof .track{animation:none;flex-wrap:wrap;white-space:normal;justify-content:center;width:auto}}
.aplp section{padding:92px 0}
.aplp .sec-head{max-width:60ch;margin-bottom:44px}
.aplp .sec-head h2{font-size:clamp(28px,5vw,52px);letter-spacing:-.035em}
.aplp .sec-head p{color:var(--text-mid);font-size:17px;margin-top:16px;line-height:1.5}
.aplp .path{position:relative}
.aplp .path.coach{background:linear-gradient(180deg,var(--bg),#0b0e14)}
.aplp .path .tagline{display:inline-flex;align-items:center;gap:9px;font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;padding:6px 12px;border-radius:20px;margin-bottom:18px}
.aplp .path .tagline.ath{color:var(--accent);background:var(--accent-bg)}
.aplp .path .tagline.coa{color:var(--blue);background:var(--blue-bg)}
.aplp .path-grid{display:grid;grid-template-columns:1fr 1.05fr;gap:48px;align-items:center}
.aplp .path.coach .path-grid{grid-template-columns:1.05fr 1fr}
@media(max-width:920px){.aplp .path-grid,.aplp .path.coach .path-grid{grid-template-columns:1fr;gap:32px}}
.aplp .feat{display:flex;flex-direction:column;gap:16px;margin-top:24px}
.aplp .feat .row{display:flex;gap:13px}
.aplp .feat .ic{width:30px;height:30px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;font-size:15px;background:var(--surface2);border:1px solid var(--border)}
.aplp .feat.ath .ic{color:var(--accent)}.aplp .feat.coa .ic{color:var(--blue)}
.aplp .feat h4{font-size:16px;font-weight:750;margin-bottom:2px}
.aplp .feat p{margin:0;font-size:14px;color:var(--text-mid);line-height:1.45}
.aplp .device{border:1px solid var(--border2);border-radius:20px;background:var(--surface);padding:12px;box-shadow:0 40px 90px rgba(0,0,0,.6);max-width:100%}
.aplp .screen{background:#08080b;border:1px solid var(--border);border-radius:12px;overflow:hidden}
.aplp .screen .bar{display:flex;align-items:center;gap:6px;padding:11px 14px;border-bottom:1px solid var(--border)}
.aplp .screen .bar i{width:8px;height:8px;border-radius:50%;background:var(--surface3)}
.aplp .screen .bar .u{margin-left:8px;font-family:var(--mono);font-size:10.5px;color:var(--text-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aplp .screen .in{padding:15px}
.aplp .er{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 13px;border-radius:11px;background:var(--surface2);border:1px solid var(--border);margin-bottom:8px}
.aplp .er .nm{font-size:13.5px;font-weight:650}.aplp .er .rx{font-family:var(--mono);font-size:11px;color:var(--accent-warm);white-space:nowrap}
.aplp .er .ck{width:20px;height:20px;border-radius:7px;border:1.5px solid var(--surface3);display:grid;place-items:center;color:var(--green);font-size:12px;flex-shrink:0}
.aplp .er.done{background:rgba(46,204,143,.08);border-color:rgba(46,204,143,.28)}.aplp .er.done .ck{border-color:var(--green)}
.aplp .er.coa .rx{color:var(--blue)}
.aplp .wk{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:12px}
.aplp .wk .d{height:46px;border-radius:6px;background:var(--surface2);display:flex;align-items:flex-end;overflow:hidden}
.aplp .wk .f{width:100%;border-radius:6px}
.aplp .kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:6px}
.aplp .kpi .k{background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:9px 11px}
.aplp .kpi .v{font-weight:850;font-size:18px}.aplp .kpi .t{font-family:var(--mono);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-dim);margin-top:2px}
.aplp .switch{display:inline-flex;background:var(--surface);border:1px solid var(--border2);border-radius:12px;padding:4px;margin-bottom:26px;max-width:100%}
.aplp .switch button{font-family:var(--sans);font-size:13.5px;font-weight:750;padding:9px 20px;border:0;border-radius:9px;background:transparent;color:var(--text-mid);cursor:pointer;transition:.2s}
.aplp .switch button.on{background:var(--accent);color:#0c0c0f}
.aplp .switch button.on.coa{background:var(--blue);color:#06111f}
.aplp .switch .s{display:block;font-family:var(--mono);font-size:8.5px;letter-spacing:.1em;text-transform:uppercase;opacity:.7;margin-top:2px}
.aplp .panel{display:none}.aplp .panel.show{display:block;animation:aplpFade .3s ease}
@keyframes aplpFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.aplp .tiers{display:grid;gap:15px}.aplp .a2{grid-template-columns:repeat(2,1fr);max-width:600px}.aplp .c4{grid-template-columns:repeat(4,1fr)}
@media(max-width:900px){.aplp .c4{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.aplp .a2,.aplp .c4{grid-template-columns:1fr}}
.aplp .tier{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px 20px;display:flex;flex-direction:column}
.aplp .tier.feature{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent),0 20px 50px rgba(255,92,53,.12)}
.aplp .tier.feature.coa{border-color:var(--blue);box-shadow:0 0 0 1px var(--blue),0 20px 50px rgba(78,159,255,.12)}
.aplp .tier .bd{font-family:var(--mono);font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);height:13px}
.aplp .tier.coa .bd{color:var(--blue)}
.aplp .tier .tn{font-size:16px;font-weight:850}
.aplp .tier .pr{font-size:38px;font-weight:900;letter-spacing:-.04em;margin:8px 0 2px}
.aplp .tier .pr small{font-size:13px;color:var(--text-dim);font-weight:600}
.aplp .tier .bl{font-size:12.5px;color:var(--text-mid);min-height:34px}
.aplp .tier ul{list-style:none;padding:0;margin:15px 0 20px;display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:var(--text-mid)}
.aplp .tier li{display:flex;gap:8px}.aplp .tier li::before{content:"\\2192";color:var(--accent);font-weight:800}
.aplp .tier.coa li::before{color:var(--blue)}
.aplp .tier .btn{margin-top:auto}
.aplp .note{font-family:var(--mono);font-size:11px;color:var(--text-dim);margin-top:18px}
.aplp .close{text-align:center;padding:110px 0}
.aplp .close h2{font-size:clamp(34px,7vw,84px);letter-spacing:-.04em}
.aplp .close h2 .o{color:var(--accent)}
.aplp .close p{color:var(--text-mid);font-size:18px;max-width:44ch;margin:20px auto 32px}
.aplp footer{border-top:1px solid var(--border);padding:30px 0;color:var(--text-dim);font-size:12.5px}
.aplp .foot-in{display:flex;justify-content:space-between;flex-wrap:wrap;gap:14px;align-items:center}
.aplp .foot-links{display:flex;gap:20px}.aplp .foot-links a:hover{color:var(--accent)}
.aplp .reveal{opacity:0;transform:translateY(20px);transition:opacity .7s,transform .7s}.aplp .reveal.in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){.aplp .reveal{opacity:1;transform:none;transition:none}}
@media(max-width:480px){.aplp .hero{padding:120px 0 40px}.aplp section{padding:64px 0}.aplp .statline{gap:22px;margin-top:40px}.aplp .close{padding:80px 0}.aplp .btn{padding:12px 18px}}
.aplp :focus-visible{outline:2px solid var(--accent);outline-offset:3px}
`

const BODY = `
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Atlas Prime","legalName":"Atlas Prime Labs LLC","url":"https://atlasprime.app","description":"AI performance training for serious athletes and the coaches who program for them."},{"@type":"WebSite","name":"Atlas Prime","url":"https://atlasprime.app"},{"@type":"SoftwareApplication","name":"Atlas Prime","applicationCategory":"HealthApplication","operatingSystem":"Web, iOS, Android","offers":[{"@type":"Offer","name":"Athlete Free","price":"0","priceCurrency":"USD"},{"@type":"Offer","name":"Athlete Prime","price":"12.99","priceCurrency":"USD"},{"@type":"Offer","name":"Coach Starter","price":"19","priceCurrency":"USD"},{"@type":"Offer","name":"Coach Growth","price":"49","priceCurrency":"USD"},{"@type":"Offer","name":"Coach Pro","price":"99","priceCurrency":"USD"}]}]}</script>
<div style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)"><h2>Atlas Prime: AI performance training for athletes and coaches</h2><p>Atlas Prime is an AI powered performance training platform. Athletes get personalized strength and conditioning programs built around their training history, sport, and body, with video demonstrations, spoken coaching cues, set tracking, mobility, recovery, and a daily mindset practice. Coaches get a full coaching portal to build programs, manage clients, message athletes, capture voice notes, and deliver cues in their own voice. Plans for athletes and team pricing for coaches. Atlas Prime, by Atlas Prime Labs LLC.</p></div>

<header class="nav"><div class="wrap nav-in">
  <!-- LOGO SWAP (nav) -->
  <div class="brand"><span class="spark"></span>ATLAS<em>PRIME</em></div>
  <nav class="nav-links"><a href="#athletes">Athletes</a><a href="#coaches">Coaches</a><a href="#pricing">Pricing</a></nav>
  <div class="nav-right"><a class="login" href="/auth">Log in</a><a class="btn" href="/auth">Start free</a></div>
</div></header>

<main>
  <section class="hero"><canvas id="ekg"></canvas><div class="wrap hero-in">
    <span class="eyebrow">AI performance training</span>
    <h1 style="margin-top:18px">TRAIN LIKE<br>YOU MEAN <span class="o">IT.</span></h1>
    <p class="sub"><b>Your own AI program, rebuilt around you every week.</b> Train solo with a plan a performance team would write, or coach your whole roster from one place. No templates. No guesswork.</p>
    <div class="cta-row"><a class="btn" href="/auth">Start free</a><a class="btn ghost" href="#athletes">See how it works</a></div>
    <div class="statline">
      <div class="stat"><div class="n tnum">6<span class="u">&#215;</span></div><div class="l">Specialists per plan</div></div>
      <div class="stat"><div class="n">Every <span class="u tnum">7</span> days</div><div class="l">Your plan adapts</div></div>
      <div class="stat"><div class="n tnum">$0</div><div class="l">To start</div></div>
    </div>
  </div></section>

  <div class="proof"><div class="track">
    <span>Built for <b>serious athletes</b></span><span>Programmed by an <b>AI performance team</b></span><span>Trusted by <b>coaches</b></span><span>Video demos on <b>every move</b></span><span>Your coach, <b>in your ear</b></span>
    <span>Built for <b>serious athletes</b></span><span>Programmed by an <b>AI performance team</b></span><span>Trusted by <b>coaches</b></span><span>Video demos on <b>every move</b></span><span>Your coach, <b>in your ear</b></span>
  </div></div>

  <section id="athletes" class="path"><div class="wrap"><div class="path-grid">
    <div class="reveal">
      <span class="tagline ath">&#9679; For athletes</span>
      <h2 style="font-size:clamp(26px,4.4vw,46px);letter-spacing:-.035em">A pro's program.<br>Personal to you.</h2>
      <div class="feat ath">
        <div class="row"><span class="ic">&#9670;</span><div><h4>Actually yours</h4><p>Built around your history, sport, and body. Not a template with your name on it.</p></div></div>
        <div class="row"><span class="ic">&#9654;</span><div><h4>Know what to do, and how</h4><p>Video demos and cues read in your ear on every movement.</p></div></div>
        <div class="row"><span class="ic">&#9889;</span><div><h4>It keeps score</h4><p>Log every set. The plan reads your work and adjusts the next one.</p></div></div>
      </div>
      <div class="cta-row"><a class="btn" href="/auth">Start training free</a></div>
    </div>
    <div class="device reveal"><div class="screen"><div class="bar"><i></i><i></i><i></i><span class="u">atlasprime.app / today</span></div><div class="in">
      <div class="wk"><div class="d"><div class="f" style="height:60%;background:var(--accent)"></div></div><div class="d"><div class="f" style="height:38%;background:var(--accent-warm)"></div></div><div class="d"><div class="f" style="height:20%;background:var(--surface3)"></div></div><div class="d"><div class="f" style="height:88%;background:var(--accent2)"></div></div><div class="d"><div class="f" style="height:52%;background:var(--accent)"></div></div><div class="d"><div class="f" style="height:68%;background:var(--accent-warm)"></div></div><div class="d"><div class="f" style="height:14%;background:var(--surface3)"></div></div></div>
      <div class="er done"><span class="nm">Back Squat</span><span class="rx">4 &#215; 5 &#183; RPE 8</span><span class="ck">&#10003;</span></div>
      <div class="er done"><span class="nm">Romanian Deadlift</span><span class="rx">3 &#215; 8 &#183; RPE 7</span><span class="ck">&#10003;</span></div>
      <div class="er"><span class="nm">Bulgarian Split Squat</span><span class="rx">3 &#215; 10 / side</span><span class="ck"></span></div>
      <div class="kpi"><div class="k"><div class="v" style="color:var(--green)">72%</div><div class="t">Day done</div></div><div class="k"><div class="v">Build</div><div class="t">Phase</div></div><div class="k"><div class="v">Wk 6</div><div class="t">Cycle</div></div></div>
    </div></div></div>
  </div></div></section>

  <section id="coaches" class="path coach"><div class="wrap"><div class="path-grid">
    <div class="device reveal"><div class="screen"><div class="bar"><i></i><i></i><i></i><span class="u">coach / roster</span></div><div class="in">
      <div class="er coa"><span class="nm">A. Rivera</span><span class="rx" style="color:var(--green)">92% &#9650;</span></div>
      <div class="er coa"><span class="nm">M. Chen</span><span class="rx" style="color:var(--green)">80% &#9650;</span></div>
      <div class="er coa"><span class="nm">J. Okafor</span><span class="rx" style="color:var(--accent-warm)">54%</span></div>
      <div class="er coa"><span class="nm">T. Nasser</span><span class="rx" style="color:var(--accent2)">idle 6d</span></div>
      <div class="kpi"><div class="k"><div class="v">18</div><div class="t">Clients</div></div><div class="k"><div class="v" style="color:var(--green)">83%</div><div class="t">Compliance</div></div><div class="k"><div class="v" style="color:var(--blue)">7</div><div class="t">Credits</div></div></div>
    </div></div></div>
    <div class="reveal">
      <span class="tagline coa">&#9679; For coaches</span>
      <h2 style="font-size:clamp(26px,4.4vw,46px);letter-spacing:-.035em">Your practice,<br>in one console.</h2>
      <p style="color:var(--text-mid);font-size:16px;margin-top:14px">The part no competitor can copy. Real coaching, delivered well, with you in every client's ear.</p>
      <div class="feat coa">
        <div class="row"><span class="ic">&#9670;</span><div><h4>Program at the speed of thought</h4><p>Build with AI or by hand, from your own library.</p></div></div>
        <div class="row"><span class="ic">&#127908;</span><div><h4>Your voice, in their ear</h4><p>Clients hear your cues in your actual voice while they train.</p></div></div>
        <div class="row"><span class="ic">&#9672;</span><div><h4>The whole relationship, one place</h4><p>Messaging, notes, and compliance beside every program.</p></div></div>
      </div>
      <div class="cta-row"><a class="btn blue" href="/auth?as=coach">Open a coach account</a></div>
    </div>
  </div></div></section>

  <section id="pricing" class="path"><div class="wrap">
    <div class="sec-head reveal" style="margin-bottom:24px"><span class="eyebrow">Pricing</span><h2 style="margin-top:12px">Start free. Upgrade when you are ready.</h2><p>Athletes train free to start. Coaches begin with five AI programs, free. Choose your side.</p></div>
    <div class="switch reveal" role="tablist">
      <button class="on" data-tab="ath">Athletes<span class="s">Train solo</span></button>
      <button data-tab="coa">Coaches<span class="s">Run a practice</span></button>
    </div>
    <div class="panel show" data-panel="ath"><div class="tiers a2">
      <div class="tier"><div class="bd"></div><div class="tn">Free</div><div class="pr">$0</div><div class="bl">A real program, on the house.</div><ul><li>3 AI programs to start</li><li>Daily app, demos, tracking</li><li>Mobility and recovery</li></ul><a class="btn ghost" href="/auth">Start training</a></div>
      <div class="tier feature"><div class="bd">Full experience</div><div class="tn">Prime</div><div class="pr">$12.99<small>/mo</small></div><div class="bl">Unlimited training. $89/yr saves 43%.</div><ul><li>Unlimited AI programs</li><li>Spoken cues + mindset feed</li><li>AI recovery + travel adjust</li></ul><a class="btn" href="/auth">Go Prime</a></div>
    </div><p class="note">Athlete pricing is a draft for discussion. USD, cancel anytime.</p></div>
    <div class="panel" data-panel="coa"><div class="tiers c4">
      <div class="tier coa"><div class="bd"></div><div class="tn">Free</div><div class="pr">$0</div><div class="bl">The whole portal, free.</div><ul><li>5 AI programs</li><li>Core coach portal</li><li>100 messages / mo</li></ul><a class="btn ghost" href="/auth?as=coach">Get started</a></div>
      <div class="tier coa feature coa"><div class="bd">Most popular</div><div class="tn">Starter</div><div class="pr">$19<small>/mo</small></div><div class="bl">Building a roster.</div><ul><li>25 AI programs / mo</li><li>Voice notes + voice in ear</li><li>1,000 messages / mo</li></ul><a class="btn blue" href="/auth?as=coach">Choose Starter</a></div>
      <div class="tier coa"><div class="bd"></div><div class="tn">Growth</div><div class="pr">$49<small>/mo</small></div><div class="bl">More headroom.</div><ul><li>75 AI programs / mo</li><li>Everything in Starter</li><li>5,000 messages / mo</li></ul><a class="btn ghost" href="/auth?as=coach">Choose Growth</a></div>
      <div class="tier coa"><div class="bd"></div><div class="tn">Pro</div><div class="pr">$99<small>/mo</small></div><div class="bl">No ceilings.</div><ul><li>200 AI programs / mo</li><li>Unlimited messaging</li><li>Priority everything</li></ul><a class="btn ghost" href="/auth?as=coach">Choose Pro</a></div>
    </div><p class="note">USD, cancel anytime.</p></div>
  </div></section>

  <section class="close"><div class="wrap reveal">
    <h2>SHOW UP.<br>GET <span class="o">AFTER IT.</span></h2>
    <p>Start free today. Bring yourself, or bring your whole roster.</p>
    <div class="cta-row" style="justify-content:center"><a class="btn" href="/auth">Start free</a><a class="btn ghost" href="/auth">Log in</a></div>
  </div></section>
</main>

<footer><div class="wrap foot-in">
  <!-- LOGO SWAP (footer) -->
  <div class="brand" style="font-size:15px"><span class="spark"></span>ATLAS<em>PRIME</em></div>
  <div class="foot-links"><a href="/auth">Log in</a><a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a></div>
  <div style="font-family:var(--mono)">&#169; 2026 Atlas Prime Labs LLC</div>
</div></footer>
`

export default function LandingPage() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches
    const cleanups: Array<() => void> = []

    // ---- EKG pulse line ----
    const c = root.querySelector('#ekg') as HTMLCanvasElement | null
    if (c) {
      const x = c.getContext('2d')!
      let w = 0, h = 0, off = 0, raf = 0, rt: any
      const size = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      const pulse = (px: number) => {
        const seg = (px % 260) / 260; let y = h * 0.72
        if (seg > 0.40 && seg < 0.46) y = h * 0.72 - (seg - 0.40) / 0.06 * h * 0.10
        else if (seg >= 0.46 && seg < 0.50) y = h * 0.62 + (seg - 0.46) / 0.04 * h * 0.42
        else if (seg >= 0.50 && seg < 0.54) y = h * 1.04 - (seg - 0.50) / 0.04 * h * 0.62
        else if (seg >= 0.54 && seg < 0.58) y = h * 0.42 + (seg - 0.54) / 0.04 * h * 0.30
        return y
      }
      const draw = () => {
        x.clearRect(0, 0, w, h)
        const grad = x.createLinearGradient(0, 0, w, 0)
        grad.addColorStop(0, 'rgba(255,92,53,0)'); grad.addColorStop(.5, 'rgba(255,92,53,.9)'); grad.addColorStop(1, 'rgba(255,140,66,0)')
        x.beginPath()
        for (let px = 0; px <= w; px += 2) { const y = pulse(px + off); px === 0 ? x.moveTo(px, y) : x.lineTo(px, y) }
        x.strokeStyle = grad; x.lineWidth = 2.4; x.shadowColor = 'rgba(255,92,53,.7)'; x.shadowBlur = 12; x.stroke(); x.shadowBlur = 0
      }
      const loop = () => { off += 1.6; draw(); if (!reduce) raf = requestAnimationFrame(loop) }
      size(); draw(); if (!reduce) raf = requestAnimationFrame(loop)
      const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { size(); draw() }, 150) }
      window.addEventListener('resize', onResize)
      cleanups.push(() => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) })
    }

    // ---- pricing toggle ----
    const tabs = root.querySelectorAll('[data-tab]')
    tabs.forEach(tb => tb.addEventListener('click', () => {
      const which = tb.getAttribute('data-tab')
      root.querySelectorAll('[data-panel]').forEach(p => p.classList.toggle('show', p.getAttribute('data-panel') === which))
      tabs.forEach(o => { const on = o === tb; o.classList.toggle('on', on); o.classList.toggle('coa', on && which === 'coa') })
    }))

    // ---- reveal on scroll ----
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { threshold: 0.12 })
    root.querySelectorAll('.reveal').forEach(el => io.observe(el))
    cleanups.push(() => io.disconnect())

    return () => cleanups.forEach(fn => fn())
  }, [])

  return <div className="aplp" ref={ref} dangerouslySetInnerHTML={{ __html: `<style>${CSS}</style>${BODY}` }} />
}
