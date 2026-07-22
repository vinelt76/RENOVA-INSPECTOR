import { memo } from 'react';
import { REASON_LABELS } from '../lib/model';
import type { ExecutionItem, MovementReason, TireCondition } from '../lib/types';

const REASONS = Object.entries(REASON_LABELS) as [MovementReason, string][];
const CONDITIONS: TireCondition[] = ['N', 'R1', 'R2', 'R3', 'R4'];

interface Props {
  index: number;
  item: ExecutionItem;
  onChange: (index: number, patch: Partial<ExecutionItem>) => void;
}

function MovementCard({ index, item, onChange }: Props) {
  const set = (patch: Partial<ExecutionItem>) => onChange(index, patch);
  const isExit = item.direction === 'exit';

  return (
    <article className={`movement-card movement-card--${item.direction}`}>
      <div className="movement-card__title">
        <span className="direction-chip">{isExit ? 'SALIDA' : 'INGRESO'}</span>
        <strong>POSICIÓN P{item.position}</strong>
        <span>{String(index + 1).padStart(2, '0')}</span>
      </div>

      {isExit ? (
        <label className="field field--full">
          <span>TIPO DE MOVIMIENTO / DESTINO</span>
          <select value={item.reason} onChange={(event) => set({ reason: event.target.value as MovementReason })}>
            <option value="">SELECCIONAR</option>
            {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      ) : null}

      <div className="field-grid">
        <label className="field field--wide">
          <span>CÓDIGO</span>
          <input
            value={item.code}
            disabled={item.code_unreadable}
            onChange={(event) => set({ code: event.target.value.toUpperCase() })}
            placeholder="CÓDIGO DEL CASCO"
            autoCapitalize="characters"
          />
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={item.code_unreadable}
            onChange={(event) => set({ code_unreadable: event.target.checked, code: '' })}
          />
          <span>SIN CÓDIGO LEGIBLE</span>
        </label>

        <label className="field">
          <span>MARCA</span>
          <input value={item.brand} onChange={(event) => set({ brand: event.target.value.toUpperCase() })} />
        </label>
        <label className="field">
          <span>MEDIDA</span>
          <input value={item.size} onChange={(event) => set({ size: event.target.value.toUpperCase() })} placeholder="295/80R22.5" />
        </label>
        <label className="field">
          <span>DISEÑO</span>
          <input value={item.design} onChange={(event) => set({ design: event.target.value.toUpperCase() })} />
        </label>
        <label className="field">
          <span>RTD MÍNIMO</span>
          <div className="input-unit">
            <input type="number" inputMode="decimal" min="0" step="0.1" value={item.rtd_min_mm} onChange={(event) => set({ rtd_min_mm: event.target.value })} />
            <b>MM</b>
          </div>
        </label>
        <label className="field">
          <span>CONDICIÓN</span>
          <select value={item.condition} onChange={(event) => set({ condition: event.target.value as TireCondition })}>
            {CONDITIONS.map((condition) => <option key={condition}>{condition}</option>)}
          </select>
        </label>
        {item.condition !== 'N' ? (
          <label className="field">
            <span>DISEÑO DE REENCAUCHE</span>
            <input value={item.retread_design} onChange={(event) => set({ retread_design: event.target.value.toUpperCase() })} />
          </label>
        ) : null}
      </div>

      <label className="field field--full">
        <span>OBSERVACIONES</span>
        <textarea rows={2} value={item.observations} onChange={(event) => set({ observations: event.target.value })} placeholder="DETALLE DEL TRABAJO" />
      </label>
    </article>
  );
}

export default memo(MovementCard);
