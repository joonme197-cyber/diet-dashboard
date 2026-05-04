import { useState, useEffect, useRef } from 'react';
import {
  getPurchases, addPurchase, deletePurchase, updatePurchasePayment, getPurchaseStats,
  bulkAddPurchases,
} from '../firebase/purchaseService';
import { getSuppliers } from '../firebase/supplierService';
import { getInventory } from '../firebase/inventoryService';
import { exportToExcel, importFromExcel, downloadSampleFile, printArea, exportToPDF } from '../utils/excelUtils';

const EMPTY_ITEM = { ingredientId: '', name: '', quantity: 1, unitCost: 0 };

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ supplierId: '', date: new Date().toISOString().slice(0,10), items: [EMPTY_ITEM], paidAmount: 0, notes: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const fileRef = useRef(null);

  const load = async () => {
    setLoading(true);
    const [p, s, i] = await Promise.all([getPurchases(), getSuppliers(), getInventory()]);
    setPurchases(p); setSuppliers(s); setInventory(i);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const stats = getPurchaseStats(purchases);

  const updItem = (idx, key, val) => {
    setForm(p => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [key]: val };
      if (key === 'ingredientId') {
        const ing = inventory.find(i => i.id === val);
        if (ing) { items[idx].name = ing.name; items[idx].unitCost = ing.costPerUnit || 0; }
      }
      return { ...p, items };
    });
  };

  const total = form.items.reduce((s, i) => s + (Number(i.quantity) * Number(i.unitCost) || 0), 0);

  const handleSave = async () => {
    if (!form.supplierId || form.items.some(i => !i.name)) { setMsg('املأ الحقول'); return; }
    setSaving(true);
    await addPurchase(form);
    setSaving(false); setShowForm(false);
    setForm({ supplierId:'', date: new Date().toISOString().slice(0,10), items:[EMPTY_ITEM], paidAmount:0, notes:'' });
    setMsg('تمت الإضافة'); load();
    setTimeout(() => setMsg(''), 2000);
  };

  const handleDelete = async (id) => {
    if (window.confirm('حذف الفاتورة؟')) { await deletePurchase(id); load(); }
  };

  const handlePay = async (p) => {
    const amt = window.prompt('المبلغ المدفوع:', p.paidAmount || 0);
    if (amt == null) return;
    await updatePurchasePayment(p.id, amt, p.supplierId, p.totalAmount);
    load();
  };

  const handleTemplate = () => {
    downloadSampleFile(
      ['التاريخ', 'المورد', 'المكون', 'الكمية', 'سعر الوحدة', 'المبلغ المدفوع', 'ملاحظات'],
      { 'التاريخ': new Date().toISOString().slice(0,10), 'المورد': 'اسم المورد', 'المكون': 'اسم المكون', 'الكمية': 10, 'سعر الوحدة': 1.500, 'المبلغ المدفوع': 15.000, 'ملاحظات': '' },
      'purchases_template.xlsx'
    );
  };

  const handleImport = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const rows = await importFromExcel(file);
      const count = await bulkAddPurchases(rows, suppliers, inventory);
      setMsg(`تم استيراد ${count} فاتورة`);
      load();
    } catch (err) { setMsg('فشل الاستيراد: ' + err.message); }
    e.target.value = '';
    setTimeout(() => setMsg(''), 3000);
  };

  const handleExport = () => {
    const rows = purchases.map(p => ({
      'التاريخ': p.date, 'المورد': suppliers.find(s => s.id === p.supplierId)?.name || '',
      'الإجمالي': (p.totalAmount || 0).toFixed(3),
      'المدفوع': (p.paidAmount || 0).toFixed(3),
      'المتبقي': ((p.totalAmount || 0) - (p.paidAmount || 0)).toFixed(3),
      'الحالة': p.paymentStatus, 'البنود': p.items?.length || 0,
    }));
    exportToExcel(rows, `purchases_${new Date().toISOString().slice(0,10)}.xlsx`, 'المشتريات');
  };

  return (
    <div>
      <div className="page-header">
        <div><h2>🛒 المشتريات</h2><div className="breadcrumb">المالية والعمليات / المشتريات</div></div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={handleImport} />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>📥 استيراد</button>
          <button className="btn btn-ghost" onClick={handleExport}>📤 Excel</button>
          <button className="btn btn-ghost" onClick={handleTemplate}>📋 قالب</button>
          <button className="btn btn-ghost" onClick={() => exportToPDF('pur-print', 'تقرير المشتريات')}>📄 PDF</button>
          <button className="btn btn-ghost" onClick={() => printArea('pur-print', 'تقرير المشتريات')}>🖨️ طباعة</button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ فاتورة شراء</button>
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        <div className="stats-grid" style={{ marginBottom:16 }}>
          <div className="stat-card"><div className="stat-label">إجمالي المشتريات</div><div className="stat-value">{stats.total.toFixed(3)} د.ك</div></div>
          <div className="stat-card"><div className="stat-label">المدفوع</div><div className="stat-value" style={{ color:'#0d9488' }}>{stats.paid.toFixed(3)} د.ك</div></div>
          <div className="stat-card"><div className="stat-label">المتبقي</div><div className="stat-value" style={{ color:'#dc2626' }}>{stats.pending.toFixed(3)} د.ك</div></div>
        </div>

        <div className="card">
          <div className="card-header"><h3>قائمة الفواتير</h3><span className="badge badge-teal">{purchases.length}</span></div>
          <div className="table-wrapper" id="pur-print">
            {loading ? <div className="loading"><div className="spinner" />جاري التحميل...</div>
            : purchases.length === 0 ? <div className="empty-state"><div className="empty-icon">🛒</div><h3>لا توجد فواتير</h3></div>
            : (
              <table>
                <thead><tr>
                  <th>#</th><th>التاريخ</th><th>المورد</th><th>البنود</th>
                  <th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th><th>الإجراءات</th>
                </tr></thead>
                <tbody>
                  {purchases.map((p, i) => {
                    const sup = suppliers.find(s => s.id === p.supplierId);
                    const remain = (p.totalAmount || 0) - (p.paidAmount || 0);
                    const statusClr = p.paymentStatus === 'paid' ? '#0d9488' : p.paymentStatus === 'partial' ? '#f59e0b' : '#dc2626';
                    const statusLbl = p.paymentStatus === 'paid' ? 'مدفوع' : p.paymentStatus === 'partial' ? 'جزئي' : 'معلّق';
                    return (
                      <tr key={p.id}>
                        <td>{i+1}</td><td>{p.date}</td><td>{sup?.name || '-'}</td>
                        <td>{p.items?.length || 0}</td>
                        <td><strong>{(p.totalAmount||0).toFixed(3)}</strong></td>
                        <td>{(p.paidAmount||0).toFixed(3)}</td>
                        <td style={{ color: remain > 0 ? '#dc2626' : '#0d9488' }}>{remain.toFixed(3)}</td>
                        <td><span className="badge" style={{ background:statusClr+'22', color:statusClr }}>{statusLbl}</span></td>
                        <td><div style={{ display:'flex', gap:6 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => handlePay(p)}>دفع</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>حذف</button>
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:800 }}>
            <div className="modal-header">
              <h3>فاتورة شراء جديدة</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-2">
                <div className="form-group"><label className="form-label">المورد *</label>
                  <select className="form-control" value={form.supplierId} onChange={e => setForm(p => ({...p, supplierId:e.target.value}))}>
                    <option value="">اختر</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></div>
                <div className="form-group"><label className="form-label">التاريخ</label>
                  <input type="date" className="form-control" value={form.date} onChange={e => setForm(p => ({...p, date:e.target.value}))} /></div>
              </div>

              <h4 style={{ margin:'16px 0 8px' }}>البنود</h4>
              {form.items.map((it, idx) => (
                <div key={idx} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:8, marginBottom:8 }}>
                  <select className="form-control" value={it.ingredientId} onChange={e => updItem(idx, 'ingredientId', e.target.value)}>
                    <option value="">-- مكون من المخزون --</option>
                    {inventory.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <input type="number" step="0.001" className="form-control" placeholder="الكمية"
                    value={it.quantity} onChange={e => updItem(idx, 'quantity', e.target.value)} />
                  <input type="number" step="0.001" className="form-control" placeholder="سعر الوحدة"
                    value={it.unitCost} onChange={e => updItem(idx, 'unitCost', e.target.value)} />
                  <button className="btn btn-danger btn-sm" onClick={() => setForm(p => ({...p, items: p.items.filter((_, i) => i !== idx)}))}>×</button>
                </div>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={() => setForm(p => ({...p, items:[...p.items, EMPTY_ITEM]}))}>+ بند</button>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:16, padding:12, background:'#f8fafc', borderRadius:8 }}>
                <div><strong>الإجمالي:</strong> {total.toFixed(3)} د.ك</div>
                <div className="form-group" style={{ margin:0 }}>
                  <label className="form-label">المبلغ المدفوع</label>
                  <input type="number" step="0.001" className="form-control" value={form.paidAmount}
                    onChange={e => setForm(p => ({...p, paidAmount:e.target.value}))} />
                </div>
              </div>

              <button className="btn btn-primary btn-full" style={{ marginTop:16 }} onClick={handleSave} disabled={saving}>
                {saving ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
