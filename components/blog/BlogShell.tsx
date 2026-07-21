import Link from 'next/link'

// Public blog chrome + typography. Namespaced under .apblog so it never touches
// the app's global styles. Uses the Atlas Prime landing palette so the blog,
// the marketing site, and the app all read as one product.

const BLOG_CSS = `
.apblog{--bg:#0c0c0f;--surface:#131318;--surface2:#1a1a22;--border:rgba(255,255,255,.08);
  --border2:rgba(255,255,255,.14);--text:#f2f0f7;--text-mid:#9993aa;--text-dim:#5a5566;
  --accent:#FF5C35;--accent-warm:#FF8C42;--accent-bg:rgba(255,92,53,.1);
  --sans:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  background:var(--bg);color:var(--text);font-family:var(--sans);line-height:1.6;
  -webkit-font-smoothing:antialiased;overflow-x:hidden;min-height:100vh;display:flex;flex-direction:column}
.apblog *{box-sizing:border-box}
.apblog a{color:inherit;text-decoration:none}
.apblog .apb-wrap{max-width:1080px;margin:0 auto;padding:0 24px;width:100%}
.apblog .apb-nav{position:sticky;top:0;z-index:30;background:rgba(12,12,15,.8);backdrop-filter:blur(14px);border-bottom:1px solid var(--border)}
.apblog .apb-nav-in{display:flex;align-items:center;justify-content:space-between;height:60px}
.apblog .apb-brand{font-weight:900;letter-spacing:-.02em;font-size:18px;display:flex;align-items:center;gap:9px;color:var(--text)}
.apblog .apb-brand em{font-style:normal;color:var(--accent)}
.apblog .apb-spark{width:10px;height:10px;border-radius:2px;background:var(--accent);box-shadow:0 0 14px var(--accent);transform:rotate(45deg);flex-shrink:0}
.apblog .apb-nav-right{display:flex;align-items:center;gap:18px}
.apblog .apb-link{font-size:13.5px;color:var(--text-mid);font-weight:600}.apblog .apb-link:hover{color:var(--text)}
.apblog .apb-btn{font-size:13.5px;font-weight:800;padding:10px 18px;border-radius:10px;background:var(--accent);color:#0c0c0f;transition:transform .14s,box-shadow .2s,background .2s;display:inline-block}
.apblog .apb-btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(255,92,53,.4);background:var(--accent-warm)}
.apblog .apb-main{flex:1;padding:56px 24px 90px}
.apblog .apb-hero{max-width:760px;margin:0 auto 52px}
.apblog .apb-eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);font-weight:600}
.apblog .apb-hero h1{font-size:clamp(32px,6vw,54px);font-weight:800;letter-spacing:-.035em;line-height:1.05;margin:16px 0 0}
.apblog .apb-sub{color:var(--text-mid);font-size:18px;margin:18px 0 0;line-height:1.5}
.apblog .apb-empty{color:var(--text-mid);text-align:center;padding:60px 0}
.apblog .apb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px}
.apblog .apb-card{background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:10px;transition:border-color .2s,transform .14s}
.apblog .apb-card:hover{border-color:var(--accent);transform:translateY(-3px)}
.apblog .apb-card-emoji{font-size:28px;line-height:1}
.apblog .apb-card-cat{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--accent);font-weight:600}
.apblog .apb-card h2{font-size:19px;font-weight:750;letter-spacing:-.01em;line-height:1.25;margin:0}
.apblog .apb-card p{color:var(--text-mid);font-size:14px;margin:0;line-height:1.5}
.apblog .apb-article{max-width:720px;margin:0 auto}
.apblog .apb-back{font-size:13px;color:var(--text-mid);font-weight:600;display:inline-block;margin-bottom:22px}.apblog .apb-back:hover{color:var(--accent)}
.apblog .apb-article h1{font-size:clamp(30px,5.5vw,46px);font-weight:800;letter-spacing:-.035em;line-height:1.1;margin:12px 0 0}
.apblog .apb-meta{font-family:var(--mono);font-size:12px;color:var(--text-dim);margin:18px 0 34px;letter-spacing:.04em}
.apblog .apb-body{font-size:17px;color:#d9d5e2}
.apblog .apb-body h2{font-size:26px;font-weight:800;letter-spacing:-.02em;margin:42px 0 14px;color:var(--text)}
.apblog .apb-body h3{font-size:20px;font-weight:750;margin:30px 0 10px;color:var(--text)}
.apblog .apb-body p{margin:0 0 18px}
.apblog .apb-body ul,.apblog .apb-body ol{margin:0 0 18px;padding-left:22px}
.apblog .apb-body li{margin:0 0 8px}
.apblog .apb-body strong{color:var(--text);font-weight:700}
.apblog .apb-body a{color:var(--accent);text-decoration:underline;text-underline-offset:2px}
.apblog .apb-body code{font-family:var(--mono);font-size:.88em;background:var(--surface2);border:1px solid var(--border);border-radius:5px;padding:2px 6px}
.apblog .apb-body blockquote{border-left:3px solid var(--accent);margin:0 0 18px;padding:4px 0 4px 18px;color:var(--text-mid);font-style:italic}
.apblog .apb-body hr{border:0;border-top:1px solid var(--border);margin:32px 0}
.apblog .apb-cta{margin-top:54px;background:var(--surface);border:1px solid var(--accent);border-radius:18px;padding:32px;text-align:center}
.apblog .apb-cta h3{font-size:24px;font-weight:800;letter-spacing:-.02em;margin:0}
.apblog .apb-cta p{color:var(--text-mid);margin:10px 0 20px}
.apblog .apb-foot{border-top:1px solid var(--border);padding:28px 0;color:var(--text-dim);font-size:12.5px}
.apblog .apb-foot-in{display:flex;justify-content:space-between;flex-wrap:wrap;gap:14px;align-items:center}
.apblog .apb-foot-links{display:flex;gap:20px}.apblog .apb-foot-links a:hover{color:var(--accent)}
.apblog :focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media(max-width:480px){.apblog .apb-main{padding:40px 20px 70px}.apblog .apb-link{display:none}}
`

export default function BlogShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="apblog">
      <style dangerouslySetInnerHTML={{ __html: BLOG_CSS }} />
      <header className="apb-nav"><div className="apb-wrap apb-nav-in">
        <Link href="/" className="apb-brand"><span className="apb-spark" />ATLAS<em>PRIME</em></Link>
        <div className="apb-nav-right">
          <Link href="/blog" className="apb-link">Blog</Link>
          <Link href="/auth" className="apb-btn">Start free</Link>
        </div>
      </div></header>

      <main className="apb-wrap apb-main">{children}</main>

      <footer className="apb-foot"><div className="apb-wrap apb-foot-in">
        <Link href="/" className="apb-brand" style={{ fontSize: 15 }}><span className="apb-spark" />ATLAS<em>PRIME</em></Link>
        <div className="apb-foot-links">
          <Link href="/auth">Log in</Link>
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
        </div>
        <div style={{ fontFamily: 'var(--mono)' }}>© 2026 Atlas Prime Labs LLC</div>
      </div></footer>
    </div>
  )
}
