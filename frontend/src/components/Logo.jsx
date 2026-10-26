// Marque Smart Canteen : une toque de chef entre une cuillère et une fourchette.
export function LogoMark({ size = 32 }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {/* Toque : bouffant, pli, puis bandeau */}
        <path d="M17 24.5C11.5 24 9.6 17.4 14 14.6C13.6 9.4 19.6 6.8 23.2 9.8C25.4 5.6 32.4 6.2 33.4 11.4C38.6 10.6 41 17.6 35.8 20.6C35 22.6 33.4 24 31.4 24.5" />
        <path d="M19.6 21C22 19.4 24.6 21.6 27.4 19.8" />
        <path d="M17 24.5V34.6C21.6 36.4 26.6 36.4 31.4 34.6V24.5" />
        <path d="M19.4 31.6C23 32.8 26.4 32.6 29.2 31.2" />
        {/* Manche de la cuillère */}
        <path d="M11.2 33.6L18.6 43.4" />
        {/* Fourchette */}
        <path d="M31.2 43.4L38.4 34.2" />
        <path d="M36.2 31.8C36.6 34.6 38.6 35.8 41 34.8" />
        <path d="M36.2 31.8L39 28.2M38.6 33.4L41.8 29.8M41 34.8L44.2 31.4" />
      </g>
      {/* Cuilleron */}
      <ellipse cx="9" cy="30.2" rx="3.2" ry="4.8" transform="rotate(-38 9 30.2)" fill="currentColor" />
    </svg>
  );
}

export function Logo({ sub = "EMI, Rabat" }) {
  return (
    <div className="logo">
      <LogoMark size={42} />
      <div>
        <div className="logo-name">Smart Canteen</div>
        {sub && <div className="logo-sub">{sub}</div>}
      </div>
    </div>
  );
}

// Emblème de l'EMI (triangles entrelacés et traits de vitesse), redessiné au
// trait pour servir de filigrane discret sur le panneau de connexion.
export function EmiMark({ className }) {
  return (
    <svg className={className} viewBox="0 0 104 62" aria-hidden="true" focusable="false">
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <g stroke="currentColor" strokeWidth="3.4">
          <path d="M3 41H31M8 52H40" />
          <path d="M26 57L46 21L66 57Z" />
          <path d="M60 51L80 14L100 51Z" />
        </g>
        <g className="emi-accent" strokeWidth="3.4">
          <path d="M5.5 46.5H35.5" />
          <path d="M48 53L64 25L80 53Z" />
        </g>
      </g>
    </svg>
  );
}

// Trame de zellige (étoiles à huit branches et croix) utilisée en fond
// d'un seul élément par écran : panneau de connexion, talon du ticket.
export function ZelligePattern({ id = "zellige", opacity = 0.14, color = "currentColor" }) {
  return (
    <svg className="zellige" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} width="48" height="48" patternUnits="userSpaceOnUse">
          <g fill="none" stroke={color} strokeWidth="1.2" opacity={opacity}>
            <rect x="14" y="14" width="20" height="20" />
            <rect x="14" y="14" width="20" height="20" transform="rotate(45 24 24)" />
            <circle cx="24" cy="24" r="4" />
            <path d="M0 0l7 7M48 0l-7 7M0 48l7-7M48 48l-7-7" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
