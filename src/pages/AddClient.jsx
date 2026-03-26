import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addClient } from '../firebase/clientService';

export default function AddClient() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', gender: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      setError('الاسم ورقم الهاتف مطلوبان');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const clientCode = 'C' + Date.now().toString().slice(-5);
      const id = await addClient({ ...form, clientCode });
      // بعد إضافة العميل، روح لصفحة إنشاء اشتراك مباشرة
      navigate(`/new-subscription?clientId=${id}&clientName=${form.name}&clientPhone=${form.phone}`);
    } catch (err) {
      setError('حدث خطأ: ' + err.message);
    }
    setLoading(false);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>إضافة عميل جديد</h2>
          <div className="breadcrumb">العملاء / إضافة عميل</div>
        </div>
      </div>

      <div className="page-body">
        <div className="card" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <div className="card-header">
            <h3>👤 بيانات العميل الأساسية</h3>
          </div>
          <div className="card-body">
            {error && <div className="alert alert-error" style={{ marginBottom: '16px' }}>❌ {error}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-grid col-1">
                <div className="form-group">
                  <label className="form-label">الاسم الكامل <span className="required">*</span></label>
                  <input className="form-control" placeholder="أدخل الاسم الكامل"
                    value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label className="form-label">رقم الهاتف <span className="required">*</span></label>
                  <input className="form-control" placeholder="05xxxxxxxx"
                    value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label className="form-label">البريد الإلكتروني</label>
                  <input className="form-control" type="email" placeholder="example@email.com"
                    value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>

                <div className="form-group">
                  <label className="form-label">الجنس</label>
                  <select className="form-control" value={form.gender}
                    onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}>
                    <option value="">-- اختر --</option>
                    <option value="male">ذكر</option>
                    <option value="female">أنثى</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? (
                    <><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> جاري الحفظ...</>
                  ) : '✅ إضافة العميل والانتقال للاشتراك'}
                </button>

                <button type="button" className="btn btn-ghost btn-full"
                  onClick={() => navigate('/clients')}>
                  إضافة بدون اشتراك الآن
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
