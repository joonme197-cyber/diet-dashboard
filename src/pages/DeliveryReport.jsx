import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { getClients } from '../firebase/clientService';
import { getAllSubscriptions, getSubscriptionStatus, isDeliveryDay } from '../firebase/subscriptionService';
import { getClientDailyMeals } from '../firebase/mealService';
import { getZones, getDrivers, updateZone } from '../firebase/deliveryService';
import { useLang } from '../LanguageContext';

export default function DeliveryReport() {
  const { isAr } = useLang();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [viewMode, setViewMode]         = useState('regions');
  const [reportData, setReportData]     = useState({});
  const [loading, setLoading]           = useState(false);
  const [fetched, setFetched]           = useState(false);
  const [zones, setZones]               = useState([]);
  const [drivers, setDrivers]           = useState([]);
  const [editingZone, setEditingZone]   = useState(null);
  const [assignForm, setAssignForm]     = useState({ morning: '', evening: '' });
  const [saving, setSaving]             = useState(false);
  const [msg, setMsg]                   = useState('');

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  useEffect(() => {
    Promise.all([getZones(), getDrivers()]).then(([zns, drvs]) => {
      setZones(zns); setDrivers(drvs);
    });
  }, []);

  const getDriverName = (id) => drivers.find(d => d.id === id)?.name || '—';

  const buildReport = async () => {
    setLoading(true); setFetched(false);
    const [clients, allSubs] = await Promise.all([getClients(), getAllSubscriptions()]);

    const isValidSub = (s) =>
      getSubscriptionStatus(s) === 'active' &&
      selectedDate >= s.startDate &&
      selectedDate <= s.endDate &&
      isDeliveryDay(s, selectedDate);

    const activeClients = clients
      .filter(c => allSubs.some(s => s.clientId === c.id && isValidSub(s)))
      .map(c => ({ ...c, activeSub: allSubs.find(s => s.clientId === c.id && isValidSub(s)) }))
      // تخطى العملاء اللي اشتراكهم مجمّد في هذا اليوم
      .filter(c => !(c.activeSub?.frozenDays || []).includes(selectedDate));

    const withMeals = (await Promise.all(
      activeClients.map(async (c) => {
        const meals = await getClientDailyMeals(c.id, selectedDate);
        return { ...c, hasMeals: meals && Object.values(meals).some(a => a.length > 0) };
      })
    )).filter(c => c.hasMeals);

    // ترتيب: محافظة → منطقة
    withMeals.sort((a, b) => {
      if ((a.governorate||'') !== (b.governorate||'')) return (a.governorate||'').localeCompare(b.governorate||'', 'ar');
      return (a.region||'').localeCompare(b.region||'', 'ar');
    });

    // تجميع مع ربط الـ zone
    const findZone = (c) => zones.find(z => (z.regions||[]).some(r => r === c.region || r === c.governorate));
    const grouped = {};
    for (const c of withMeals) {
      const govKey = c.governorate || (isAr ? 'غير محدد' : 'Unknown');
      const regKey = c.region      || (isAr ? 'غير محدد' : 'Unknown');
      if (!grouped[govKey]) grouped[govKey] = {};
      if (!grouped[govKey][regKey]) grouped[govKey][regKey] = { clients: [], zone: findZone(c) };
      grouped[govKey][regKey].clients.push(c);
    }

    setReportData(grouped);
    setFetched(true);
    setLoading(false);
  };

  const totalClients = Object.values(reportData).reduce((s, regs) =>
    s + Object.values(regs).reduce((s2, r) => s2 + r.clients.length, 0), 0);

  const byDriver = () => {
    const map = {};
    for (const [govName, regs] of Object.entries(reportData)) {
      for (const [regName, data] of Object.entries(regs)) {
        const driverKey = data.zone?.drivers?.morning
          ? getDriverName(data.zone.drivers.morning)
          : (isAr ? 'بدون سائق' : 'No Driver');
        if (!map[driverKey]) map[driverKey] = {};
        if (!map[driverKey][govName]) map[driverKey][govName] = {};
        if (!map[driverKey][govName][regName]) map[driverKey][govName][regName] = { ...data };
        else map[driverKey][govName][regName].clients.push(...data.clients);
      }
    }
    return map;
  };

  const formatDate = (d) => {
    const dt = new Date(d);
    return `${dt.getDate().toString().padStart(2,'0')}/${(dt.getMonth()+1).toString().padStart(2,'0')}/${dt.getFullYear()}`;
  };

  const openAssign = (zone) => {
    setEditingZone(zone);
    setAssignForm({ morning: zone.drivers?.morning || '', evening: zone.drivers?.evening || '' });
  };

  const saveAssign = async () => {
    if (!editingZone) return;
    setSaving(true);
    await updateZone(editingZone.id, { drivers: assignForm });
    setZones(prev => prev.map(z => z.id === editingZone.id ? { ...z, drivers: assignForm } : z));
    setSaving(false); setEditingZone(null);
    showMsg(isAr ? '✅ تم تعيين السائق' : '✅ Driver assigned');
    if (fetched) buildReport();
  };

  const clientRow = (c, i) => (
    <tr key={c.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}>
      <td style={{ ...td, textAlign:'center', color:'#94a3b8', width:'28px' }}>{i+1}</td>
      <td style={{ ...td, fontWeight:700 }}>{c.name}</td>
      <td style={{ ...td, textAlign:'center' }}>
        <span style={{ background:'#f0fdfa', color:'#0d9488', padding:'1px 6px', borderRadius:'4px', fontWeight:700, fontSize:'10px' }}>{c.clientCode}</span>
      </td>
      <td style={td}>{c.phone}</td>
      <td style={{ ...td, fontSize:'10px' }}>
        {[c.block&&`ق${c.block}`, c.street&&`ش${c.street}`, c.building&&`م${c.building}`, c.floor&&`د${c.floor}`, c.apartment&&`ش${c.apartment}`].filter(Boolean).join(' ')||'—'}
      </td>
      <td style={{ ...td, fontSize:'10px', color:'#64748b' }}>{c.deliveryNote||'—'}</td>
    </tr>
  );

  const regBlock = (regName, { clients, zone }) => (
    <div key={regName}>
      <div style={{ background:'#f0fdfa', borderRight: isAr?'4px solid #0d9488':'none', borderLeft:!isAr?'4px solid #0d9488':'none', padding:'6px 16px', fontWeight:700, fontSize:'0.88rem', color:'#0f766e', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #ccfbf1' }}>
        <span>📍 {regName}</span>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {zone && (
            <span style={{ fontSize:'0.75rem', color:'#64748b' }}>
              🚗 {zone.drivers?.morning ? getDriverName(zone.drivers.morning) : (isAr?'بدون سائق':'No driver')}
              {zone.drivers?.evening && ` / 🌙 ${getDriverName(zone.drivers.evening)}`}
            </span>
          )}
          {zone && (
            <button className="no-print" onClick={() => openAssign(zone)}
              style={{ background:'none', border:'1px solid #0d9488', color:'#0d9488', borderRadius:'4px', padding:'2px 7px', cursor:'pointer', fontSize:'0.72rem' }}>
              ✏️ {isAr?'سائق':'Driver'}
            </button>
          )}
          <span style={{ color:'#64748b', fontWeight:400, fontSize:'0.82rem' }}>{clients.length} {isAr?'عميل':'clients'}</span>
        </div>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px', direction: isAr?'rtl':'ltr' }}>
        <thead>
          <tr style={{ background:'#f8fafc' }}>
            {['#', isAr?'الاسم':'Name', isAr?'الكود':'Code', isAr?'الهاتف':'Phone', isAr?'العنوان':'Address', isAr?'ملاحظات التوصيل':'Delivery Notes'].map((h,i) => (
              <th key={i} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{clients.map(clientRow)}</tbody>
      </table>
    </div>
  );

  const COLORS = ['#0d9488','#7c3aed','#2563eb','#d97706','#dc2626','#16a34a'];

  const govBlock = (govName, regs, color='#0d9488') => {
    const total = Object.values(regs).reduce((s,r)=>s+r.clients.length,0);
    return (
      <div key={govName} className="gov-block" style={{ marginBottom:'24px' }}>
        <div style={{ background:color, color:'white', padding:'8px 16px', borderRadius:'8px 8px 0 0', fontWeight:800, fontSize:'1rem', display:'flex', justifyContent:'space-between' }}>
          <span>🗺 {govName}</span>
          <span style={{ fontSize:'0.85rem', opacity:0.9 }}>{total} {isAr?'عميل':'clients'}</span>
        </div>
        {Object.entries(regs).map(([rn,data]) => regBlock(rn, data))}
      </div>
    );
  };

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <h2>🚗 {isAr ? 'تقرير التوصيل' : 'Delivery Report'}</h2>
          <div className="breadcrumb">{isAr ? 'مرتب بالمناطق والسائقين' : 'By regions and drivers'}</div>
        </div>
        {fetched && totalClients > 0 && (
          <button className="btn btn-primary" onClick={() => window.print()}>🖨️ {isAr?'طباعة':'Print'}</button>
        )}
      </div>

      <div className="page-body no-print">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}
        <div className="card" style={{ marginBottom:'20px' }}>
          <div className="card-body">
            <div style={{ display:'flex', gap:'16px', alignItems:'flex-end', flexWrap:'wrap' }}>
              <div className="form-group" style={{ marginBottom:0, flex:1, maxWidth:'280px' }}>
                <label className="form-label">📅 {isAr?'تاريخ التوصيل':'Delivery Date'}</label>
                <input type="date" className="form-control" value={selectedDate}
                  onChange={e => { setSelectedDate(e.target.value); setFetched(false); }} />
              </div>
              <div style={{ display:'flex', background:'#f8fafc', borderRadius:'8px', padding:'4px', gap:'4px' }}>
                {[{key:'regions',label:isAr?'🗺 بالمناطق':'🗺 Regions'},{key:'drivers',label:isAr?'🚗 بالسائقين':'🚗 Drivers'}].map(m=>(
                  <button key={m.key} onClick={()=>setViewMode(m.key)} style={{ padding:'8px 14px', border:'none', borderRadius:'6px', cursor:'pointer', fontFamily:'var(--font-main)', fontSize:'0.85rem', fontWeight:600, background:viewMode===m.key?'#0d9488':'transparent', color:viewMode===m.key?'white':'#64748b' }}>
                    {m.label}
                  </button>
                ))}
              </div>
              <button className="btn btn-primary" onClick={buildReport} disabled={loading} style={{ padding:'10px 24px' }}>
                {loading?<><div className="spinner" style={{width:'16px',height:'16px',borderWidth:'2px'}}/> {isAr?'جاري...':'Loading...'}</>:`📊 ${isAr?'إنشاء':'Generate'}`}
              </button>
            </div>
            {fetched && (
              <div style={{ display:'flex', gap:'16px', marginTop:'16px', padding:'12px', background:'#f0fdfa', borderRadius:'8px', fontSize:'0.88rem' }}>
                <span style={{ color:'#0f766e', fontWeight:700 }}>👥 {isAr?'إجمالي':'Total'}: {totalClients}</span>
                <span style={{ color:'#7c3aed', fontWeight:700 }}>🗺 {isAr?'محافظات':'Govs'}: {Object.keys(reportData).length}</span>
                <span style={{ color:'#0d9488', fontWeight:700 }}>📅 {formatDate(selectedDate)}</span>
              </div>
            )}
          </div>
        </div>
        {fetched && totalClients === 0 && (
          <div className="card"><div className="empty-state"><div className="empty-icon">🚗</div><h3>{isAr?'لا يوجد عملاء':'No clients'}</h3></div></div>
        )}
      </div>

      {fetched && totalClients > 0 && (
        <div className="print-area" style={{ padding:'0 32px' }}>
          <style>{`@media print{.no-print{display:none!important}.print-area{padding:0!important}@page{size:A4;margin:12mm}body{background:white!important}.gov-block{page-break-inside:avoid}}`}</style>
          <div style={{ marginBottom:'20px', paddingBottom:'12px', borderBottom:'2px solid #0d9488' }}>
            <h1 style={{ fontSize:'1.3rem', fontWeight:800, color:'#0d9488', margin:0 }}>
              🚗 {isAr?'تقرير التوصيل':'Delivery Report'} {viewMode==='drivers'&&`— ${isAr?'حسب السائقين':'By Drivers'}`}
            </h1>
            <div style={{ fontSize:'0.85rem', color:'#64748b', marginTop:'4px' }}>
              {isAr?'تاريخ':'Date'}: <strong>{formatDate(selectedDate)}</strong> | {isAr?'إجمالي':'Total'}: <strong>{totalClients}</strong>
            </div>
          </div>

          {viewMode==='regions' && Object.entries(reportData).map(([gn,regs])=>govBlock(gn,regs))}

          {viewMode==='drivers' && Object.entries(byDriver()).map(([driverName,govs],di)=>(
            <div key={driverName} style={{ marginBottom:'32px' }}>
              <div style={{ background:COLORS[di%COLORS.length], color:'white', padding:'10px 18px', borderRadius:'10px 10px 0 0', fontWeight:800, fontSize:'1.1rem', display:'flex', justifyContent:'space-between' }}>
                <span>🚗 {driverName}</span>
                <span style={{ fontSize:'0.85rem', opacity:0.9 }}>
                  {Object.values(govs).reduce((s,regs)=>s+Object.values(regs).reduce((s2,r)=>s2+r.clients.length,0),0)} {isAr?'عميل':'clients'}
                </span>
              </div>
              {Object.entries(govs).map(([gn,regs])=>govBlock(gn,regs,COLORS[di%COLORS.length]))}
            </div>
          ))}
        </div>
      )}

      {/* Modal: تعيين سائق */}
      {editingZone && (
        <div className="modal-overlay" onClick={()=>setEditingZone(null)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{ maxWidth:'400px' }}>
            <div className="modal-header">
              <h3>🚗 {isAr?`تعيين سائق — ${editingZone.name}`:`Assign Driver — ${editingZone.name}`}</h3>
              <button className="modal-close" onClick={()=>setEditingZone(null)}>X</button>
            </div>
            <div className="modal-body">
              <div style={{ fontSize:'0.8rem', color:'#64748b', marginBottom:'14px', background:'#f8fafc', padding:'8px 12px', borderRadius:'6px' }}>
                📍 {(editingZone.regions||[]).join('، ')}
              </div>
              <div className="form-grid col-1">
                {[['morning',isAr?'🌅 سائق الصباح':'🌅 Morning Driver'],['evening',isAr?'🌙 سائق المساء':'🌙 Evening Driver']].map(([shift,label])=>(
                  <div key={shift} className="form-group">
                    <label className="form-label">{label}</label>
                    <select className="form-control" value={assignForm[shift]} onChange={e=>setAssignForm(p=>({...p,[shift]:e.target.value}))}>
                      <option value="">{isAr?'-- بدون --':'-- None --'}</option>
                      {drivers.map(d=><option key={d.id} value={d.id}>{d.name}{d.phone?` (${d.phone})`:''}</option>)}
                    </select>
                  </div>
                ))}
                <div style={{ display:'flex', gap:'12px' }}>
                  <button className="btn btn-primary" style={{ flex:1 }} onClick={saveAssign} disabled={saving}>
                    {saving?'...':(isAr?'✅ حفظ':'✅ Save')}
                  </button>
                  <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setEditingZone(null)}>
                    {isAr?'إلغاء':'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding:'7px 10px', textAlign:'right', fontWeight:700, fontSize:'11px', border:'1px solid #e2e8f0', color:'#475569' };
const td = { padding:'7px 10px', border:'1px solid #f1f5f9', fontSize:'11px', verticalAlign:'middle' };
