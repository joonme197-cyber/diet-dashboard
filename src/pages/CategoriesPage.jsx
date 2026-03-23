import { useState, useEffect } from 'react';
import { getCategories, addCategory, updateCategory, deleteCategory } from '../firebase/packageService';

const INITIAL_CATEGORIES = [
  { nameAr: 'سليم وفيت', nameEn: 'Slim & Fit' },
  { nameAr: 'نزول وزن', nameEn: 'Weight Loss' },
  { nameAr: 'بناء عضل', nameEn: 'Muscle Gain' },
  { nameAr: 'كيتو', nameEn: 'Keto' },
  { nameAr: 'لايف ستايل', nameEn: 'LifeStyle' },
];

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ nameAr: '', nameEn: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await getCategories();
    setCategories(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setEditItem(null);
    setForm({ nameAr: '', nameEn: '' });
    setShowForm(true);
  };

  const openEdit = (cat) => {
    setEditItem(cat);
    setForm({ nameAr: cat.nameAr, nameEn: cat.nameEn });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.nameAr || !form.nameEn) return;
    setSaving(true);
    if (editItem) {
      await updateCategory(editItem.id, form);
      setMsg('تم التعديل بنجاح');
    } else {
      await addCategory(form);
      setMsg('تمت الإضافة بنجاح');
    }
    setSaving(false);
    setShowForm(false);
    load();
    setTimeout(() => setMsg(''), 2000);
  };

  const handleDelete = async (id) => {
    if (window.confirm('هل تريد حذف هذا التصنيف؟')) {
      await deleteCategory(id);
      load();
    }
  };

  const uploadInitial = async () => {
    setUploading(true);
    for (const cat of INITIAL_CATEGORIES) {
      await addCategory(cat);
    }
    setUploading(false);
    setMsg('تم رفع التصنيفات الافتراضية');
    load();
    setTimeout(() => setMsg(''), 2000);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>التصنيفات</h2>
          <div className="breadcrumb">الباقات / التصنيفات</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {categories.length === 0 && (
            <button className="btn btn-ghost" onClick={uploadInitial} disabled={uploading}>
              {uploading ? 'جاري الرفع...' : 'رفع التصنيفات الافتراضية'}
            </button>
          )}
          <button className="btn btn-primary" onClick={openAdd}>
            + إضافة تصنيف
          </button>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div className="card">
          <div className="card-header">
            <h3>قائمة التصنيفات</h3>
            <span className="badge badge-teal">{categories.length} تصنيف</span>
          </div>
          <div className="table-wrapper">
            {loading ? (
              <div className="loading"><div className="spinner" />جاري التحميل...</div>
            ) : categories.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📂</div>
                <h3>لا يوجد تصنيفات</h3>
                <p>اضغط "رفع التصنيفات الافتراضية" للبدء</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>الاسم بالعربي</th>
                    <th>الاسم بالإنجليزي</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((cat, i) => (
                    <tr key={cat.id}>
                      <td style={{ color: '#94a3b8' }}>{i + 1}</td>
                      <td><strong>{cat.nameAr}</strong></td>
                      <td>{cat.nameEn}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn btn-outline btn-sm" onClick={() => openEdit(cat)}>
                            تعديل
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(cat.id)}>
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? 'تعديل تصنيف' : 'إضافة تصنيف جديد'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-1">
                <div className="form-group">
                  <label className="form-label">الاسم بالعربي <span className="required">*</span></label>
                  <input className="form-control" placeholder="مثال: نزول وزن"
                    value={form.nameAr} onChange={e => setForm(p => ({ ...p, nameAr: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">الاسم بالإنجليزي <span className="required">*</span></label>
                  <input className="form-control" placeholder="e.g. Weight Loss"
                    value={form.nameEn} onChange={e => setForm(p => ({ ...p, nameEn: e.target.value }))} />
                </div>
                <button className="btn btn-primary btn-full" onClick={handleSave} disabled={saving}>
                  {saving ? 'جاري الحفظ...' : editItem ? 'حفظ التعديلات' : 'إضافة التصنيف'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
