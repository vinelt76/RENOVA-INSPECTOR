import { memo } from 'react';
import { REASON_LABELS, TIRE_CONDITIONS } from '../lib/model';
import type {
  ExecutionItem,
  ExecutionService,
  MovementReason,
  TireCondition,
} from '../lib/types';

const REASONS = Object.entries(REASON_LABELS) as [MovementReason, string][];

interface Props {
  service: ExecutionService;
  invalid?: boolean;
  prefilled?: boolean;
  onChange: (index: number, patch: Partial<ExecutionItem>) => void;
}

interface TireGroupProps {
  direction: 'exit' | 'entry';
  item: ExecutionItem;
  itemIndex: number;
  prefilled: boolean;
  onChange: Props['onChange'];
}

function originLabel(item: ExecutionItem): string {
  if (item.origin_type === 'vehicle' && item.origin_position) {
    return `MISMA UNIDAD · DESDE P${item.origin_position}`;
  }
  if (item.origin_type === 'inventory') return 'RETÉN / INVENTARIO';
  return 'ORIGEN NO DETERMINADO';
}

function TireDataGroup({ direction, item, itemIndex, prefilled, onChange }: TireGroupProps) {
  const isExit = direction === 'exit';
  const set = (patch: Partial<ExecutionItem>) => onChange(itemIndex, patch);
  const hasTechnicalData = Boolean(item.code || item.brand || item.size || item.design || item.rtd_min_mm);
  const identitySummary = item.code_unreadable
    ? 'CÓDIGO NO LEGIBLE'
    : [item.code || 'CÓDIGO PENDIENTE', item.brand, item.design, item.size, item.rtd_min_mm ? `${item.rtd_min_mm} MM` : '']
      .filter(Boolean)
      .join(' · ');

  return (
    <section
      className={`service-movement service-movement--${direction}`}
      data-movement-direction={direction}
    >
      <div className="service-movement__heading">
        <span className="direction-chip">{isExit ? 'SALE' : 'ENTRA'}</span>
        <div>
          <strong>{isExit ? 'NEUMÁTICO QUE SALE' : 'NEUMÁTICO QUE ENTRA'}</strong>
        </div>
      </div>

      {!isExit ? (
        <div className={`origin-panel origin-panel--${item.origin_type}`}>
          <span>ORIGEN</span>
          <strong>{originLabel(item)}</strong>
        </div>
      ) : null}

      {isExit ? (
        <label className="field field--full">
          <span>RAZÓN / DESTINO DE SALIDA</span>
          <select value={item.reason} onChange={(event) => set({ reason: event.target.value as MovementReason })}>
            <option value="">SELECCIONAR</option>
            {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      ) : null}

      <p className="tire-identity-summary">{identitySummary}</p>

      <details className="technical-details" open={!prefilled || !hasTechnicalData}>
        <summary>EDITAR DATOS TÉCNICOS</summary>
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
            {TIRE_CONDITIONS.map((condition) => <option key={condition}>{condition}</option>)}
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
      </details>
    </section>
  );
}

function ServiceCard({ service, invalid = false, prefilled = false, onChange }: Props) {
  return (
    <article
      className={`service-card${invalid ? ' service-card--error' : ''}`}
      data-service-position={service.position}
      aria-describedby={invalid ? `service-error-${service.position}` : undefined}
    >
      <header className="service-card__heading">
        <div>
          <strong>POSICIÓN P{service.position}</strong>
        </div>
        {prefilled ? <small className="service-card__prefilled">DATOS PRECARGADOS</small> : null}
      </header>
      {invalid ? <p className="service-card__error" id={`service-error-${service.position}`} role="alert">Revisa los datos obligatorios de esta posición.</p> : null}

      <div className="service-card__groups">
        {service.exit && service.exitIndex !== null ? (
          <TireDataGroup
            direction="exit"
            item={service.exit}
            itemIndex={service.exitIndex}
            prefilled={prefilled}
            onChange={onChange}
          />
        ) : null}
        {service.entry && service.entryIndex !== null ? (
          <TireDataGroup
            direction="entry"
            item={service.entry}
            itemIndex={service.entryIndex}
            prefilled={prefilled}
            onChange={onChange}
          />
        ) : null}
      </div>
    </article>
  );
}

export default memo(ServiceCard);
