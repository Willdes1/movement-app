import { ImageResponse } from 'next/og'

// Code-generated 1200x630 share card for atlasprime.app "/".
// Branded in the app palette (near-black + orange-red). No font asset needed —
// ImageResponse renders with its built-in sans, so this stays self-contained.
// Next injects og:image automatically; twitter-image re-exports this file.

export const alt = 'Atlas Prime — AI performance training for athletes and coaches'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background:
            'radial-gradient(circle at 78% 12%, rgba(255,92,53,0.22), transparent 55%), #0c0c0f',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Brand row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 26,
              height: 26,
              background: '#FF5C35',
              transform: 'rotate(45deg)',
              borderRadius: 5,
            }}
          />
          <div
            style={{
              display: 'flex',
              fontSize: 34,
              fontWeight: 900,
              letterSpacing: -1,
              color: '#f2f0f7',
            }}
          >
            ATLAS<span style={{ color: '#FF5C35' }}>PRIME</span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: 'uppercase',
              color: '#FF5C35',
              marginBottom: 20,
            }}
          >
            AI Performance Training
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 96,
              fontWeight: 900,
              letterSpacing: -4,
              lineHeight: 1,
              color: '#f2f0f7',
            }}
          >
            Train like you mean it.
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 34,
              color: '#9993aa',
              marginTop: 28,
              maxWidth: 900,
              lineHeight: 1.3,
            }}
          >
            Your own AI program, rebuilt around you every week. Or coach your whole roster from one place.
          </div>
        </div>

        {/* Footer row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            fontSize: 26,
            color: '#5a5566',
            fontWeight: 600,
          }}
        >
          <span style={{ color: '#f2f0f7' }}>atlasprime.app</span>
          <span>For athletes and coaches</span>
        </div>
      </div>
    ),
    { ...size },
  )
}
