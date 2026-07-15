'use client'
import { useEffect, useRef } from 'react'

// ============================================================================
//  ATLAS PRIME — public marketing landing page (atlasprime.app "/").
//
//  SWAP THE LOGO HERE ▸ The brand mark is a self-contained placeholder (no image
//  asset) on purpose, so you can replace it in ONE place when your real logo is
//  ready. Search this file for "LOGO SWAP" — there are two spots: the small
//  nav/footer wordmark and the big HERO WORDMARK. Drop an <img> in each and
//  you're done. Nothing else references the logo.
//
//  Reversibility ▸ this whole page is gated by LANDING_LIVE in lib/flags.ts.
//  Flip that to false and "/" goes back to the plain sign-in page instantly.
//
//  The markup is injected as static HTML (so the design stays 1:1 with the
//  approved mockup); the canvas / carousels / pricing toggle are wired up on
//  mount below. CSS is namespaced under .aplp so it can't touch the app.
// ============================================================================

const CSS = `
.aplp{--obsidian:#0A0B0F;--obsidian-2:#0E1015;--line:rgba(200,155,84,0.18);--line-soft:rgba(236,230,216,0.09);
  --marble:#ECE6D8;--marble-dim:#B4AD9C;--marble-mute:#7E786B;--bronze:#C89B54;--bronze-lo:#A97F3C;--bronze-hi:#E7C888;--steel:#86A9C6;--good:#6FBF73;--alert:#D98A54;
  --serif:"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --mono:ui-monospace,"SF Mono","JetBrains Mono",Menlo,Consolas,monospace;
  background:var(--obsidian);color:var(--marble);font-family:var(--sans);line-height:1.6;-webkit-font-smoothing:antialiased;overflow-x:hidden;min-height:100vh}
.aplp *{box-sizing:border-box}
.aplp a{color:inherit;text-decoration:none}
.aplp h1,.aplp h2,.aplp h3,.aplp h4{font-family:var(--serif);font-weight:500;text-wrap:balance;margin:0}
.aplp .wrap{max-width:1140px;margin:0 auto;padding:0 28px}
.aplp .eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.32em;text-transform:uppercase;color:var(--bronze);display:inline-block}
.aplp .tnum{font-variant-numeric:tabular-nums}
.aplp .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
.aplp .nav{position:fixed;inset:0 0 auto 0;z-index:30;backdrop-filter:blur(10px);background:rgba(10,11,15,.6);border-bottom:1px solid var(--line-soft)}
.aplp .nav-in{display:flex;align-items:center;justify-content:space-between;height:64px}
.aplp .brand{display:flex;align-items:baseline;gap:.5ch;font-family:var(--serif);font-size:19px;letter-spacing:.14em}
.aplp .brand b{font-weight:600}.aplp .brand span{color:var(--bronze);font-weight:600}
.aplp .nav-links{display:flex;gap:28px;font-size:13.5px;color:var(--marble-dim)}
.aplp .nav-links a:hover{color:var(--marble)}
.aplp .nav-right{display:flex;align-items:center;gap:20px}
.aplp .login{font-size:13.5px;color:var(--marble-dim)}.aplp .login:hover{color:var(--bronze-hi)}
.aplp .btn{font-family:var(--sans);font-size:13.5px;font-weight:600;padding:10px 20px;border-radius:2px;border:1px solid var(--bronze);color:var(--obsidian);background:var(--bronze);cursor:pointer;transition:transform .15s,background .2s;display:inline-block;text-align:center}
.aplp .btn:hover{background:var(--bronze-hi);transform:translateY(-1px)}
.aplp .btn.ghost{background:transparent;color:var(--marble);border-color:var(--line)}
.aplp .btn.ghost:hover{border-color:var(--bronze);color:var(--bronze-hi)}
@media(max-width:820px){.aplp .nav-links{display:none}}
.aplp .hero{position:relative;min-height:100svh;display:flex;align-items:center;overflow:hidden}
.aplp #sky{position:absolute;inset:0;width:100%;height:100%;z-index:0}
.aplp .hero::after{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;background:radial-gradient(120% 90% at 50% 6%,transparent 42%,rgba(10,11,15,.72) 100%),linear-gradient(180deg,transparent 58%,var(--obsidian) 100%)}
.aplp .hero-in{position:relative;z-index:2;padding:118px 0 84px}
.aplp .wordmark{font-family:var(--serif);line-height:.9;letter-spacing:.02em;font-size:clamp(56px,12.5vw,158px);font-weight:500}
.aplp .wordmark .pr{display:block;color:transparent;background:linear-gradient(180deg,var(--bronze-hi),var(--bronze-lo));-webkit-background-clip:text;background-clip:text}
.aplp .hero .lede{max-width:60ch;margin:28px 0 0;font-size:clamp(17px,2.1vw,22px);color:var(--marble-dim);line-height:1.5}
.aplp .hero .lede b{color:var(--marble);font-weight:600}
.aplp .hero .whisper{font-family:var(--serif);font-style:italic;font-size:clamp(15px,1.8vw,18px);color:var(--marble-mute);margin-top:18px}
.aplp .cta-row{display:flex;gap:14px;flex-wrap:wrap;margin-top:38px}
.aplp section{position:relative;padding:100px 0}
.aplp .sec-head{max-width:62ch;margin-bottom:46px}
.aplp .sec-head h2{font-size:clamp(30px,4.6vw,50px);line-height:1.05;margin-top:16px}
.aplp .sec-head p{color:var(--marble-dim);font-size:17px;margin-top:16px}
.aplp .trio{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line-soft);border:1px solid var(--line-soft)}
.aplp .trio .cell{background:var(--obsidian);padding:30px 26px}
.aplp .trio h3{font-size:21px;margin:12px 0 8px}
.aplp .trio p{font-size:14.5px;color:var(--marble-dim);margin:0}
@media(max-width:760px){.aplp .trio{grid-template-columns:1fr}}
.aplp .path{border-top:1px solid var(--line)}
.aplp .path.coach{background:linear-gradient(180deg,var(--obsidian),var(--obsidian-2))}
.aplp .path-grid{display:grid;grid-template-columns:1fr 1.02fr;gap:52px;align-items:center}
.aplp .path.coach .path-grid{grid-template-columns:1.02fr 1fr}
@media(max-width:940px){.aplp .path-grid,.aplp .path.coach .path-grid{grid-template-columns:1fr;gap:36px}}
.aplp .benefits{list-style:none;padding:0;margin:26px 0 0;display:flex;flex-direction:column;gap:18px}
.aplp .benefits li{display:flex;gap:14px}
.aplp .benefits .mk{color:var(--bronze);font-family:var(--serif);font-size:20px;line-height:1.2;flex-shrink:0}
.aplp .benefits h4{font-size:16.5px;margin-bottom:3px}
.aplp .benefits p{margin:0;font-size:14px;color:var(--marble-dim);line-height:1.45}
.aplp .carousel{position:relative}
.aplp .viewport{overflow:hidden;border:1px solid var(--line);border-radius:14px;background:#07080B;box-shadow:0 30px 80px rgba(0,0,0,.5)}
.aplp .slides{display:flex;transition:transform .6s cubic-bezier(.7,0,.2,1)}
@media(prefers-reduced-motion:reduce){.aplp .slides{transition:none}}
.aplp .slide{min-width:100%}
.aplp .scr{background:#07080B;color:var(--marble)}
.aplp .scr .top{display:flex;align-items:center;gap:7px;padding:11px 15px;border-bottom:1px solid var(--line-soft)}
.aplp .scr .top i{width:8px;height:8px;border-radius:50%;background:#2a2f38}
.aplp .scr .top .u{margin-left:8px;font-family:var(--mono);font-size:10.5px;color:var(--marble-mute);letter-spacing:.05em}
.aplp .scr .canvas{padding:18px}
.aplp .caption{font-family:var(--mono);font-size:11px;letter-spacing:.06em;color:var(--marble-mute);text-align:center;margin-top:14px;height:16px}
.aplp .dots{display:flex;gap:8px;justify-content:center;margin-top:14px}
.aplp .dot{width:7px;height:7px;border-radius:50%;background:var(--line);border:0;padding:0;cursor:pointer;transition:background .2s,transform .2s}
.aplp .dot.on{background:var(--bronze);transform:scale(1.25)}
.aplp .cbtn{position:absolute;top:44%;background:rgba(10,11,15,.7);border:1px solid var(--line);color:var(--marble);width:38px;height:38px;border-radius:50%;cursor:pointer;font-size:15px;z-index:3;transition:border-color .2s}
.aplp .cbtn:hover{border-color:var(--bronze)}
.aplp .cbtn.prev{left:-14px}.aplp .cbtn.next{right:-14px}
@media(max-width:520px){.aplp .cbtn{display:none}}
.aplp .m-row{display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-radius:8px;background:rgba(236,230,216,.03);border:1px solid var(--line-soft);margin-bottom:8px}
.aplp .m-row .nm{font-size:13.5px;font-weight:600}
.aplp .m-row .rx{font-family:var(--mono);font-size:11px;color:var(--bronze-hi)}
.aplp .m-row .ck{width:19px;height:19px;border-radius:6px;border:1.5px solid #3a3f48;display:grid;place-items:center;color:var(--good);font-size:11px}
.aplp .m-row.done{background:rgba(111,191,115,.07);border-color:rgba(111,191,115,.22)}.aplp .m-row.done .ck{border-color:var(--good)}
.aplp .m-week{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:14px}
.aplp .m-week .d{text-align:center}
.aplp .m-week .dl{font-family:var(--mono);font-size:9px;color:var(--marble-mute);letter-spacing:.06em}
.aplp .m-week .db{height:40px;border-radius:4px;margin-top:4px;display:flex;align-items:flex-end;background:rgba(236,230,216,.04);overflow:hidden}
.aplp .m-week .df{width:100%;border-radius:4px}
.aplp .m-kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:6px}
.aplp .m-kpi .b{background:rgba(236,230,216,.03);border:1px solid var(--line-soft);border-radius:8px;padding:9px 11px}
.aplp .m-kpi .v{font-family:var(--mono);font-size:17px}.aplp .m-kpi .k{font-family:var(--mono);font-size:9px;color:var(--marble-mute);letter-spacing:.1em;text-transform:uppercase;margin-top:2px}
.aplp .m-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:5px}
.aplp .m-cal .cd{aspect-ratio:1;border-radius:5px;border:1px solid var(--line-soft);display:grid;place-items:center;font-family:var(--mono);font-size:10px;color:var(--marble-mute)}
.aplp .m-quote{font-family:var(--serif);font-size:19px;line-height:1.4;color:var(--marble);padding:6px 4px}
.aplp .m-quote .jp{color:var(--bronze-hi);font-size:24px;display:block;margin-bottom:8px}
.aplp .m-msg{display:flex;flex-direction:column;gap:9px}
.aplp .bub{max-width:78%;padding:9px 13px;border-radius:12px;font-size:13px;line-height:1.4}
.aplp .bub.them{align-self:flex-start;background:rgba(236,230,216,.05);border:1px solid var(--line-soft);border-bottom-left-radius:4px}
.aplp .bub.me{align-self:flex-end;background:rgba(200,155,84,.14);border:1px solid var(--line);border-bottom-right-radius:4px}
.aplp .voice{display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--line);border-radius:10px;background:rgba(200,155,84,.05)}
.aplp .eq{display:flex;align-items:flex-end;gap:3px;height:34px}
.aplp .eq span{width:4px;background:var(--bronze);border-radius:2px;animation:aplpEq 1.05s ease-in-out infinite}
@keyframes aplpEq{0%,100%{height:7px}50%{height:30px}}
@media(prefers-reduced-motion:reduce){.aplp .eq span{animation:none;height:18px}}
.aplp .switch{display:inline-flex;background:var(--obsidian-2);border:1px solid var(--line);border-radius:3px;padding:4px;margin-bottom:26px}
.aplp .switch button{font-family:var(--sans);font-size:13.5px;font-weight:600;padding:9px 22px;border:0;border-radius:2px;background:transparent;color:var(--marble-dim);cursor:pointer;transition:background .2s,color .2s}
.aplp .switch button.on{background:var(--bronze);color:var(--obsidian)}
.aplp .switch .sub{font-family:var(--mono);font-size:9px;letter-spacing:.12em;text-transform:uppercase;display:block;opacity:.7;margin-top:2px}
.aplp .panel{display:none}.aplp .panel.show{display:block;animation:aplpFade .35s ease}
@keyframes aplpFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.aplp .panel.show{animation:none}}
.aplp .tiers{display:grid;gap:16px}
.aplp .a2{grid-template-columns:repeat(2,1fr)}
.aplp .c4{grid-template-columns:repeat(4,1fr)}
@media(max-width:900px){.aplp .c4{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.aplp .a2,.aplp .c4{grid-template-columns:1fr}}
.aplp .tier{border:1px solid var(--line-soft);border-radius:3px;padding:24px 20px;background:var(--obsidian);display:flex;flex-direction:column;transition:border-color .2s,transform .2s}
.aplp .tier:hover{border-color:var(--line);transform:translateY(-3px)}
.aplp .tier.feature{border-color:var(--bronze);background:linear-gradient(180deg,rgba(200,155,84,.06),transparent)}
.aplp .tier .badge{font-family:var(--mono);font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--bronze);height:14px}
.aplp .tier .tn{font-family:var(--serif);font-size:19px}
.aplp .tier .price{font-family:var(--serif);font-size:38px;margin:8px 0 2px;font-variant-numeric:tabular-nums}
.aplp .tier .price small{font-size:13px;color:var(--marble-mute);font-family:var(--sans)}
.aplp .tier .blurb{font-size:12.5px;color:var(--marble-dim);min-height:34px}
.aplp .tier ul{list-style:none;padding:0;margin:16px 0 22px;display:flex;flex-direction:column;gap:8px;font-size:12.5px;color:var(--marble-dim)}
.aplp .tier li::before{content:"\\2726 ";color:var(--bronze)}
.aplp .tier .btn{margin-top:auto}.aplp .tier .btn.ghost{color:var(--marble)}
.aplp .note{font-family:var(--mono);font-size:11px;letter-spacing:.05em;color:var(--marble-mute);margin-top:20px}
.aplp .creed{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:var(--obsidian-2);padding:66px 0}
.aplp .creed-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:32px}
.aplp .creed dt{font-family:var(--serif);font-size:22px;color:var(--bronze-hi);margin-bottom:8px}
.aplp .creed dd{margin:0;font-size:13px;color:var(--marble-dim);line-height:1.5}
.aplp .creed dd em{display:block;font-family:var(--mono);font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--marble-mute);margin-bottom:8px;font-style:normal}
@media(max-width:900px){.aplp .creed-grid{grid-template-columns:repeat(2,1fr);gap:28px}}
@media(max-width:480px){.aplp .creed-grid{grid-template-columns:1fr}}
.aplp .close{text-align:center;padding:116px 0 128px}
.aplp .close h2{font-size:clamp(34px,6vw,72px);line-height:1.02}
.aplp .close p{color:var(--marble-dim);max-width:50ch;margin:22px auto 38px;font-size:18px}
.aplp footer{border-top:1px solid var(--line-soft);padding:34px 0;color:var(--marble-mute);font-size:12.5px}
.aplp .foot-in{display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px;align-items:center}
.aplp .foot-links{display:flex;gap:22px}.aplp .foot-links a:hover{color:var(--bronze-hi)}
.aplp .foot-in .mono{font-family:var(--mono);letter-spacing:.05em}
.aplp .reveal{opacity:0;transform:translateY(22px);transition:opacity .8s,transform .8s}
.aplp .reveal.in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){.aplp .reveal{opacity:1;transform:none;transition:none}}
.aplp :focus-visible{outline:2px solid var(--bronze-hi);outline-offset:3px}
`

