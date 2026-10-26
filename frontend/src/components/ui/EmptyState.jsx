export default function EmptyState({ icon: Icon, title, hint, action }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="empty-icon">
          <Icon width={22} height={22} />
        </div>
      )}
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
