import { useState } from 'react';
import { useAuth } from '../AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('أدخل الإيميل والباسورد'); return; }
    setLoading(true); setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err.code === 'auth/invalid-credential' ? 'إيميل أو باسورد غلط' :
        err.code === 'auth/user-disabled'      ? 'هذا الحساب معطّل' :
        err.code === 'auth/too-many-requests'  ? 'محاولات كثيرة — جرب بعد قليل' :
        'حدث خطأ، حاول مرة أخرى'
      );
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #0d2535 50%, #0f172a 100%)',
      fontFamily: "'Cairo', sans-serif", direction: 'rtl',
    }}>
      <div style={{
        background: 'white', borderRadius: '20px', padding: '48px 40px',
        width: '100%', maxWidth: '420px', boxShadow: '0 25px 60px #00000040',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '3rem', marginBottom: '8px' }}>🥗</div>
          <h1 style={{ color: '#0d9488', fontWeight: 900, fontSize: '1.6rem', margin: 0 }}>Diet Plan</h1>
          <p style={{ color: '#64748b', fontSize: '0.88rem', margin: '6px 0 0' }}>نظام إدارة الوجبات الصحية</p>
        </div>

        {error && (
          <div style={{
            background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca',
            borderRadius: '8px', padding: '10px 14px', marginBottom: '20px',
            fontSize: '0.88rem', fontWeight: 600,
          }}>
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', marginBottom: '6px' }}>
              📧 البريد الإلكتروني
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="example@email.com"
              style={{
                width: '100%', padding: '11px 14px', borderRadius: '10px',
                border: '1.5px solid #e2e8f0', fontFamily: "'Cairo', sans-serif",
                fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#0d9488'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', color: '#1e293b', marginBottom: '6px' }}>
              🔒 كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '11px 14px', borderRadius: '10px',
                border: '1.5px solid #e2e8f0', fontFamily: "'Cairo', sans-serif",
                fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#0d9488'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '13px', borderRadius: '10px',
              background: loading ? '#94a3b8' : '#0d9488',
              color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'Cairo', sans-serif", fontSize: '1rem', fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              transition: 'background 0.2s',
            }}
          >
            {loading
              ? <><div style={{ width:'18px', height:'18px', border:'2px solid white', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.7s linear infinite' }} /> جاري تسجيل الدخول...</>
              : '🔑 تسجيل الدخول'
            }
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.78rem', color: '#94a3b8' }}>
          تواصل مع المدير للحصول على حساب
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
