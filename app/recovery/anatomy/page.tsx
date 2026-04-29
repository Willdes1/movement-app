export default function AnatomyExplorerPage() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 40, background: '#020208' }}>
      <iframe
        src="/anatomy-explorer.html"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        title="Anatomy Explorer — Move."
      />
    </div>
  )
}
