import { DealStatus } from '../types';

const statusConfig: Record<DealStatus, { label: string; color: string; bg: string }> = {
  'New': { label: 'New', color: '#1D4ED8', bg: '#DBEAFE' },
  'In Progress': { label: 'In Progress', color: '#B45309', bg: '#FDE68A' },
  'Won': { label: 'Won', color: '#15803D', bg: '#BBF7D0' },
  'Lost': { label: 'Lost', color: '#B91C1C', bg: '#FECACA' },
  'TBC': { label: 'TBC', color: '#374151', bg: '#E5E7EB' },
};

interface StatusBadgeProps {
  status: DealStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const cfg = statusConfig[status];
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      padding: size === 'sm' ? '2px 8px' : '3px 10px',
      borderRadius: 999,
      fontSize: size === 'sm' ? 11 : 12,
      fontWeight: 600,
      letterSpacing: '0.02em',
      color: cfg.color,
      background: cfg.bg,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: size === 'sm' ? 5 : 6,
        height: size === 'sm' ? 5 : 6,
        borderRadius: '50%',
        background: cfg.color,
        flexShrink: 0,
      }} />
      {cfg.label}
    </span>
  );
}
