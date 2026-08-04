'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'

// Bottom sheet with the dismissal gestures people expect on a phone.
//
// The exercise sheets previously offered a single × in the top corner, which
// means reaching the top of the screen one-handed to close something you opened
// with your thumb. This adds the two gestures every native sheet has: a grab
// handle you can drag down, and a tap outside. Escape still works on desktop.

const DISMISS_DISTANCE = 110   // px dragged before it closes on release
const DISMISS_VELOCITY = 0.5   // px/ms, so a short fast flick also closes it

export default function BottomSheet({
  onClose, children, header, maxWidth = 480, labelledBy, onBodyScroll,
}: {
  onClose: () => void
  /** Scrolling body. */
  children: ReactNode
  /** Pinned above the scroll area. Dragging it also dismisses the sheet. */
  header?: ReactNode
  maxWidth?: number
  labelledBy?: string
  /** Scroll position of the body, for content that reacts to scrolling. */
  onBodyScroll?: (scrollTop: number) => void
}) {
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const startRef = useRef<{ y: number; t: number } | null>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Dragging is allowed from the handle always, and from the body only when it
  // is scrolled to the top. Otherwise scrolling back up through the
  // instructions would drag the whole sheet down instead.
  function canDragFromBody() {
    return (scrollRef.current?.scrollTop ?? 0) <= 0
  }

  function onTouchStart(e: React.TouchEvent, fromHandle: boolean) {
    if (!fromHandle && !canDragFromBody()) return
    startRef.current = { y: e.touches[0].clientY, t: e.timeStamp }
    setDragging(true)
  }

  function onTouchMove(e: React.TouchEvent) {
    const start = startRef.current
    if (!start) return
    const dy = e.touches[0].clientY - start.y
    // Downward only. Pulling up should do nothing.
    setDragY(dy > 0 ? dy : 0)
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = startRef.current
    startRef.current = null
    setDragging(false)
    if (!start) return
    const elapsed = Math.max(e.timeStamp - start.t, 1)
    const velocity = dragY / elapsed
    if (dragY > DISMISS_DISTANCE || velocity > DISMISS_VELOCITY) {
      onClose()
      return
    }
    setDragY(0)
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={e => e.stopPropagation()}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          background: 'var(--surface)',
          borderRadius: '20px 20px 0 0',
          width: '100%',
          maxWidth,
          border: '1px solid var(--border)',
          borderBottom: 'none',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          transform: `translateY(${dragY}px)`,
          transition: dragging ? 'none' : 'transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
          touchAction: 'pan-y',
        }}
      >
        {/* Grab handle. Also the affordance that tells you the sheet can be dragged. */}
        <div
          onTouchStart={e => onTouchStart(e, true)}
          style={{ padding: '10px 0 4px', display: 'flex', justifyContent: 'center', flexShrink: 0, touchAction: 'none' }}
        >
          <div style={{ width: 38, height: 4, borderRadius: 2, background: 'var(--border2, var(--border))' }} />
        </div>

        {header && (
          <div onTouchStart={e => onTouchStart(e, true)} style={{ flexShrink: 0, touchAction: 'none' }}>
            {header}
          </div>
        )}

        <div
          ref={scrollRef}
          onTouchStart={e => onTouchStart(e, false)}
          onScroll={onBodyScroll ? e => onBodyScroll(e.currentTarget.scrollTop) : undefined}
          style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' as never, flexGrow: 1, minHeight: 0 }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
