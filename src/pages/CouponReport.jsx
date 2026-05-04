import { useState, useEffect } from 'react';
import { getCoupons, getCouponUsageReport } from '../firebase/couponService';
import { useLang } from '../LanguageContext';

export default function CouponReport() {
  const { isAr } = useLang();
  const [coupons, setCoupons]       = useState([]);
  const [selectedCoupon, setSelectedCoupon] = useState('');
  const [report, setReport]         = useState([]);
  const [loading, setLoading]       = useState(false);
  const [fetched, setFetched]       = useState(false);

  useEffect(() => { getCoupons().then(setCoupons); }, []);

  const buildReport = async () => {
    setLoading(true);
    const data = await getCouponUsageReport(selectedCoupon || null);
    data.sort((a, b) => (b.usedAt?.seconds || 0) - (a.usedAt?.seconds || 0));
    setReport(data);
    setFetched(true);
    setLoading(false);
  };

  const totalOriginal  = report.reduce((s, r) => s + (r.originalPrice  || 0), 0);
  const totalDiscount  = report.reduce((s, r) => s + (r.discountAmount  || 0), 0);
  const totalFinal     = report.reduce((s, r) => s + (r.finalPrice      || 0), 0);

  const fmt = (n) => Number(n || 0).toFixed(3);

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('ar-KW');
  };

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <h2>📊 {isAr ? 'تقرير الكوبونات' : 'Coupon Usage Report'}</h2>
          <div className="breadcrumb">{isAr ? 'الاشتراكات التي استخدمت كوبونات خصم' : 'Subscriptions with discount coupons'}</div>
        </div>
        {fetched && report.length > 0 && (
          <button className="btn btn-primary" onClick={() => window.print()}>🖨️ {isAr?'طباعة':'Print'}</button>
        )}
      </div>

      <div className="page-body no-print">
        <div className="card" style={{ marginBottom:'20px' }}>
          <div className="card-body">
            <div style={{ display:'flex', gap:'16px', alignItems:'flex-end', flexWrap:'wrap' }}>
              <div className="form-group" style={{ marginBottom:0, flex:1, maxWidth:'300px' }}>
                <label className="form-label">🎟 {isAr?'الكوبون':'Coupon'}</label>
                <select className="form-control" value={selectedCoupon} onChange={e => { setSelectedCoupon(e.target.value); setFetched(false); }}>
                  <option value="">{isAr?'كل الكوبونات':'All Coupons'}</option>
                  {coupons.map(c => (
                    <option key={c.id} value={c.id}>{c.code} — {c.nameAr || c.nameEn || ''}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" onClick={buildReport} disabled={loading} style={{ padding:'10px 28px' }}>
                {loading ? <><div className="spinner" style={{width:'16px',height:'16px',borderWidth:'2px'}}/> {isAr?'جاري...':'Loading...'}</> : `📊 ${isAr?'إنشاء التقرير':'Generate'}`}
              </button>
            </div>

            {fetched && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginTop:'16px' }}>
                {[
                  { label: isAr?'عدد الاستخدامات':'Uses',            value: report.length,           color:'#0d9488', bg:'#f0fdfa' },
                  { label: isAr?'إجمالي السعر الأصلي':'Original',    value: `${fmt(totalOriginal)} KWD`, color:'#64748b', bg:'#f8fafc' },
                  { label: isAr?'إجمالي الخصم':'Total Discount',     value: `${fmt(totalDiscount)} KWD`, color:'#dc2626', bg:'#fee2e2' },
                  { label: isAr?'إجمالي المحصّل':'Net Revenue',       value: `${fmt(totalFinal)} KWD`,    color:'#16a34a', bg:'#dcfce7' },
                ].map(s => (
                  <div key={s.label} style={{ padding:'12px', background:s.bg, borderRadius:'10px', border:`1px solid ${s.color}22` }}>
                    <div style={{ fontSize:'1.2rem', fontWeight:800, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:'0.78rem', color:'#64748b', marginTop:'2px' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {fetched && report.length === 0 && (
          <div className="card"><div className="empty-state"><div className="empty-icon">🎟</div><h3>{isAr?'لا يوجد بيانات':'No data'}</h3></div></div>
        )}
      </div>

      {fetched && report.length > 0 && (
        <div className="print-area" style={{ padding:'0 32px' }}>
          <style>{`@media print{.no-print{display:none!important}.print-area{padding:0!important}@page{size:A4;margin:12mm}body{background:white!important}}`}</style>

          <div style={{ marginBottom:'20px', paddingBottom:'12px', borderBottom:'2px solid #0d9488' }}>
            <h1 style={{ fontSize:'1.3rem', fontWeight:800, color:'#0d9488', margin:0 }}>
              🎟 {isAr?'تقرير كوبونات الخصم':'Coupon Usage Report'}
            </h1>
            <div style={{ fontSize:'0.85rem', color:'#64748b', marginTop:'4px' }}>
              {selectedCoupon ? coupons.find(c=>c.id===selectedCoupon)?.code : (isAr?'كل الكوبونات':'All Coupons')}
              {' | '}{report.length} {isAr?'اشتراك':'subscriptions'}
              {' | '}{isAr?'إجمالي الخصم':'Total Discount'}: {fmt(totalDiscount)} KWD
            </div>
          </div>

          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px', direction: isAr?'rtl':'ltr' }}>
            <thead>
              <tr style={{ background:'#0d9488', color:'white' }}>
                {[
                  isAr?'#':'#',
                  isAr?'العميل':'Client',
                  isAr?'الكود':'Code',
                  isAr?'الباقة':'Package',
                  isAr?'تاريخ الاستخدام':'Date',
                  isAr?'الكوبون':'Coupon',
                  isAr?'السعر الأصلي':'Original',
                  isAr?'قيمة الخصم':'Discount',
                  isAr?'الإجمالي':'Total',
                ].map((h,i) => (
                  <th key={i} style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, fontSize:'11px', border:'1px solid #0a7a6e' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.map((r, i) => (
                <tr key={r.id} style={{ background: i%2===0?'white':'#f8fafc' }}>
                  <td style={td}>{i+1}</td>
                  <td style={{ ...td, fontWeight:700 }}>
                    {r.clientName}
                    <div style={{ fontSize:'10px', color:'#94a3b8' }}>{r.clientCode}</div>
                  </td>
                  <td style={td}>{r.clientCode}</td>
                  <td style={td}>{r.packageName || '—'}</td>
                  <td style={td}>{formatDate(r.usedAt)}</td>
                  <td style={td}>
                    <span style={{ fontFamily:'monospace', fontWeight:700, color:'#0d9488' }}>{r.couponCode}</span>
                  </td>
                  <td style={{ ...td, textAlign:'center' }}>{fmt(r.originalPrice)}</td>
                  <td style={{ ...td, textAlign:'center', color:'#dc2626', fontWeight:700 }}>- {fmt(r.discountAmount)}</td>
                  <td style={{ ...td, textAlign:'center', fontWeight:800, color:'#16a34a' }}>{fmt(r.finalPrice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background:'#f0fdfa', fontWeight:800 }}>
                <td colSpan={6} style={{ ...td, textAlign: isAr?'right':'left', fontWeight:800 }}>
                  {isAr?'الإجمالي':'Total'}
                </td>
                <td style={{ ...td, textAlign:'center', fontWeight:800 }}>{fmt(totalOriginal)}</td>
                <td style={{ ...td, textAlign:'center', color:'#dc2626', fontWeight:800 }}>- {fmt(totalDiscount)}</td>
                <td style={{ ...td, textAlign:'center', color:'#16a34a', fontWeight:800 }}>{fmt(totalFinal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

const td = { padding:'7px 10px', border:'1px solid #f1f5f9', fontSize:'11px', verticalAlign:'middle' };
