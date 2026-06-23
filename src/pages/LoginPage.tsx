import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import FormField, { Input } from '../components/FormField';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email address';
    if (!password) e.password = 'Password is required';
    return e;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setErrors({});
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      navigate('/deals');
    } else if (result.error === 'email_not_found') {
      toast.error('Email not recognised. Please contact your administrator.');
    } else {
      toast.error('Incorrect password. Please try again.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute', width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)',
        top: -200, right: -200, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)',
        bottom: -100, left: -100, pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: 420, position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
            marginBottom: 16, boxShadow: '0 8px 20px rgba(37,99,235,0.35)',
          }}>
            <Zap size={24} color="#fff" fill="#fff" />
          </div>
          <h1 style={{ color: '#F8FAFC', fontSize: 24, fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 6 }}>
            RF<span style={{ color: '#60A5FA' }}>Pulse</span>
          </h1>
          <p style={{ color: '#64748B', fontSize: 14 }}>RFP & Tender Management Platform</p>
        </div>

        {/* Card */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 32,
          backdropFilter: 'blur(12px)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        }}>
          <h2 style={{ color: '#F8FAFC', fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Welcome back</h2>
          <p style={{ color: '#64748B', fontSize: 13, marginBottom: 24 }}>Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormField label="Email address" error={errors.email} required>
              <Input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined })); }}
                placeholder="you@example.com"
                error={!!errors.email}
                style={{ background: 'rgba(255,255,255,0.06)', color: '#F8FAFC', borderColor: errors.email ? '#DC2626' : 'rgba(255,255,255,0.12)' }}
                disabled={loading}
              />
            </FormField>

            <FormField label="Password" error={errors.password} required>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: undefined })); }}
                  placeholder="••••••••"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '8px 40px 8px 12px',
                    border: `1px solid ${errors.password ? '#DC2626' : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: 7,
                    fontSize: 14,
                    color: '#F8FAFC',
                    background: 'rgba(255,255,255,0.06)',
                    outline: 'none',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onFocus={e => {
                    e.target.style.borderColor = errors.password ? '#DC2626' : '#2563EB';
                    e.target.style.boxShadow = `0 0 0 3px ${errors.password ? 'rgba(220,38,38,0.15)' : 'rgba(37,99,235,0.2)'}`;
                  }}
                  onBlur={e => {
                    e.target.style.borderColor = errors.password ? '#DC2626' : 'rgba(255,255,255,0.12)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: '#64748B', cursor: 'pointer',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </FormField>

            <Button type="submit" loading={loading} fullWidth size="lg" style={{ marginTop: 4 }}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

        </div>
      </div>

    </div>
  );
}
