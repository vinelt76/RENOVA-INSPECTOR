export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="VULCAN INSPECTOR · MOVIMIENTOS">
      <span>VULCAN</span>
      <small>INSPECTOR · MOVIMIENTOS</small>
    </div>
  );
}
