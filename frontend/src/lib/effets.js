import { useEffect, useMemo, useRef } from "react";

// Effets visuels partagés. Tous respectent prefers-reduced-motion et ne
// touchent qu'à des variables CSS (aucun re-rendu React).

const SPOT_TARGETS = ".card, .board, .stub, .stat-grid, .login-glass, .hero";

function reduitMouvement() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Halo lumineux qui suit le pointeur sur les panneaux en verre.
export function useSpotlight() {
  useEffect(() => {
    if (reduitMouvement()) return undefined;
    function onMove(e) {
      const el = e.target.closest?.(SPOT_TARGETS);
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => document.removeEventListener("pointermove", onMove);
  }, []);
}

// Inclinaison 3D + reflet holographique d'un élément (le ticket).
// Renvoie la ref à poser sur l'élément et ses gestionnaires de pointeur.
export function useInclinaison() {
  const ref = useRef(null);
  const handlers = useMemo(
    () => ({
      onPointerMove(e) {
        const el = ref.current;
        if (!el || reduitMouvement()) return;
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width; // 0 → 1
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty("--ry", `${(x - 0.5) * 14}deg`);
        el.style.setProperty("--rx", `${(0.5 - y) * 12}deg`);
        el.style.setProperty("--px", `${x * 100}%`);
        el.style.setProperty("--py", `${y * 100}%`);
        el.dataset.tilt = "on";
      },
      onPointerLeave() {
        const el = ref.current;
        if (!el) return;
        el.style.setProperty("--ry", "0deg");
        el.style.setProperty("--rx", "0deg");
        el.dataset.tilt = "off";
      },
    }),
    []
  );
  return [ref, handlers];
}