const BODY = `
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Organization","name":"Atlas Prime","legalName":"Atlas Prime Labs LLC","url":"https://atlasprime.app","description":"AI performance training for serious athletes and the coaches who program for them."},{"@type":"WebSite","name":"Atlas Prime","url":"https://atlasprime.app"},{"@type":"SoftwareApplication","name":"Atlas Prime","applicationCategory":"HealthApplication","operatingSystem":"Web, iOS, Android","offers":[{"@type":"Offer","name":"Athlete Free","price":"0","priceCurrency":"USD"},{"@type":"Offer","name":"Athlete Prime","price":"12","priceCurrency":"USD"},{"@type":"Offer","name":"Coach Starter","price":"19","priceCurrency":"USD"},{"@type":"Offer","name":"Coach Growth","price":"49","priceCurrency":"USD"},{"@type":"Offer","name":"Coach Pro","price":"99","priceCurrency":"USD"}]}]}</script>

<div class="sr-only"><h2>Atlas Prime: AI performance training for athletes and coaches</h2><p>Atlas Prime is an AI powered performance training platform. Athletes get personalized strength and conditioning programs built around their training history, their sport, and their body, with video demonstrations, spoken coaching cues, set tracking, mobility, recovery, and a daily mindset practice. Coaches get a full coaching portal to build programs, manage clients, message athletes, capture voice notes, and deliver cues in their own voice. Plans for athletes and team pricing for coaches. Atlas Prime, by Atlas Prime Labs LLC.</p></div>

<header class="nav"><div class="wrap nav-in">
  <!-- LOGO SWAP (nav) -->
  <div class="brand"><b>ATLAS</b><span>PRIME</span></div>
  <nav class="nav-links"><a href="#athletes">For Athletes</a><a href="#coaches">For Coaches</a><a href="#engine">The Engine</a><a href="#pricing">Pricing</a></nav>
  <div class="nav-right"><a class="login" href="/auth">Log in</a><a class="btn" href="/auth">Start free</a></div>
</div></header>

<main>
  <section class="hero"><canvas id="sky"></canvas><div class="wrap hero-in">
    <span class="eyebrow">Atlas Prime Performance</span>
    <!-- HERO WORDMARK (LOGO SWAP) -->
    <h1 class="wordmark">ATLAS<span class="pr">PRIME</span></h1>
    <p class="lede"><b>Train solo on a program an AI performance team builds around you.</b> Or coach your entire roster from one portal. No generic templates. No lone chatbot guessing at a plan and leaving you to track it yourself.</p>
    <p class="whisper">Atlas bore the heavens on his shoulders. You carry your own weight. We built the system to carry it well.</p>
    <div class="cta-row"><a class="btn" href="#athletes">I train for myself</a><a class="btn ghost" href="#coaches">I coach athletes</a></div>
  </div></section>

  <section><div class="wrap"><div class="trio reveal">
    <div class="cell"><span class="eyebrow">Solo</span><h3>Your own AI program</h3><p>Answer a few questions and get a real, structured plan. No coach required, no cost to start.</p></div>
    <div class="cell"><span class="eyebrow">The engine</span><h3>A team, not a chatbot</h3><p>Every plan is shaped by specialists and adapts as you log your work. This is the part others cannot fake.</p></div>
    <div class="cell"><span class="eyebrow">The portal</span><h3>Built for coaches</h3><p>Run programming, delivery, and your whole client relationship from one place. This is the moat.</p></div>
  </div></div></section>

  <section id="athletes" class="path"><div class="wrap">
    <div class="sec-head reveal"><span class="eyebrow">For Athletes</span><h2>You, on a pro's program. Every single day.</h2><p>Open the app and it tells you exactly what to do, shows you how, reads the cues in your ear, and keeps score. When life moves, the plan moves with you.</p></div>
    <div class="path-grid">
      <ul class="benefits reveal">
        <li><span class="mk">I</span><div><h4>A plan that is actually yours</h4><p>Built around your history, your sport, and your body. Not a template with your name pasted on top.</p></div></li>
        <li><span class="mk">II</span><div><h4>Know what to do, and how</h4><p>Video demos and spoken cues on every movement, so you keep your hands on the bar and your head in the set.</p></div></li>
        <li><span class="mk">III</span><div><h4>It keeps score</h4><p>Log every set. Watch the numbers climb. The plan reads your work and adjusts the next one.</p></div></li>
        <li><span class="mk">IV</span><div><h4>Recovery and mind, on schedule</h4><p>Mobility, deloads, and a daily warrior mindset note, woven in from day one.</p></div></li>
      </ul>
      <div class="carousel reveal" data-carousel="ath">
        <button class="cbtn prev" data-prev aria-label="Previous">&#8249;</button><button class="cbtn next" data-next aria-label="Next">&#8250;</button>
        <div class="viewport"><div class="slides">
          <div class="slide"><div class="scr"><div class="top"><i></i><i></i><i></i><span class="u">atlasprime.app / today</span></div><div class="canvas">
            <div class="m-week"><div class="d"><div class="dl">M</div><div class="db"><div class="df" style="height:62%;background:var(--bronze)"></div></div></div><div class="d"><div class="dl">T</div><div class="db"><div class="df" style="height:40%;background:var(--steel)"></div></div></div><div class="d"><div class="dl">W</div><div class="db"><div class="df" style="height:22%;background:#3a3f48"></div></div></div><div class="d"><div class="dl">T</div><div class="db"><div class="df" style="height:86%;background:var(--alert)"></div></div></div><div class="d"><div class="dl">F</div><div class="db"><div class="df" style="height:55%;background:var(--bronze)"></div></div></div><div class="d"><div class="dl">S</div><div class="db"><div class="df" style="height:70%;background:var(--steel)"></div></div></div><div class="d"><div class="dl">S</div><div class="db"><div class="df" style="height:14%;background:#2a2f38"></div></div></div></div>
            <div class="m-row done"><span class="nm">Back Squat</span><span class="rx">4 &#215; 5 &#183; RPE 8</span><span class="ck">&#10003;</span></div>
            <div class="m-row done"><span class="nm">Romanian Deadlift</span><span class="rx">3 &#215; 8 &#183; RPE 7</span><span class="ck">&#10003;</span></div>
            <div class="m-row"><span class="nm">Bulgarian Split Squat</span><span class="rx">3 &#215; 10 / side</span><span class="ck"></span></div>
            <div class="m-row"><span class="nm">Nordic Curl</span><span class="rx">3 &#215; 6 &#183; tempo</span><span class="ck"></span></div>
            <div class="m-kpi"><div class="b"><div class="v tnum" style="color:var(--good)">72%</div><div class="k">Day done</div></div><div class="b"><div class="v tnum">Build</div><div class="k">Phase</div></div><div class="b"><div class="v tnum">Wk 6</div><div class="k">Cycle</div></div></div>
          </div></div></div>
          <div class="slide"><div class="scr"><div class="top"><i></i><i></i><i></i><span class="u">atlasprime.app / plan</span></div><div class="canvas">
            <div style="font-family:var(--mono);font-size:11px;color:var(--marble-mute);letter-spacing:.1em;margin-bottom:10px">BUILD PHASE &#183; WEEKS 5 TO 8</div>
            <div class="m-cal"><div class="cd" style="border-color:var(--line);color:var(--bronze-hi)">S</div><div class="cd" style="background:rgba(200,155,84,.14);color:var(--marble)">Sq</div><div class="cd">&#183;</div><div class="cd" style="background:rgba(134,169,198,.14);color:var(--marble)">Pu</div><div class="cd" style="background:rgba(217,138,84,.18);color:var(--marble)">Pk</div><div class="cd" style="background:rgba(200,155,84,.14);color:var(--marble)">Hi</div><div class="cd">R</div><div class="cd">R</div><div class="cd" style="background:rgba(200,155,84,.14);color:var(--marble)">Sq</div><div class="cd">&#183;</div><div class="cd" style="background:rgba(134,169,198,.14);color:var(--marble)">Pu</div><div class="cd" style="background:rgba(217,138,84,.18);color:var(--marble)">Pk</div><div class="cd" style="background:rgba(200,155,84,.14);color:var(--marble)">Hi</div><div class="cd">R</div><div class="cd">R</div><div class="cd" style="background:rgba(111,191,115,.14);color:var(--marble)">De</div><div class="cd">&#183;</div><div class="cd" style="background:rgba(111,191,115,.14);color:var(--marble)">De</div><div class="cd">&#183;</div><div class="cd" style="background:rgba(111,191,115,.14);color:var(--marble)">De</div><div class="cd">R</div></div>
            <div class="m-kpi" style="margin-top:14px"><div class="b"><div class="v tnum">13</div><div class="k">Weeks</div></div><div class="b"><div class="v tnum">4</div><div class="k">Days / wk</div></div><div class="b"><div class="v tnum" style="color:var(--good)">On track</div><div class="k">Status</div></div></div>
          </div></div></div>
          <div class="slide"><div class="scr"><div class="top"><i></i><i></i><i></i><span class="u">atlasprime.app / for you</span></div><div class="canvas">
            <div class="m-quote"><span class="jp">&#25913;&#21892; &#183; Kaizen</span>Today is not about the heaviest lift. It is about the one percent you will not see, that shows up in eight weeks. Add it. Leave.</div>
            <div class="m-row" style="margin-top:12px"><span class="nm">&#128264; Listen to today's note</span><span class="rx">1:12</span></div>
            <div class="m-kpi"><div class="b"><div class="v tnum">21</div><div class="k">Day streak</div></div><div class="b"><div class="v tnum">Zanshin</div><div class="k">This week</div></div><div class="b"><div class="v tnum">4.9</div><div class="k">Readiness</div></div></div>
          </div></div></div>
        </div></div>
        <div class="caption" data-caption>Your day, programmed and tracked</div><div class="dots" data-dots></div>
      </div>
    </div>
  </div></section>

  <section id="engine" class="path"><div class="wrap">
    <div class="sec-head reveal" style="max-width:70ch"><span class="eyebrow">The Atlas Prime Intelligence Engine</span><h2>Most apps hand you a plan and walk away. Ours coaches you through it.</h2><p>Behind every program is a team of specialists, not a single model. Your plan carries the judgment of strength, your sport, injury prevention, recovery, and mindset, and it keeps adapting as you train. That depth is the difference between a workout you were handed and a program that is genuinely yours.</p></div>
    <div class="trio reveal"><div class="cell"><span class="eyebrow">Built for you</span><h3>Your context, considered</h3><p>Your history, sport, equipment, and limits all shape the work before you ever see it.</p></div><div class="cell"><span class="eyebrow">Kept safe</span><h3>Vetted, not generic</h3><p>Programming that respects your injuries and your recovery, so you can train hard for years, not weeks.</p></div><div class="cell"><span class="eyebrow">Always current</span><h3>Adapts as you log</h3><p>The plan reads your results and adjusts. It is never the same plan twice.</p></div></div>
  </div></section>

  <section id="coaches" class="path coach"><div class="wrap">
    <div class="sec-head reveal"><span class="eyebrow">For Coaches &#183; the moat</span><h2>Your whole practice, in one portal.</h2><p>Anyone can bolt AI onto a workout app. What cannot be copied is real coaching, delivered well. Atlas Prime gives your experience a place to live, and puts you in every client's ear.</p></div>
    <div class="path-grid">
      <div class="carousel reveal" data-carousel="coa">
        <button class="cbtn prev" data-prev aria-label="Previous">&#8249;</button><button class="cbtn next" data-next aria-label="Next">&#8250;</button>
        <div class="viewport"><div class="slides">
          <div class="slide"><div class="scr"><div class="top"><i></i><i></i><i></i><span class="u">coach / roster</span></div><div class="canvas">
            <div class="m-row"><span class="nm">A. Rivera <span class="rx" style="color:var(--marble-mute)">&#183; Wk 6 &#183; Build</span></span><span class="rx" style="color:var(--good)">92% &#9650;</span></div>
            <div class="m-row"><span class="nm">M. Chen <span class="rx" style="color:var(--marble-mute)">&#183; Wk 3 &#183; Base</span></span><span class="rx" style="color:var(--good)">80% &#9650;</span></div>
            <div class="m-row"><span class="nm">J. Okafor <span class="rx" style="color:var(--marble-mute)">&#183; Wk 9 &#183; Peak</span></span><span class="rx" style="color:var(--alert)">54%</span></div>
            <div class="m-row"><span class="nm">T. Nasser <span class="rx" style="color:var(--marble-mute)">&#183; Wk 1 &#183; Intro</span></span><span class="rx" style="color:var(--alert)">idle 6d</span></div>
            <div class="m-kpi"><div class="b"><div class="v tnum">18</div><div class="k">Clients</div></div><div class="b"><div class="v tnum" style="color:var(--good)">83%</div><div class="k">Avg compliance</div></div><div class="b"><div class="v tnum">7</div><div class="k">Credits left</div></div></div>
          </div></div></div>
          <div class="slide"><div class="scr"><div class="top"><i></i><i></i><i></i><span class="u">coach / messages / A. Rivera</span></div><div class="canvas">
            <div class="m-msg"><div class="bub them">Coach, my knee felt off on the last set of squats.</div><div class="bub me">Good call stopping. I swapped tomorrow to a split squat and dropped the load. It is already in your plan.</div><div class="bub them">Just saw it. This is why I stay.</div></div>
            <div class="voice" style="margin-top:14px"><div class="eq"><span style="animation-delay:0s"></span><span style="animation-delay:.12s"></span><span style="animation-delay:.24s"></span><span style="animation-delay:.36s"></span><span style="animation-delay:.48s"></span></div><div><div style="font-size:13px;font-weight:600">Note captured: Rivera, right knee, monitor</div><div style="font-family:var(--mono);font-size:10.5px;color:var(--marble-mute)">Spoken in 4 seconds. Filed to her profile.</div></div></div>
          </div></div></div>
          <div class="slide"><div class="scr"><div class="top"><i></i><i></i><i></i><span class="u">client view / your voice</span></div><div class="canvas">
            <div class="m-quote" style="font-size:17px">"Brace before you unrack. Big air. Now own it."</div>
            <div class="voice" style="margin-top:6px"><div class="eq"><span></span><span style="animation-delay:.15s"></span><span style="animation-delay:.3s"></span><span style="animation-delay:.45s"></span></div><div><div style="font-size:13px;font-weight:600">Coach Nova, in your ear</div><div style="font-family:var(--mono);font-size:10.5px;color:var(--marble-mute)">Every cue, in your actual voice</div></div></div>
            <div class="m-row" style="margin-top:12px"><span class="nm">Back Squat</span><span class="rx">working set 3 of 4</span><span class="ck">&#9654;</span></div>
          </div></div></div>
        </div></div>
        <div class="caption" data-caption>Your roster, at a glance</div><div class="dots" data-dots></div>
      </div>
      <ul class="benefits reveal">
        <li><span class="mk">I</span><div><h4>Program at the speed of thought</h4><p>Build a client's plan with AI or by hand, from your own library of exercises, cues, and videos.</p></div></li>
        <li><span class="mk">II</span><div><h4>Speak a note, it is filed</h4><p>Say what you noticed about a client and it is written and saved to their profile, ready the next time you open it. No typing between sessions.</p></div></li>
        <li><span class="mk">III</span><div><h4>Your voice, in their ear</h4><p>Clients hear your cues in your actual voice while they train. It feels like you are on the floor with them, even when you are not.</p></div></li>
        <li><span class="mk">IV</span><div><h4>One place for the whole relationship</h4><p>Messaging, compliance, and progress sit right beside the program. Nothing slips through the cracks.</p></div></li>
      </ul>
    </div>
  </div></section>

  <section id="pricing" class="path"><div class="wrap">
    <div class="sec-head reveal" style="margin-bottom:26px"><span class="eyebrow">Pricing</span><h2>Start free. Upgrade when you are ready.</h2><p>Athletes train free to start. Coaches begin with five AI built programs, free. Choose your side.</p></div>
    <div class="switch reveal" role="tablist" aria-label="Choose plan type">
      <button class="on" data-tab="ath" role="tab" aria-selected="true">For Athletes<span class="sub">Train solo</span></button>
      <button data-tab="coa" role="tab" aria-selected="false">For Coaches<span class="sub">Run a practice</span></button>
    </div>
    <div class="panel show" data-panel="ath">
      <div class="tiers a2" style="max-width:620px">
        <div class="tier"><div class="badge"></div><div class="tn">Free</div><div class="price">$0</div><div class="blurb">A real program, on the house.</div><ul><li>5 AI programs to start</li><li>Daily app, demos, tracking</li><li>Mobility and recovery</li></ul><a class="btn ghost" href="/auth">Start training</a></div>
        <div class="tier feature"><div class="badge">Full experience</div><div class="tn">Prime</div><div class="price">$12<small>/mo</small></div><div class="blurb">Unlimited training, no ceilings.</div><ul><li>Unlimited AI programs</li><li>Spoken cues and mindset feed</li><li>Priority everything</li></ul><a class="btn" href="/auth">Go Prime</a></div>
      </div>
      <p class="note">Athlete pricing is a placeholder for preview. USD, cancel anytime.</p>
    </div>
    <div class="panel" data-panel="coa">
      <div class="tiers c4">
        <div class="tier"><div class="badge"></div><div class="tn">Free</div><div class="price">$0</div><div class="blurb">The whole portal, on the house.</div><ul><li>5 AI programs</li><li>Core coach portal</li><li>100 messages / mo</li></ul><a class="btn ghost" href="/auth?as=coach">Get started</a></div>
        <div class="tier feature"><div class="badge">Most popular</div><div class="tn">Starter</div><div class="price">$19<small>/mo</small></div><div class="blurb">For coaches building a roster.</div><ul><li>25 AI programs / mo</li><li>Voice notes and voice in ear</li><li>1,000 messages / mo</li></ul><a class="btn" href="/auth?as=coach">Choose Starter</a></div>
        <div class="tier"><div class="badge"></div><div class="tn">Growth</div><div class="price">$49<small>/mo</small></div><div class="blurb">More programs, more headroom.</div><ul><li>75 AI programs / mo</li><li>Everything in Starter</li><li>5,000 messages / mo</li></ul><a class="btn ghost" href="/auth?as=coach">Choose Growth</a></div>
        <div class="tier"><div class="badge"></div><div class="tn">Pro</div><div class="price">$99<small>/mo</small></div><div class="blurb">High volume, no ceilings.</div><ul><li>200 AI programs / mo</li><li>Unlimited messaging</li><li>Priority everything</li></ul><a class="btn ghost" href="/auth?as=coach">Choose Pro</a></div>
      </div>
      <p class="note">USD, cancel anytime.</p>
    </div>
  </div></section>

  <section class="creed"><div class="wrap">
    <div class="sec-head reveal" style="margin-bottom:44px"><span class="eyebrow">The Creed</span><h2>Train with the mind of a warrior.</h2></div>
    <dl class="creed-grid reveal">
      <div><dt>&#28961;&#24515;</dt><dd><em>Mushin</em>No mind. Act without hesitation. The plan is already made.</dd></div>
      <div><dt>&#25913;&#21892;</dt><dd><em>Kaizen</em>Continuous improvement. One percent, every single day.</dd></div>
      <div><dt>&#32887;&#20154;</dt><dd><em>Shokunin</em>Mastery of craft. Show up like the work deserves it.</dd></div>
      <div><dt>&#27531;&#24515;</dt><dd><em>Zanshin</em>Relaxed awareness. Present through the last rep.</dd></div>
      <div><dt>&#19981;&#21205;&#24515;</dt><dd><em>Fudoshin</em>The immovable mind. Unshaken by the hard day.</dd></div>
    </dl>
  </div></section>

  <section class="close"><div class="wrap reveal">
    <span class="eyebrow">Your weight. Your outcome.</span><h2>Bear the weight.<br>Command the outcome.</h2><p>Start free today. Bring yourself, or bring your whole roster.</p>
    <div class="cta-row" style="justify-content:center"><a class="btn" href="/auth">Start free</a><a class="btn ghost" href="/auth">Log in</a></div>
  </div></section>
</main>

<footer><div class="wrap foot-in">
  <!-- LOGO SWAP (footer) -->
  <div class="brand" style="font-size:15px"><b>ATLAS</b><span>PRIME</span></div>
  <div class="foot-links"><a href="/auth">Log in</a><a href="/legal/privacy">Privacy</a><a href="/legal/terms">Terms</a></div>
  <div class="mono">&#169; 2026 Atlas Prime Labs LLC</div>
</div></footer>
`

