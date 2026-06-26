import React from 'react';

interface FormFieldProps {
  label: React.ReactNode;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}

export default function FormField({ label, error, required, children, hint }: FormFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{
        fontSize: 13, fontWeight: 700, color: '#374151',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {label}
        {required && <span style={{ color: '#DC2626' }}>*</span>}
      </label>
      {children}
      {hint && !error && <span style={{ fontSize: 12, color: '#94A3B8' }}>{hint}</span>}
      {error && (
        <span style={{ fontSize: 12, color: '#DC2626', display: 'flex', alignItems: 'center', gap: 4 }}>
          {error}
        </span>
      )}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  icon?: React.ReactNode;
}

export function Input({ error, icon, style, ...props }: InputProps) {
  return (
    <div style={{ position: 'relative' }}>
      {icon && (
        <span style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          color: '#94A3B8', display: 'flex', alignItems: 'center', pointerEvents: 'none',
        }}>
          {icon}
        </span>
      )}
      <input
        {...props}
        style={{
          width: '100%',
          padding: icon ? '8px 12px 8px 34px' : '8px 12px',
          border: `1px solid ${error ? '#DC2626' : '#E2E8F0'}`,
          borderRadius: 7,
          fontSize: 14,
          color: '#0F172A',
          background: '#fff',
          outline: 'none',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          ...style,
        }}
        onFocus={e => {
          e.target.style.borderColor = error ? '#DC2626' : '#2563EB';
          e.target.style.boxShadow = `0 0 0 3px ${error ? 'rgba(220,38,38,0.1)' : 'rgba(37,99,235,0.1)'}`;
        }}
        onBlur={e => {
          e.target.style.borderColor = error ? '#DC2626' : '#E2E8F0';
          e.target.style.boxShadow = 'none';
        }}
      />
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export function Select({ error, style, children, ...props }: SelectProps) {
  return (
    <select
      {...props}
      style={{
        width: '100%',
        padding: '8px 12px',
        border: `1px solid ${error ? '#DC2626' : '#E2E8F0'}`,
        borderRadius: 7,
        fontSize: 14,
        color: '#0F172A',
        background: '#fff',
        outline: 'none',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        paddingRight: 32,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        ...style,
      }}
      onFocus={e => {
        e.target.style.borderColor = error ? '#DC2626' : '#2563EB';
        e.target.style.boxShadow = `0 0 0 3px ${error ? 'rgba(220,38,38,0.1)' : 'rgba(37,99,235,0.1)'}`;
      }}
      onBlur={e => {
        e.target.style.borderColor = error ? '#DC2626' : '#E2E8F0';
        e.target.style.boxShadow = 'none';
      }}
    >
      {children}
    </select>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({ error, style, ...props }: TextareaProps) {
  return (
    <textarea
      {...props}
      style={{
        width: '100%',
        padding: '8px 12px',
        border: `1px solid ${error ? '#DC2626' : '#E2E8F0'}`,
        borderRadius: 7,
        fontSize: 14,
        color: '#0F172A',
        background: '#fff',
        outline: 'none',
        resize: 'vertical',
        minHeight: 100,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        ...style,
      }}
      onFocus={e => {
        e.target.style.borderColor = error ? '#DC2626' : '#2563EB';
        e.target.style.boxShadow = `0 0 0 3px ${error ? 'rgba(220,38,38,0.1)' : 'rgba(37,99,235,0.1)'}`;
      }}
      onBlur={e => {
        e.target.style.borderColor = error ? '#DC2626' : '#E2E8F0';
        e.target.style.boxShadow = 'none';
      }}
    />
  );
}
