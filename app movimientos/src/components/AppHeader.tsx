import Brand from './Brand';

interface Props {
  company: string;
  operator: string;
  onSignOut: () => void;
  onBack?: () => void;
}

export default function AppHeader({ company, operator, onSignOut, onBack }: Props) {
  return (
    <header className="app-header">
      {onBack ? (
        <button className="icon-button" type="button" onClick={onBack} aria-label="Volver">
          ←
        </button>
      ) : null}
      <Brand compact />
      <div className="header-identity">
        <strong>{company}</strong>
        <span>{operator}</span>
      </div>
      <button className="icon-button" type="button" onClick={onSignOut} aria-label="Cerrar sesión">
        ⇥
      </button>
    </header>
  );
}
