import { useState, useEffect } from 'react';
import {
  getZones, addZone, updateZone, deleteZone,
  getDeliveryPeriods, addDeliveryPeriod, deleteDeliveryPeriod,
  getDrivers, addDriver, updateDriver, deleteDriver,
  KUWAIT_GOVERNORATES
} from '../firebase/deliveryService';

const TABS = ['مناطق التوصيل', 'السائقون', 'فترات التوصيل', 'توزيع السائقين'];
const SHIFTS = ['الشيفت الأول', 'الشيفت الثاني', 'الشيفت الثالث'];

export default function DeliveryPage() {
  const [activeTab, setActiveTab] = useState('مناطق التوصيل');
  const [zones, setZones] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  // Zone form
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [editZone, setEditZone] = useState(null);
  const [zoneForm, setZoneForm] = useState({ name: '', governorate: 'العاصمة', regions: [], zoneCode: '' });
  const [selectedRegions, setSelectedRegions] = useState([]);

  // Driver form
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [editDriver, setEditDriver] = useState(null);
  const [driverForm, setDriverForm] = useState({ name: '', phone: '' });

  // Period form
  const [showPeriodForm, setShowPeriodForm] = useState(false);
  const [periodForm, setPeriodForm] = useState({ label: '', timeFrom: '', timeTo: '' });

  const load = async () => {
    setLoading(true);
    const [z, d, p] = await Promise.all([getZones(), getDrivers(), getDeliveryPeriods()]);
    setZones(z);
    setDrivers(d);
    setPeriods(p);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);
  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  // ===== ZONES =====
  const openAddZone = () => {
    setEditZone(null);
    setZoneForm({ name: '', governorate: 'العاصمة', regions: [], zoneCode: '' });
    setSelectedRegions([]);
    setShowZoneForm(true);
  };

  const openEditZone = (z) => {
    setEditZone(z);
    setZoneForm({ name: z.name, governorate: z.governorate, zoneCode: z.zoneCode || '' });
    setSelectedRegions(z.regions || []);
    setShowZoneForm(true);
  };

  const toggleRegion = (r) => setSelectedRegions(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r]);

  const saveZone = async () => {
    if (!zoneForm.name) { alert('اسم المنطقة مطلوب'); return; }
    const data = { ...zoneForm, regions: selectedRegions, drivers: editZone?.drivers || [] };
    if (editZone) { await updateZone(editZone.id, data); showMsg('تم تعديل المنطقة'); }
    else { await addZone(data); showMsg('تمت إضافة المنطقة'); }
    setShowZoneForm(false); load();
  };

  // تعيين سائق لشيفت معين في منطقة
  const assignDriverToShift = async (zoneId, shift, driverId) => {
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return;
    const zoneDrivers = zone.drivers || {};
    if (driverId) zoneDrivers[shift] = driverId;
    else delete zoneDrivers[shift];
    await updateZone(zoneId, { drivers: zoneDrivers });
    load();
    showMsg('تم تعيين السائق');
  };

  // ===== DRIVERS =====
  const saveDriver = async () => {
    if (!driverForm.name || !driverForm.phone) { alert('الاسم والهاتف مطلوبان'); return; }
    if (editDriver) { await updateDriver(editDriver.id, driverForm); showMsg('تم تعديل السائق'); }
    else { await addDriver(driverForm); showMsg('تمت إضافة السائق'); }
    setShowDriverForm(false); load();
  };

  // ===== PERIODS =====
  const savePeriod = async () => {
    if (!periodForm.label) { alert('اسم الفترة مطلوب'); return; }
    await addDeliveryPeriod({ label: `${periodForm.label}: ${periodForm.timeFrom} - ${periodForm.timeTo}` });
    setPeriodForm({ label: '', timeFrom: '', timeTo: '' });
    setShowPeriodForm(false); load(); showMsg('تمت إضافة الفترة');
  };

  const getDriverName = (id) => drivers.find(d => d.id === id)?.name || '---';

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>إدارة التوصيل</h2>
          <div className="breadcrumb">مناطق / سائقون / فترات / توزيع</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {activeTab === 'مناطق التوصيل' && <button className="btn btn-primary" onClick={openAddZone}>+ إضافة منطقة</button>}
          {activeTab === 'السائقون' && <button className="btn btn-primary" onClick={() => { setEditDriver(null); setDriverForm({ name:'', phone:'' }); setShowDriverForm(true); }}>+ إضافة سائق</button>}
          {activeTab === 'فترات التوصيل' && <button className="btn btn-primary" onClick={() => setShowPeriodForm(true)}>+ إضافة فترة</button>}
        </div>
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        {/* Tabs */}
        <div style={{ display:'flex', gap:'4px', marginBottom:'20px', borderBottom:'2px solid #e2e8f0' }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding:'10px 18px', border:'none', background:'none',
              fontFamily:'var(--font-main)', fontSize:'0.88rem', fontWeight:600,
              cursor:'pointer', color: activeTab===tab ? '#0d9488' : '#64748b',
              borderBottom: activeTab===tab ? '2px solid #0d9488' : '2px solid transparent',
              marginBottom:'-2px',
            }}>{tab}</button>
          ))}
        </div>

        {loading ? <div className="loading"><div className="spinner"/>جاري التحميل...</div> : <>

          {/* ===== مناطق التوصيل ===== */}
          {activeTab === 'مناطق التوصيل' && (
            <div>
              <div className="stats-grid" style={{ marginBottom:'20px' }}>
                <div className="stat-card"><div className="stat-icon teal">🗺️</div><div className="stat-info"><h3>{zones.length}</h3><p>إجمالي المناطق</p></div></div>
                <div className="stat-card"><div className="stat-icon blue">✅</div><div className="stat-info"><h3>{zones.filter(z=>Object.keys(z.drivers||{}).length>0).length}</h3><p>مناطق مع سائقين</p></div></div>
                <div className="stat-card"><div className="stat-icon orange">⚠️</div><div className="stat-info"><h3>{zones.filter(z=>!Object.keys(z.drivers||{}).length).length}</h3><p>بدون سائق</p></div></div>
                <div className="stat-card"><div className="stat-icon purple">👨‍✈️</div><div className="stat-info"><h3>{drivers.length}</h3><p>سائقون</p></div></div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h3>قائمة مناطق التوصيل</h3>
                  <span className="badge badge-teal">{zones.length} منطقة</span>
                </div>
                <div className="table-wrapper">
                  {zones.length === 0 ? (
                    <div className="empty-state"><div className="empty-icon">🗺️</div><h3>لا يوجد مناطق</h3><button className="btn btn-primary" style={{marginTop:'12px'}} onClick={openAddZone}>+ إضافة منطقة</button></div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>كود</th><th>المنطقة</th><th>المحافظة</th>
                          <th>المناطق التابعة</th><th>الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {zones.map(zone => (
                          <tr key={zone.id} className="fade-in">
                            <td><span style={{background:'#0d9488',color:'white',padding:'3px 10px',borderRadius:'6px',fontSize:'0.82rem',fontWeight:800}}>{zone.zoneCode||'Z'}</span></td>
                            <td><strong>{zone.name}</strong></td>
                            <td><span className="badge badge-teal">{zone.governorate}</span></td>
                            <td style={{maxWidth:'200px'}}>
                              <div style={{fontSize:'0.75rem',color:'#64748b',lineHeight:'1.6'}}>
                                {(zone.regions||[]).slice(0,4).join('، ')}
                                {(zone.regions||[]).length>4 && ` +${zone.regions.length-4}`}
                              </div>
                            </td>
                            <td>
                              <div style={{display:'flex',gap:'6px'}}>
                                <button className="btn btn-outline btn-sm" onClick={() => openEditZone(zone)}>تعديل</button>
                                <button className="btn btn-danger btn-sm" onClick={() => { if(window.confirm('حذف؟')) deleteZone(zone.id).then(load); }}>حذف</button>
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
          )}

          {/* ===== السائقون ===== */}
          {activeTab === 'السائقون' && (
            <div className="card">
              <div className="card-header"><h3>قائمة السائقين</h3><span className="badge badge-teal">{drivers.length} سائق</span></div>
              <div className="table-wrapper">
                {drivers.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">👨‍✈️</div><h3>لا يوجد سائقون</h3><button className="btn btn-primary" style={{marginTop:'12px'}} onClick={() => { setEditDriver(null); setDriverForm({name:'',phone:''}); setShowDriverForm(true); }}>+ إضافة سائق</button></div>
                ) : (
                  <table>
                    <thead><tr><th>السائق</th><th>الهاتف</th><th>المناطق المعينة</th><th>الإجراءات</th></tr></thead>
                    <tbody>
                      {drivers.map(driver => {
                        const driverZones = zones.filter(z => Object.values(z.drivers||{}).includes(driver.id));
                        return (
                          <tr key={driver.id} className="fade-in">
                            <td>
                              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                                <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'#0d9488',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700}}>{driver.name?.charAt(0)}</div>
                                <strong>{driver.name}</strong>
                              </div>
                            </td>
                            <td>{driver.phone}</td>
                            <td>
                              <div style={{display:'flex',flexWrap:'wrap',gap:'4px'}}>
                                {driverZones.map(z => {
                                  const shift = Object.entries(z.drivers||{}).find(([,v])=>v===driver.id)?.[0];
                                  return <span key={z.id} style={{background:'#f0fdfa',color:'#0f766e',padding:'2px 8px',borderRadius:'999px',fontSize:'0.72rem',fontWeight:600,border:'1px solid #ccfbf1'}}>{z.name} ({shift})</span>;
                                })}
                                {driverZones.length===0 && <span style={{color:'#94a3b8',fontSize:'0.82rem'}}>لا يوجد مناطق</span>}
                              </div>
                            </td>
                            <td>
                              <div style={{display:'flex',gap:'6px'}}>
                                <button className="btn btn-outline btn-sm" onClick={() => { setEditDriver(driver); setDriverForm({name:driver.name,phone:driver.phone}); setShowDriverForm(true); }}>تعديل</button>
                                <button className="btn btn-danger btn-sm" onClick={() => { if(window.confirm('حذف؟')) deleteDriver(driver.id).then(load); }}>حذف</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ===== فترات التوصيل ===== */}
          {activeTab === 'فترات التوصيل' && (
            <div className="card">
              <div className="card-header"><h3>فترات التوصيل</h3><span className="badge badge-teal">{periods.length} فترة</span></div>
              <div className="card-body">
                {periods.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">⏰</div><h3>لا يوجد فترات</h3></div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                    {periods.map(p => (
                      <div key={p.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 16px',background:'#f0fdfa',borderRadius:'8px',border:'1px solid #ccfbf1'}}>
                        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                          <span style={{fontSize:'1.2rem'}}>⏰</span>
                          <strong>{p.label}</strong>
                        </div>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteDeliveryPeriod(p.id).then(load)}>حذف</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== توزيع السائقين (شيفتات) ===== */}
          {activeTab === 'توزيع السائقين' && (
            <div>
              <div style={{marginBottom:'16px',padding:'12px 16px',background:'#f0fdfa',borderRadius:'8px',border:'1px solid #ccfbf1',fontSize:'0.85rem',color:'#0f766e'}}>
                💡 يمكن تعيين عدة سائقين لنفس المنطقة في شيفتات مختلفة
              </div>
              {zones.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">🗺️</div><h3>أضف مناطق أولاً</h3></div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
                  {zones.map(zone => (
                    <div key={zone.id} className="card">
                      <div className="card-header">
                        <h3>
                          <span style={{background:'#0d9488',color:'white',padding:'2px 10px',borderRadius:'6px',fontSize:'0.82rem',fontWeight:800,marginLeft:'10px'}}>{zone.zoneCode||'Z'}</span>
                          {zone.name}
                          <span style={{fontSize:'0.78rem',color:'#64748b',fontWeight:400,marginRight:'8px'}}>{zone.governorate}</span>
                        </h3>
                        <span style={{fontSize:'0.78rem',color:'#94a3b8'}}>{(zone.regions||[]).slice(0,3).join('، ')}</span>
                      </div>
                      <div className="card-body" style={{padding:'16px 24px'}}>
                        <div className="form-grid">
                          {SHIFTS.map(shift => (
                            <div key={shift} className="form-group">
                              <label className="form-label">{shift}</label>
                              <select
                                className="form-control"
                                value={(zone.drivers||{})[shift] || ''}
                                onChange={e => assignDriverToShift(zone.id, shift, e.target.value)}
                              >
                                <option value="">-- بدون سائق --</option>
                                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                              </select>
                              {(zone.drivers||{})[shift] && (
                                <div style={{fontSize:'0.75rem',color:'#0d9488',marginTop:'4px',fontWeight:600}}>
                                  📞 {drivers.find(d=>d.id===(zone.drivers||{})[shift])?.phone}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>}
      </div>

      {/* Modal: Zone */}
      {showZoneForm && (
        <div className="modal-overlay" onClick={() => setShowZoneForm(false)}>
          <div className="modal" style={{maxWidth:'650px',maxHeight:'90vh',overflowY:'auto'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editZone ? 'تعديل منطقة' : 'إضافة منطقة'}</h3>
              <button className="modal-close" onClick={() => setShowZoneForm(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{marginBottom:'16px'}}>
                <div className="form-group">
                  <label className="form-label">اسم المنطقة *</label>
                  <input className="form-control" placeholder="مثال: Route A - Salmiya" value={zoneForm.name} onChange={e=>setZoneForm(p=>({...p,name:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">كود المنطقة</label>
                  <input className="form-control" placeholder="Z1, Z2..." value={zoneForm.zoneCode} onChange={e=>setZoneForm(p=>({...p,zoneCode:e.target.value}))}/>
                </div>
              </div>
              <div className="form-group" style={{marginBottom:'16px'}}>
                <label className="form-label">المحافظة</label>
                <select className="form-control" value={zoneForm.governorate} onChange={e=>{setZoneForm(p=>({...p,governorate:e.target.value}));setSelectedRegions([]);}}>
                  {Object.keys(KUWAIT_GOVERNORATES).map(g=><option key={g}>{g}</option>)}
                </select>
              </div>
              <div className="form-group" style={{marginBottom:'20px'}}>
                <label className="form-label">المناطق التابعة ({selectedRegions.length} محدد)</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:'8px',padding:'12px',background:'#f8fafc',borderRadius:'8px',border:'1px solid #e2e8f0',maxHeight:'220px',overflowY:'auto'}}>
                  {(KUWAIT_GOVERNORATES[zoneForm.governorate]||[]).map(region=>(
                    <label key={region} style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',padding:'5px 10px',borderRadius:'6px',background:selectedRegions.includes(region)?'#f0fdfa':'white',border:selectedRegions.includes(region)?'1px solid #ccfbf1':'1px solid #e2e8f0',fontSize:'0.82rem',fontWeight:500,transition:'all 0.15s'}}>
                      <input type="checkbox" checked={selectedRegions.includes(region)} onChange={()=>toggleRegion(region)} style={{accentColor:'#0d9488'}}/>
                      {region}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',gap:'10px'}}>
                <button className="btn btn-primary" style={{flex:1}} onClick={saveZone}>{editZone?'حفظ التعديلات':'إضافة المنطقة'}</button>
                <button className="btn btn-ghost" onClick={()=>setShowZoneForm(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Driver */}
      {showDriverForm && (
        <div className="modal-overlay" onClick={()=>setShowDriverForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editDriver?'تعديل سائق':'إضافة سائق'}</h3>
              <button className="modal-close" onClick={()=>setShowDriverForm(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-1">
                <div className="form-group">
                  <label className="form-label">الاسم *</label>
                  <input className="form-control" placeholder="اسم السائق" value={driverForm.name} onChange={e=>setDriverForm(p=>({...p,name:e.target.value}))}/>
                </div>
                <div className="form-group">
                  <label className="form-label">رقم الهاتف *</label>
                  <input className="form-control" placeholder="05xxxxxxxx" value={driverForm.phone} onChange={e=>setDriverForm(p=>({...p,phone:e.target.value}))}/>
                </div>
                <div style={{display:'flex',gap:'10px'}}>
                  <button className="btn btn-primary" style={{flex:1}} onClick={saveDriver}>{editDriver?'حفظ التعديلات':'إضافة السائق'}</button>
                  <button className="btn btn-ghost" onClick={()=>setShowDriverForm(false)}>إلغاء</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Period */}
      {showPeriodForm && (
        <div className="modal-overlay" onClick={()=>setShowPeriodForm(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>إضافة فترة توصيل</h3>
              <button className="modal-close" onClick={()=>setShowPeriodForm(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-1">
                <div className="form-group">
                  <label className="form-label">اسم الفترة</label>
                  <input className="form-control" placeholder="الفترة الصباحية" value={periodForm.label} onChange={e=>setPeriodForm(p=>({...p,label:e.target.value}))}/>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">من</label>
                    <input className="form-control" type="time" value={periodForm.timeFrom} onChange={e=>setPeriodForm(p=>({...p,timeFrom:e.target.value}))}/>
                  </div>
                  <div className="form-group">
                    <label className="form-label">إلى</label>
                    <input className="form-control" type="time" value={periodForm.timeTo} onChange={e=>setPeriodForm(p=>({...p,timeTo:e.target.value}))}/>
                  </div>
                </div>
                <div style={{display:'flex',gap:'10px'}}>
                  <button className="btn btn-primary" style={{flex:1}} onClick={savePeriod}>إضافة الفترة</button>
                  <button className="btn btn-ghost" onClick={()=>setShowPeriodForm(false)}>إلغاء</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
