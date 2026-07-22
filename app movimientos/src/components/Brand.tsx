export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="RENOVA Movimientos">
      <span>RENOVA</span>
      <small>MOVIMIENTOS</small>
    </div>
  );
}
