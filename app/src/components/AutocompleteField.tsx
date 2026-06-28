import { useState, useRef, useEffect } from 'react';
import { MONO, NAVY, BORDER, MUTED, INK, FIELD_BG, ORANGE } from '../theme';

const labelStyle = {
  fontSize: 11, fontWeight: 800, color: MUTED, letterSpacing: '0.12em',
  display: 'block' as const, marginBottom: 6, fontFamily: MONO,
};

interface Props {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  allowNew?: boolean;
  onNew?: (val: string) => void;
}

export default function AutocompleteField({
  label, value, onChange, options, placeholder = 'Buscar…',
  disabled = false, allowNew = false, onNew,
}: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const q = query.trim();

  // starts-with filter (case-insensitive); campo vacío → sin sugerencias
  const filtered = q === ''
    ? []
    : options.filter(o => o.toLowerCase().startsWith(q.toLowerCase())).slice(0, 30);

  const exactMatch = options.some(o => o.toLowerCase() === q.toLowerCase());
  const showAddNew = allowNew && q.length > 0 && !exactMatch;

  const select = (opt: string) => {
    setQuery(opt);
    onChange(opt);
    setOpen(false);
  };

  const handleNew = () => {
    const val = query.trim();
    if (!val) return;
    onNew?.(val);
    onChange(val);
    setOpen(false);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        if (q) {
          if (exactMatch) {
            const found = options.find(o => o.toLowerCase() === q.toLowerCase());
            if (found) { setQuery(found); onChange(found); }
          } else if (allowNew) {
            onNew?.(q);
            onChange(q);
          } else {
            setQuery('');
            onChange('');
          }
        }
        setOpen(false);
      }
    }, 150);
  };

  const filled = !!value;
  const borderColor = disabled ? BORDER : filled ? NAVY : open ? ORANGE : BORDER;
  const showDropdown = open && !disabled && (filtered.length > 0 || showAddNew);

  return (
    <div style={{ width: '100%' }} ref={containerRef}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          border: `2px solid ${borderColor}`, borderRadius: 10,
          background: disabled ? '#f4f6f9' : FIELD_BG,
          transition: 'border-color 0.15s',
        }}>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder={placeholder}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              padding: '11px 12px', fontSize: 13, fontWeight: 700,
              color: disabled ? MUTED : INK, fontFamily: MONO,
              cursor: disabled ? 'not-allowed' : 'text',
            }}
          />
          {filled && !disabled && (
            <button
              onMouseDown={e => { e.preventDefault(); setQuery(''); onChange(''); setOpen(false); }}
              style={{ background: 'none', border: 'none', padding: '0 10px', color: MUTED, fontSize: 16, cursor: 'pointer', lineHeight: 1 }}
            >×</button>
          )}
        </div>

        {showDropdown && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
            background: '#fff', border: `2px solid ${BORDER}`, borderRadius: 10,
            marginTop: 4, maxHeight: 220, overflowY: 'auto',
            boxShadow: '0 8px 24px rgba(21,35,63,0.13)',
          }}>
            {filtered.map(opt => (
              <button
                key={opt}
                onMouseDown={e => { e.preventDefault(); select(opt); }}
                onTouchEnd={e => { e.preventDefault(); select(opt); }}
                style={{
                  width: '100%', textAlign: 'left',
                  background: opt === value ? NAVY : 'transparent',
                  border: 'none', padding: '10px 14px', fontSize: 13, fontWeight: 700,
                  color: opt === value ? '#fff' : INK, cursor: 'pointer', fontFamily: MONO,
                  borderBottom: `1px solid ${BORDER}`,
                }}
              >{opt}</button>
            ))}
            {showAddNew && (
              <button
                onMouseDown={e => { e.preventDefault(); handleNew(); }}
                onTouchEnd={e => { e.preventDefault(); handleNew(); }}
                style={{
                  width: '100%', textAlign: 'left', background: 'transparent',
                  border: 'none', padding: '10px 14px', fontSize: 13, fontWeight: 700,
                  color: ORANGE, cursor: 'pointer', fontFamily: MONO,
                  borderTop: filtered.length > 0 ? `1px solid ${BORDER}` : 'none',
                }}
              >＋ Agregar "{query.trim()}"</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