export default function LandingPage() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches
    const cleanups: Array<() => void> = []

    // ---- starfield ----
    const c = root.querySelector('#sky') as HTMLCanvasElement | null
    if (c) {
      const x = c.getContext('2d')!
      let w = 0, h = 0, stars: any[] = [], arcs: any[] = [], t = 0, raf = 0, rt: any
      const build = () => {
        stars = []; const n = Math.round(w * h / 6500)
        for (let i = 0; i < n; i++) stars.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + 0.2, b: Math.random() * 0.6 + 0.15, tw: Math.random() * Math.PI * 2, sp: Math.random() * 0.9 + 0.2 })
        arcs = []; const cx = w * 0.5, cy = h * 0.32
        for (let a = 0; a < 5; a++) arcs.push({ rx: 120 + a * 95, ry: 70 + a * 54, rot: -0.5 + a * 0.18, off: Math.random() * Math.PI * 2, sp: 0.0007 + a * 0.00016, cx, cy })
      }
      const size = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; x.setTransform(dpr, 0, 0, dpr, 0, 0); build()
      }
      const draw = () => {
        x.clearRect(0, 0, w, h)
        const g = x.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, Math.max(w, h) * 0.5)
        g.addColorStop(0, 'rgba(200,155,84,0.10)'); g.addColorStop(0.4, 'rgba(200,155,84,0.03)'); g.addColorStop(1, 'rgba(10,11,15,0)')
        x.fillStyle = g; x.fillRect(0, 0, w, h)
        for (const A of arcs) {
          x.save(); x.translate(A.cx, A.cy); x.rotate(A.rot)
          x.beginPath(); x.ellipse(0, 0, A.rx, A.ry, 0, 0, Math.PI * 2); x.strokeStyle = 'rgba(236,230,216,0.05)'; x.lineWidth = 1; x.stroke()
          const ang = A.off + t * A.sp * 1000, px = Math.cos(ang) * A.rx, py = Math.sin(ang) * A.ry
          x.beginPath(); x.arc(px, py, 1.7, 0, Math.PI * 2); x.fillStyle = 'rgba(231,200,136,0.9)'; x.shadowColor = 'rgba(231,200,136,0.8)'; x.shadowBlur = 8; x.fill(); x.shadowBlur = 0
          x.restore()
        }
        for (const S of stars) {
          const tw = reduce ? 1 : (0.6 + 0.4 * Math.sin(S.tw + t * S.sp))
          x.beginPath(); x.arc(S.x, S.y, S.r, 0, Math.PI * 2); x.fillStyle = 'rgba(236,230,216,' + (S.b * tw) + ')'; x.fill()
        }
      }
      const loop = () => { t += 0.016; draw(); if (!reduce) raf = requestAnimationFrame(loop) }
      size(); draw(); if (!reduce) raf = requestAnimationFrame(loop)
      const onResize = () => { clearTimeout(rt); rt = setTimeout(size, 150) }
      window.addEventListener('resize', onResize)
      cleanups.push(() => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize) })
    }

    // ---- carousels ----
    const CAPS: Record<string, string[]> = {
      ath: ['Your day, programmed and tracked', 'Your full cycle, mapped out', 'Mindset, delivered daily'],
      coa: ['Your roster, at a glance', 'Message and note in one place', 'Your voice, in every ear'],
    }
    root.querySelectorAll('[data-carousel]').forEach(cr => {
      const key = cr.getAttribute('data-carousel') || 'ath'
      const track = cr.querySelector('.slides') as HTMLElement
      const slides = cr.querySelectorAll('.slide')
      const dotsWrap = cr.querySelector('[data-dots]') as HTMLElement
      const cap = cr.querySelector('[data-caption]') as HTMLElement
      const caps = CAPS[key] || []
      const n = slides.length; let i = 0; let timer: any
      for (let d = 0; d < n; d++) {
        const b = document.createElement('button'); b.className = 'dot' + (d === 0 ? ' on' : ''); b.setAttribute('aria-label', 'Slide ' + (d + 1))
        b.addEventListener('click', () => { go(d); rearm() }); dotsWrap.appendChild(b)
      }
      const dots = dotsWrap.querySelectorAll('.dot')
      const go = (k: number) => { i = (k + n) % n; track.style.transform = 'translateX(-' + (i * 100) + '%)'; dots.forEach((dd, j) => dd.classList.toggle('on', j === i)); if (cap && caps[i]) cap.textContent = caps[i] }
      const rearm = () => { if (reduce) return; clearInterval(timer); timer = setInterval(() => go(i + 1), 5200) }
      const next = cr.querySelector('[data-next]'); const prev = cr.querySelector('[data-prev]')
      next && next.addEventListener('click', () => { go(i + 1); rearm() })
      prev && prev.addEventListener('click', () => { go(i - 1); rearm() })
      rearm(); cleanups.push(() => clearInterval(timer))
    })

    // ---- pricing toggle ----
    const tabs = root.querySelectorAll('[data-tab]')
    tabs.forEach(tb => tb.addEventListener('click', () => {
      const which = tb.getAttribute('data-tab')
      root.querySelectorAll('[data-panel]').forEach(p => p.classList.toggle('show', p.getAttribute('data-panel') === which))
      tabs.forEach(o => { const on = o === tb; o.classList.toggle('on', on); o.setAttribute('aria-selected', String(on)) })
    }))

    // ---- reveal ----
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { threshold: 0.1 })
    root.querySelectorAll('.reveal').forEach(el => io.observe(el))
    cleanups.push(() => io.disconnect())

    return () => cleanups.forEach(fn => fn())
  }, [])

  return <div className="aplp" ref={ref} dangerouslySetInnerHTML={{ __html: `<style>${CSS}</style>${BODY}` }} />
}
