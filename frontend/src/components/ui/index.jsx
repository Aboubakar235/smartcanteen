import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconAlert, IconCheck, IconX } from "./icons";

export function PageHeader({ eyebrow, title, sub, action }) {
  return (
    <header className="page-head">
      <div className="grow">
        {eyebrow && <p className="page-eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {action}
    </header>
  );
}

export function Section({ title, count, children }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {count != null && <span className="count">{count}</span>}
      </div>
      {children}
    </section>
  );
}

export function Badge({ tone = "", plain = false, children }) {
  return <span className={`badge ${tone} ${plain ? "plain" : ""}`}>{children}</span>;
}

export function Banner({ type = "error", children }) {
  if (!children) return null;
  const Icon = type === "error" ? IconAlert : IconCheck;
  return (
    <div className={`banner banner-${type}`} role={type === "error" ? "alert" : "status"}>
      <Icon width={18} height={18} />
      <span>{children}</span>
    </div>
  );
}

export function Skeleton({ height = 72, count = 1 }) {
  return (
    <div className="stack" aria-busy="true" aria-label="Chargement">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

// `seuils` colore la barre selon le remplissage (capacités) ; désactivé pour les graphiques.
export function Meter({ value, max, seuils = true }) {
  const ratio = max > 0 ? value / max : 0;
  const tone = !seuils ? "" : ratio >= 1 ? "danger" : ratio >= 0.8 ? "warn" : "";
  return (
    <div className={`meter ${tone}`} role="presentation">
      <span style={{ width: `${Math.min(100, ratio * 100)}%` }} />
    </div>
  );
}

// Groupe de boutons exclusifs (radio accessible).
export function Segmented({ label, value, onChange, options }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <o.icon width={17} height={17} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Bottom sheet sur mobile, modale centrée sur grand écran.
export function Sheet({ title, sub, onClose, footer, children }) {
  const titleId = useId();
  const ref = useRef(null);

  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("button, input, select")?.focus();

    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div className="sheet-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <div className="sheet-grip" />
        <div className="sheet-head">
          <div className="grow">
            <h2 id={titleId}>{title}</h2>
            {sub && <p className="card-sub">{sub}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
            <IconX width={18} height={18} />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

// Confirmation d'une action destructive. onConfirm est asynchrone : en cas
// d'erreur (ex. élément déjà réservé), le message de l'API s'affiche ici.
export function Confirmation({ title, message, confirmLabel = "Supprimer", onConfirm, onClose }) {
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function confirmer() {
    setEnvoi(true);
    setErreur(null);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      setErreur(e.message);
      setEnvoi(false);
    }
  }

  return (
    <Sheet
      title={title}
      onClose={onClose}
      footer={
        <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button type="button" className="btn btn-danger" onClick={confirmer} disabled={envoi}>
            {envoi ? "Suppression…" : confirmLabel}
          </button>
        </div>
      }
    >
      <div className="stack">
        <p>{message}</p>
        <Banner>{erreur}</Banner>
      </div>
    </Sheet>
  );
}
