import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Edit2, Trash2, Users, Shield, Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { User, UserRole } from '../types';
import Header from '../components/Header';
import Button from '../components/Button';
import Modal from '../components/Modal';
import FormField, { Input, Select } from '../components/FormField';

const ROLES: UserRole[] = ['Superadmin', 'Editor', 'Viewer'];

const roleConfig: Record<UserRole, { icon: React.ReactNode; color: string; bg: string; description: string }> = {
  Superadmin: { icon: <Shield size={11} />, color: '#7C3AED', bg: '#F3E8FF', description: 'Full access including user management' },
  Editor: { icon: <Edit2 size={11} />, color: '#1D4ED8', bg: '#DBEAFE', description: 'Can view, add, edit, and delete deals' },
  Viewer: { icon: <Eye size={11} />, color: '#374151', bg: '#F3F4F6', description: 'Read-only access to deals' },
};

function RoleBadge({ role }: { role: UserRole }) {
  const cfg = roleConfig[role];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, color: cfg.color, background: cfg.bg,
    }}>
      {cfg.icon}{role}
    </span>
  );
}

interface UserForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
}

const emptyForm = (): UserForm => ({ name: '', email: '', password: '', confirmPassword: '', role: 'Editor' });

export default function UserManagementPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { users, currentUser, addUser, updateUser, deleteUser } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm());
  const [errors, setErrors] = useState<Partial<UserForm>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openAdd = () => {
    setEditingUser(null);
    setForm(emptyForm());
    setErrors({});
    setShowModal(true);
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    setForm({ name: user.name, email: user.email || '', password: '', confirmPassword: '', role: user.role });
    setErrors({});
    setShowModal(true);
  };

  const set = (field: keyof UserForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(p => ({ ...p, [field]: e.target.value }));
    setErrors(p => ({ ...p, [field]: undefined }));
  };

  const validate = (): Partial<UserForm> => {
    const e: Partial<UserForm> = {};
    if (!form.name.trim()) e.name = 'Username is required';
    else {
      const existing = users.find(u => u.name.toLowerCase() === form.name.toLowerCase() && u.id !== editingUser?.id);
      if (existing) e.name = 'Username already in use';
    }
    if (form.email.trim() && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    else if (form.email.trim()) {
      const existing = users.find(u => u.email?.toLowerCase() === form.email.toLowerCase() && u.id !== editingUser?.id);
      if (existing) e.email = 'Email already in use';
    }
    if (!editingUser || form.password) {
      if (!editingUser && !form.password) e.password = 'Password is required';
      if (form.password && form.password.length < 6) e.password = 'Password must be at least 6 characters';
      if (form.password && form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    }
    return e;
  };

  const handleSave = async () => {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    if (editingUser) {
      const updates: Partial<User> = { name: form.name, email: form.email, role: form.role };
      if (form.password) updates.password = form.password;
      updateUser(editingUser.id, updates);
      toast.success('User updated successfully.');
    } else {
      addUser({ name: form.name, email: form.email, role: form.role, password: form.password });
      toast.success('User created successfully.');
    }
    setSaving(false);
    setShowModal(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await new Promise(r => setTimeout(r, 500));
    deleteUser(deleteTarget.id);
    toast.success('User deleted.');
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div style={{ minHeight: embedded ? undefined : '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      {!embedded && <Header />}

      <main style={{ flex: 1, padding: embedded ? 0 : '24px', maxWidth: embedded ? 'none' : 900, margin: '0 auto', width: '100%' }}>
        {!embedded && <Link to="/deals" style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: '#64748B', fontSize: 13, marginBottom: 20,
          textDecoration: 'none', fontWeight: 500,
        }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#2563EB'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#64748B'}
        >
          <ArrowLeft size={14} /> Back to deals
        </Link>}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' }}>User Management</h1>
            <p style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>{users.length} user{users.length !== 1 ? 's' : ''} in your organisation</p>
          </div>
          <Button icon={<Plus size={14} />} onClick={openAdd}>Add User</Button>
        </div>

        {/* Role legend */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          {ROLES.map(r => (
            <div key={r} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', background: '#fff', border: '1px solid #E2E8F0',
              borderRadius: 8, fontSize: 12,
            }}>
              <RoleBadge role={r} />
              <span style={{ color: '#64748B' }}>{roleConfig[r].description}</span>
            </div>
          ))}
        </div>

        {/* Users table */}
        <div style={{
          background: '#fff', border: '1px solid #E2E8F0', borderRadius: 10,
          overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          {users.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center' }}>
              <Users size={32} color="#94A3B8" style={{ margin: '0 auto 12px', display: 'block' }} />
              <p style={{ color: '#374151', fontWeight: 600, fontSize: 15 }}>No users yet</p>
              <p style={{ color: '#94A3B8', fontSize: 13, marginTop: 4, marginBottom: 16 }}>Add your first user to get started.</p>
              <Button icon={<Plus size={14} />} size="sm" onClick={openAdd}>Add User</Button>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Username', 'Email', 'Role', 'Actions'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: h === 'Actions' ? 'right' : 'left',
                      fontSize: 11, fontWeight: 600, color: '#64748B',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => {
                  const isSelf = user.id === currentUser?.id;
                  return (
                    <tr key={user.id} style={{
                      borderBottom: i < users.length - 1 ? '1px solid #F1F5F9' : undefined,
                      background: isSelf ? '#F8FAFC' : '#fff',
                    }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
                          }}>
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: '#0F172A' }}>
                              {user.name}
                              {isSelf && <span style={{ marginLeft: 6, fontSize: 10, color: '#64748B', background: '#F1F5F9', padding: '1px 5px', borderRadius: 3, fontWeight: 600 }}>YOU</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: user.email ? '#475569' : '#94A3B8' }}>{user.email || '—'}</td>
                      <td style={{ padding: '14px 16px' }}><RoleBadge role={user.role} /></td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Edit2 size={12} />}
                            onClick={() => openEdit(user)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Trash2 size={12} />}
                            onClick={() => setDeleteTarget(user)}
                            disabled={isSelf}
                            style={{ color: isSelf ? undefined : '#DC2626' }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Add/Edit modal */}
      <Modal
        open={showModal}
        onClose={() => !saving && setShowModal(false)}
        title={editingUser ? `Edit User · ${editingUser.name}` : 'Add New User'}
        width={480}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormField label="Username" error={errors.name} required>
            <Input value={form.name} onChange={set('name')} placeholder="jane.smith" error={!!errors.name} />
          </FormField>

          <FormField label="Email Address" error={errors.email} hint="Optional">
            <Input type="email" value={form.email} onChange={set('email')} placeholder="jane@example.com" error={!!errors.email} />
          </FormField>

          <FormField label="Role" required>
            <Select value={form.role} onChange={set('role')}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </Select>
            <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{roleConfig[form.role].description}</p>
          </FormField>

          <FormField
            label={editingUser ? 'New Password' : 'Password'}
            error={errors.password}
            required={!editingUser}
            hint={editingUser ? 'Leave blank to keep current password' : undefined}
          >
            <Input type="password" value={form.password} onChange={set('password')} placeholder="••••••••" error={!!errors.password} />
          </FormField>

          {(form.password || !editingUser) && (
            <FormField label="Confirm Password" error={errors.confirmPassword} required={!editingUser}>
              <Input type="password" value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="••••••••" error={!!errors.confirmPassword} />
            </FormField>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
            <Button variant="secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} loading={saving}>
              {saving ? 'Saving…' : editingUser ? 'Save Changes' : 'Create User'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete modal */}
      {deleteTarget && (
        <Modal open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} title="Delete User">
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: '#FEF2F2',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
            }}>
              <Trash2 size={22} color="#DC2626" />
            </div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', marginBottom: 6 }}>Delete this user?</h3>
            <p style={{ color: '#64748B', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
              Are you sure you want to delete <strong style={{ color: '#374151' }}>{deleteTarget.name}</strong>?
              This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
              <Button variant="danger" onClick={handleDelete} loading={deleting} icon={<Trash2 size={13} />}>
                {deleting ? 'Deleting…' : 'Delete User'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
