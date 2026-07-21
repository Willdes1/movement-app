// Zero-dependency markdown -> safe HTML for blog article bodies.
// The content engine constrains AI output to this subset: #/##/### headings,
// **bold**, *italic*, `code`, [links](url), - / 1. lists, > quotes, --- rules,
// and blank-line-separated paragraphs. Source is HTML-escaped FIRST, so stored
// content can never inject raw markup.

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Inline formatting. Input is already HTML-escaped, so markdown delimiters
// (*, `, [], ()) survive and are safe to transform.
function inline(s: string): string {
  let out = s
  // links [text](url) — only http(s) or root-relative, else drop to '#'
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) => {
    const safe = /^https?:\/\//i.test(url) || url.startsWith('/') ? url : '#'
    const ext = /^https?:\/\//i.test(safe)
    return `<a href="${safe}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`
  })
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>')
  return out
}

export function renderMarkdown(md: string): string {
  const lines = (md ?? '').replace(/\r\n/g, '\n').split('\n')
  const html: string[] = []
  let para: string[] = []
  let i = 0

  const flushPara = () => {
    if (para.length) { html.push(`<p>${inline(esc(para.join(' ')))}</p>`); para = [] }
  }

  while (i < lines.length) {
    const trimmed = lines[i].trim()

    if (!trimmed) { flushPara(); i++; continue }

    const h = /^(#{1,4})\s+(.*)$/.exec(trimmed)
    if (h) {
      flushPara()
      const lvl = Math.min(h[1].length + 1, 5) // '#' -> h2 (h1 is the page title)
      html.push(`<h${lvl}>${inline(esc(h[2]))}</h${lvl}>`)
      i++; continue
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) { flushPara(); html.push('<hr />'); i++; continue }

    if (/^>\s?/.test(trimmed)) {
      flushPara()
      const quote: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        quote.push(lines[i].trim().replace(/^>\s?/, '')); i++
      }
      html.push(`<blockquote>${inline(esc(quote.join(' ')))}</blockquote>`)
      continue
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushPara()
      const items: string[] = []
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(`<li>${inline(esc(lines[i].trim().replace(/^[-*]\s+/, '')))}</li>`); i++
      }
      html.push(`<ul>${items.join('')}</ul>`)
      continue
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushPara()
      const items: string[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(`<li>${inline(esc(lines[i].trim().replace(/^\d+\.\s+/, '')))}</li>`); i++
      }
      html.push(`<ol>${items.join('')}</ol>`)
      continue
    }

    para.push(trimmed); i++
  }
  flushPara()
  return html.join('\n')
}

export function slugify(s: string): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

export function readingTime(md: string): number {
  const words = (md ?? '').trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}
