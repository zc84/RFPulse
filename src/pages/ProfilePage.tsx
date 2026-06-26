import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, KeyRound, Save, UserCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import Button from '../components/Button';
import FormField, { Input } from '../components/FormField';

interface ProfileForm {
  name: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function ProfilePage() {
  const { currentUser, updateProfile } = useAuth();
  const [form, setForm] = useState<ProfileForm>({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<ProfileForm>>({});
  const [saving, setSaving] = useState(false);

  const set = (field: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    setErrors(p => ({ ...p, [field]: undefined }));
  };

  const validate = () => {
    const nextErrors: Partial<ProfileForm> = {};
    if (!form.name.trim()) nextErrors.name = 'Username is required';
    if (form.email.trim() && !/\S+@\S+\.\S+/.test(form.email)) nextErrors.email = 'Enter a valid email';
    if (form.newPassword || form.confirmPassword || form.currentPassword) {
      if (!form.currentPassword) nextErrors.currentPassword = 'Current password is required';
      if (!form.newPassword) nextErrors.newPassword = 'New password is required';
      else if (form.newPassword.length < 6) nextErrors.newPassword = 'Password must be at least 6 characters';
      if (form.newPassword !== form.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match';
    }
    return nextErrors;
  };

  const handleSave = async () => {
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        name: form.name.trim(),
        email: form.email.trim(),
        currentPassword: form.currentPassword || undefined,
        newPassword: form.newPassword || undefined,
      });
      setForm(p => ({ ...p, currentPassword: '', newPassword: '', confirmPassword: '' }));
      toast.success('Profile updated.');
    } catch (err: any) {
      const message = err.message || 'Failed to update profile';
      if (message.includes('Username')) setErrors({ name: message });
      else if (message.includes('Email')) setErrors({ email: message });
      else if (message.includes('Current password')) setErrors({ currentPassword: message });
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      <Header />

      <main style={{ flex: 1, padding: '24px', maxWidth: 720, margin: '0 auto', width: '100%' }}>
        <Link to="/deals" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: '#64748B', fontSize: 13, marginBottom: 20,
          textDecoration: 'none', fontWeight: 500,
        }}>
          <ArrowLeft size={14} /> Back to deals
        </Link>

        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' }}>My Profile</h1>
          <p style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>Update your account details and password.</p>
        </div>

        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
          overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserCircle size={16} color="#2563EB" />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Account Details</h2>
          </div>
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FormField label="Username" error={errors.name} required>
              <Input value={form.name} onChange={set('name')} error={!!errors.name} />
            </FormField>
            <FormField label="Email Address" error={errors.email} hint="Optional">
              <Input type="email" value={form.email} onChange={set('email')} error={!!errors.email} />
            </FormField>
            <FormField label="Role">
              <Input value={currentUser?.role || ''} disabled style={{ background: '#F8FAFC', color: '#64748B' }} />
            </FormField>
          </div>

          <div style={{ padding: '16px 20px', borderTop: '1px solid #F1F5F9', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyRound size={16} color="#2563EB" />
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Password</h2>
          </div>
          <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <FormField label="Current Password" error={errors.currentPassword} hint="Required only when changing password">
                <Input type="password" value={form.currentPassword} onChange={set('currentPassword')} error={!!errors.currentPassword} />
              </FormField>
            </div>
            <FormField label="New Password" error={errors.newPassword}>
              <Input type="password" value={form.newPassword} onChange={set('newPassword')} error={!!errors.newPassword} />
            </FormField>
            <FormField label="Confirm New Password" error={errors.confirmPassword}>
              <Input type="password" value={form.confirmPassword} onChange={set('confirmPassword')} error={!!errors.confirmPassword} />
            </FormField>
          </div>

          <div style={{ padding: 20, borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end' }}>
            <Button icon={<Save size={14} />} onClick={handleSave} loading={saving}>
              {saving ? 'Saving…' : 'Save Profile'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
