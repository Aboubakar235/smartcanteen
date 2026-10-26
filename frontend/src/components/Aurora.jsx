// Fond de l'application : trois nappes lumineuses qui dérivent lentement
// au-dessus d'une grille en perspective. Purement décoratif.
export default function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <span className="aurora-blob a" />
      <span className="aurora-blob b" />
      <span className="aurora-blob c" />
      <div className="aurora-grid" />
      <div className="aurora-vignette" />
    </div>
  );
}
