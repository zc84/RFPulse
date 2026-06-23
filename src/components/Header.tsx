import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, Users, Zap } from 'lucide-react';

export default function Header() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header style={{
      background: '#0F172A',
      borderBottom: '1px solid #1E293B',
      padding: '0 24px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <Link to="/deals" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
        <span style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={16} color="#fff" fill="#fff" />
        </span>
        <span style={{ color: '#F8FAFC', fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>
          RF<span style={{ color: '#60A5FA' }}>Pulse</span>
        </span>
      </Link>

      <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {currentUser?.role === 'Superadmin' && (
          <Link to="/users" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 6,
            color: '#94A3B8', fontSize: 13, fontWeight: 500,
            textDecoration: 'none', transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = '#1E293B';
            (e.currentTarget as HTMLElement).style.color = '#F8FAFC';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
            (e.currentTarget as HTMLElement).style.color = '#94A3B8';
          }}>
            <Users size={14} />
            User Management
          </Link>
        )}

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '4px 8px 4px 12px',
          borderLeft: '1px solid #1E293B',
          marginLeft: 4,
        }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#F8FAFC', fontSize: 13, fontWeight: 500 }}>{currentUser?.name}</div>
            <div style={{ color: '#64748B', fontSize: 11 }}>{currentUser?.role}</div>
          </div>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 12, fontWeight: 700,
          }}>
            {currentUser?.name.charAt(0)}
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            style={{
              background: 'none', border: 'none',
              color: '#64748B', padding: '6px', borderRadius: 6,
              display: 'flex', alignItems: 'center', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#1E293B';
              (e.currentTarget as HTMLElement).style.color = '#F87171';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = '#64748B';
            }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </nav>
    </header>
  );
}
