export default function PriorityBadge({ priority }) {
  const styles = {
    P0: 'bg-red-100 text-red-700 border-red-200',
    P1: 'bg-orange-100 text-orange-700 border-orange-200',
    P2: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    P3: 'bg-green-100 text-green-700 border-green-200',
  };

  const labels = {
    P0: 'Critical',
    P1: 'High',
    P2: 'Standard',
    P3: 'Low',
  };

  const icons = {
    P0: '🔴',
    P1: '🟠',
    P2: '🟡',
    P3: '🟢',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[priority] || styles.P2}`}>
      <span>{icons[priority] || '⚪'}</span>
      <span>{priority}: {labels[priority] || priority}</span>
    </span>
  );
}
