import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const variants = {
  primary: {
    background: '#2563EB', color: '#fff', border: '1px solid #2563EB',
    hoverBg: '#1D4ED8', hoverBorder: '#1D4ED8',
  },
  secondary: {
    background: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0',
    hoverBg: '#E2E8F0', hoverBorder: '#CBD5E1',
  },
  danger: {
    background: '#DC2626', color: '#fff', border: '1px solid #DC2626',
    hoverBg: '#B91C1C', hoverBorder: '#B91C1C',
  },
  ghost: {
    background: 'transparent', color: '#475569', border: '1px solid transparent',
    hoverBg: '#F1F5F9', hoverBorder: 'transparent',
  },
  outline: {
    background: 'transparent', color: '#2563EB', border: '1px solid #2563EB',
    hoverBg: '#EFF6FF', hoverBorder: '#2563EB',
  },
};

const sizes = {
  sm: { padding: '6px 12px', fontSize: 12, gap: 5 },
  md: { padding: '8px 16px', fontSize: 13, gap: 6 },
  lg: { padding: '11px 20px', fontSize: 14, gap: 8 },
};

export default function Button({
  variant = 'primary', size = 'md', loading = false, icon, fullWidth,
  children, disabled, style, onMouseEnter, onMouseLeave, ...props
}: ButtonProps) {
  const v = variants[variant];
  const s = sizes[size];
  const [hovered, setHovered] = React.useState(false);

  return (
    <button
      {...props}
      disabled={disabled || loading}
      onMouseEnter={e => { setHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={e => { setHovered(false); onMouseLeave?.(e); }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: 500,
        borderRadius: 7,
        border: v.border,
        background: hovered && !disabled && !loading ? v.hoverBg : v.background,
        color: v.color,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
        width: fullWidth ? '100%' : undefined,
        whiteSpace: 'nowrap',
        userSelect: 'none',
        ...style,
      }}
    >
      {loading ? <Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} /> : icon}
      {children}
    </button>
  );
}
