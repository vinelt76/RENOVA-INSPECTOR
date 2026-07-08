import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MONO, NAVY, LABEL_BLUE, BORDER_DARK, FIELD_DARK, VALUE_COLOR, ORANGE } from '../theme';

const labelStyle = {
  fontSize: 11, fontWeight: 800, color: LABEL_BLUE, letterSpacing: '0.1em',
  display: 'block' as const, marginBottom: 8, fontFamily: MONO,
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
  filterMode?: 'startsWith' | 'includes';
  showAllOnFocus?: boolean;
  inputStyle?: React.CSSProperties;
}

export default function AutocompleteField({
  label, value, onChange, options, placeholder = 'Buscar…',
  disabled = false, allowNew = false, onNew, filterMode = 'includes',
  showAllOnFocus = false, inputStyle,
}: Props) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState({ left: 0, top: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const q = query.trim();

  const filtered = q === ''
    ? (open && showAllOnFocus ? options.slice(0, 30) : [])
    : options.filter(o =>
        filterMode === 'includes'
          ? o.toLowerCase().includes(q.toLowerCase())
          : o.toLowerCase().startsWith(q.toLowerCase())
      ).slice(0, 30);

  const exactMatch = options.some(o => o.toLowerCase() === q.toLowerCase());
  const showAddNew = allowNew && q.length > 0 && !exactMatch;

  useEffect(() => {
    if (!open) return;
    const updateRect = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuRect({ left: rect.left, top: rect.bottom + 4, width: rect.width });
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [open, query, filtered.length]);

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
  const borderColor = disabled ? BORDER_DARK : open ? ORANGE : BORDER_DARK;
  const showDropdown = open && !disabled && (filtered.length > 0 || showAddNew);

  return (
    <div style={{ width: '100%', boxSizing: 'border-box' }} ref={containerRef}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={{ position: 'relative', width: '100%' }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          border: `2px solid ${borderColor}`, borderRadius: 6,
          background: disabled ? 'rgba(28,46,80,0.4)' : FIELD_DARK,
          transition: 'border-color 0.15s',
          width: '100%', boxSizing: 'border-box', overflow: 'hidden'
        }}>
          <input
            className="dark-input"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={handleBlur}
            disabled={disabled}
            placeholder={placeholder}
            style={{
              flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
              padding: '11px 12px', fontSize: 13, fontWeight: 700,
              color: disabled ? BORDER_DARK : VALUE_COLOR, fontFamily: MONO,
              cursor: disabled ? 'not-allowed' : 'text',
              ...inputStyle,
            }}
          />
          {filled && !disabled && (
            <button
              onMouseDown={e => { e.preventDefault(); setQuery(''); onChange(''); setOpen(false); }}
              style={{ background: 'none', border: 'none', padding: '0 10px', color: LABEL_BLUE, fontSize: 16, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}
            >×</button>
          )}
        </div>

        {showDropdown && createPortal(
          <div style={{
            position: 'fixed', top: menuRect.top, left: menuRect.left, width: menuRect.width, zIndex: 9999,
            background: NAVY, borderRadius: 6,
            marginTop: 4, maxHeight: 220, overflowY: 'auto',
            boxShadow: '0 12px 30px rgba(0,0,0,0.45)', border: `1px solid ${BORDER_DARK}`,
          }}>
            {filtered.map(opt => (
              <button
                key={opt}
                onPointerDown={e => { e.preventDefault(); select(opt); }}
                style={{
                  width: '100%', textAlign: 'left',
                  background: opt === value ? 'rgba(255,255,255,0.15)' : 'transparent',
                  border: 'none', padding: '10px 14px', fontSize: 13, fontWeight: 700,
                  color: '#fff', cursor: 'pointer', fontFamily: MONO,
                  borderBottom: '1px solid rgba(255,255,255,0.1)',
                }}
              >{opt}</button>
            ))}
            {showAddNew && (
              <button
                onPointerDown={e => { e.preventDefault(); handleNew(); }}
                style={{
                  width: '100%', textAlign: 'left', background: 'transparent',
                  border: 'none', padding: '10px 14px', fontSize: 13, fontWeight: 700,
                  color: ORANGE, cursor: 'pointer', fontFamily: MONO,
                  borderTop: filtered.length > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                }}
              >＋ Agregar "{query.trim()}"</button>
            )}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}
