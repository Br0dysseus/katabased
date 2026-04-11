export default function Loading() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#04050C',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: 48,
          fontWeight: 700,
          fontFamily: "'Cormorant Garamond', serif",
          fontStyle: 'italic',
          color: '#6B9FD4',
          marginBottom: 16,
          opacity: 0.8,
        }}>
          Kβ
        </div>
        <div style={{
          fontSize: 11,
          letterSpacing: '0.2em',
          color: 'rgba(107,159,212,0.35)',
        }}>
          INITIALIZING
        </div>
      </div>
    </div>
  );
}
