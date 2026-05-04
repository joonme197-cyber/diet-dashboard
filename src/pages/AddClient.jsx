import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addClient } from '../firebase/clientService';
import { useLang } from '../LanguageContext';

export default function AddClient() {
  const { isAr } = useLang();
  const [form, setForm] = useState({ name: '', phone: '', email: '', gender: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      setError(isAr ? 'الاسم ورقم الهاتف مطلوبان' : 'Name and phone number are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const clientCode = 'C' + Date.now().toString().slice(-5);
      const id = await addClient({ ...form, clientCode });

      try {
        await fetch('https://us-central1-diet-dashborad.cloudfunctions.net/createClientAuth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId: id, phone: form.phone, name: form.name }),
        });
      } catch (authErr) {
        console.warn('createClientAuth failed:', authErr);
      }

      navigate(`/new-subscription?clientId=${id}&clientName=${form.name}&clientPhone=${form.phone}`);
    } catch (err) {
      setError((isAr ? 'حدث خطأ: ' : 'Error: ') + err.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>{isAr ? 'إضافة عميل جديد' : 'Add New Client'}</h2>
          <div className="breadcrumb">
            {isAr ? 'العملاء / إضافة عميل' : 'Clients / Add Client'}
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <div className="card-header">
            <h3>👤 {isAr ? 'بيانات العميل الأساسية' : 'Basic Client Information'}</h3>
          </div>
          <div className="card-body">
            {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>❌ {error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-grid col-1">
                <div className="form-group">
                  <label className="form-label">
                    {isAr ? 'الاسم الكامل' : 'Full Name'} <span className="required">*</span>
                  </label>
                  <input className="form-control"
                    placeholder={isAr ? 'أدخل الاسم الكامل' : 'Enter full name'}
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {isAr ? 'رقم الهاتف' : 'Phone Number'} <span className="required">*</span>
                  </label>
                  <input className="form-control" placeholder="05xxxxxxxx"
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    {isAr ? 'البريد الإلكتروني' : 'Email'}
                  </label>
                  <input className="form-control" type="email" placeholder="example@email.com"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label className="form-label">{isAr ? 'الجنس' : 'Gender'}</label>
                  <select className="form-control" value={form.gender}
                    onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
                    <option value="">{isAr ? '-- اختر --' : '-- Select --'}</option>
                    <option value="male">{isAr ? 'ذكر' : 'Male'}</option>
                    <option value="female">{isAr ? 'أنثى' : 'Female'}</option>
                  </select>
                </div>

                {form.phone && (
                  <div style={{ background:'rgba(0,212,170,0.08)', border:'1px solid rgba(0,212,170,0.25)', borderRadius:10, padding:'10px 14px', fontSize:'0.82rem', color:'#00D4AA' }}>
                    🔑 {isAr
                      ? <>سيتم إنشاء حساب دخول تلقائياً — كلمة المرور: <strong>{form.phone}</strong></>
                      : <>A login account will be created automatically — Password: <strong>{form.phone}</strong></>}
                  </div>
                )}

                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? (
                    <><div className="spinner" style={{ width:'16px', height:'16px', borderWidth:'2px' }} /> {isAr ? 'جاري الحفظ...' : 'Saving...'}</>
                  ) : (isAr ? '✅ إضافة العميل والانتقال للاشتراك' : '✅ Add Client & Go to Subscription')}
                </button>

                <button type="button" className="btn btn-ghost btn-full" onClick={() => navigate('/clients')}>
                  {isAr ? 'إضافة بدون اشتراك الآن' : 'Add Without Subscription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
