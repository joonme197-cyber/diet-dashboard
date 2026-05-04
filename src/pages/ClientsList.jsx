import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getClients, deleteClient } from '../firebase/clientService';
import { getClientDailyMeals } from '../firebase/mealService';
import StickerLabel from '../components/StickerLabel';
import { useLang } from '../LanguageContext';

export default function ClientsList() {
  const { lang, t, isAr } = useLang();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyMeals, setDailyMeals] = useState(null);
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [showSticker, setShowSticker] = useState(false);

  const loadClients = async () => {
    setLoading(true);
    try { const data = await getClients(); setClients(data); }
    catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadClients(); }, []);

  const handleDelete = async (id) => {
    if (window.confirm(isAr ? 'هل تريد حذف هذا العميل؟' : 'Delete this client?')) {
      await deleteClient(id); loadClients();
    }
  };

  const handlePrintSticker = async (client) => {
    setSelectedClient(client); setLoadingMeals(true); setShowSticker(true);
    try {
      const meals = await getClientDailyMeals(client.id, selectedDate);
      setDailyMeals(meals || { افطار: [], غداء: [], عشاء: [], سناك: [] });
    } catch (e) { setDailyMeals({ افطار: [], غداء: [], عشاء: [], سناك: [] }); }
    setLoadingMeals(false);
  };

  const formatMealsForSticker = (meals) => {
    if (!meals) return {};
    return {
      breakfast: (meals['افطار'] || []).map(m => m.title),
      lunch:     (meals['غداء']  || []).map(m => m.title),
      dinner:    (meals['عشاء']  || []).map(m => m.title),
      snacks:    (meals['سناك']  || []).map(m => m.title),
    };
  };

  const filtered = clients.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) || c.clientCode?.includes(search)
  );

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <h2>{isAr ? 'قائمة العملاء' : 'Clients List'}</h2>
          <div className="breadcrumb">{isAr ? 'العملاء / قائمة العملاء' : 'Clients / List'}</div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input type="date" className="form-control" value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)} />
          <Link to="/clients/add" className="btn btn-primary">
            + {isAr ? 'إضافة عميل' : 'Add Client'}
          </Link>
        </div>
      </div>

      <div className="page-body no-print">
        <div className="stats-grid">
          {[
            { icon: '👥', val: clients.length, label: isAr ? 'إجمالي العملاء' : 'Total Clients', cls: 'teal' },
            { icon: '📦', val: clients.filter(c=>c.bundleType==='normal').length, label: isAr ? 'باقة ثابتة' : 'Normal Bundle', cls: 'blue' },
            { icon: '✨', val: clients.filter(c=>c.bundleType==='custom').length, label: isAr ? 'باقة مرنة' : 'Custom Bundle', cls: 'orange' },
            { icon: '📅', val: new Date(selectedDate).toLocaleDateString(isAr?'ar':'en'), label: isAr ? 'تاريخ الاستيكر' : 'Sticker Date', cls: 'purple' },
          ].map((s,i) => (
            <div key={i} className="stat-card">
              <div className={`stat-icon ${s.cls}`}>{s.icon}</div>
              <div className="stat-info"><h3>{s.val}</h3><p>{s.label}</p></div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>{isAr ? 'العملاء المسجلين' : 'Registered Clients'}</h3>
            <input className="form-control" style={{ width: '250px' }}
              placeholder={isAr ? 'بحث بالاسم او الهاتف...' : 'Search by name or phone...'}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="table-wrapper">
            {loading ? (
              <div className="loading"><div className="spinner"/>{t.loading}</div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">👥</div>
                <h3>{isAr ? 'لا يوجد عملاء' : 'No clients found'}</h3>
                <Link to="/clients/add" className="btn btn-primary" style={{marginTop:'16px'}}>
                  + {isAr ? 'إضافة عميل' : 'Add Client'}
                </Link>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>{isAr ? 'الكود' : 'Code'}</th>
                    <th>{isAr ? 'الاسم' : 'Name'}</th>
                    <th>{isAr ? 'الهاتف' : 'Phone'}</th>
                    <th>{isAr ? 'المنطقة' : 'Region'}</th>
                    <th>{isAr ? 'نوع الباقة' : 'Bundle Type'}</th>
                    <th>{isAr ? 'تاريخ البدء' : 'Start Date'}</th>
                    <th>{isAr ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(client => (
                    <tr key={client.id} className="fade-in">
                      <td><span className="badge badge-teal">{client.clientCode}</span></td>
                      <td>
                        <Link to={`/clients/${client.id}`} style={{fontWeight:700,color:'#0d9488',textDecoration:'none'}}>
                          {client.name}
                        </Link>
                        <div style={{fontSize:'0.75rem',color:'#94a3b8',marginTop:'2px'}}>{client.email}</div>
                        {/* كود استرجاع الباسورد */}
                        {client.pendingResetOTP && (() => {
                          return (
                            <div style={{ marginTop:4, display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ background:'#fff7ed', color:'#d97706', border:'1px solid #fde68a', borderRadius:6, padding:'2px 8px', fontSize:'0.75rem', fontWeight:700 }}>
                                🔑 {client.pendingResetOTP}
                              </span>
                              <a href={`https://wa.me/96550771847?text=${encodeURIComponent(`مرحباً ${client.name}،\nكود إعادة تعيين كلمة المرور: *${client.pendingResetOTP}*\n🔑`)}`}
                                target="_blank" rel="noreferrer"
                                style={{ background:'#25D366', color:'white', borderRadius:6, padding:'2px 8px', fontSize:'0.72rem', fontWeight:700, textDecoration:'none' }}
                                onClick={e => e.stopPropagation()}>
                                💬
                              </a>
                            </div>
                          );
                        })()}
                      </td>
                      <td>{client.phone}</td>
                      <td>
                        {isAr ? client.governorate : client.governorateEn || client.governorate}
                        {client.region && <span style={{color:'#94a3b8'}}> / {isAr ? client.region : client.regionEn || client.region}</span>}
                      </td>
                      <td>
                        <span className={`badge ${client.bundleType==='normal'?'badge-green':'badge-orange'}`}>
                          {client.bundleType==='normal' ? (isAr?'ثابتة':'Normal') : (isAr?'مرنة':'Custom')}
                        </span>
                      </td>
                      <td>{client.startDate || '---'}</td>
                      <td>
                        <div style={{display:'flex',gap:'6px'}}>
                          <button className="btn btn-outline btn-sm" onClick={() => handlePrintSticker(client)}>
                            {isAr ? 'استيكر' : 'Label'}
                          </button>
                          <Link to={`/client-meals?clientId=${client.id}&date=${selectedDate}`} className="btn btn-ghost btn-sm">
                            {isAr ? 'وجبات' : 'Meals'}
                          </Link>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(client.id)}>
                            {isAr ? 'حذف' : 'Delete'}
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

      {/* Sticker Modal */}
      {showSticker && selectedClient && (
        <div className="modal-overlay no-print" onClick={() => setShowSticker(false)}>
          <div className="modal" style={{maxWidth:'560px'}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{isAr ? 'استيكر' : 'Label'}: {selectedClient.name} — {selectedDate}</h3>
              <button className="modal-close" onClick={() => setShowSticker(false)}>X</button>
            </div>
            <div className="modal-body" style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'16px'}}>
              {loadingMeals ? (
                <div className="loading"><div className="spinner"/>{t.loading}</div>
              ) : (
                <>
                  <StickerLabel client={selectedClient} deliveryDate={new Date(selectedDate)}
                    dailyMeals={formatMealsForSticker(dailyMeals)} lang={lang} />
                  {dailyMeals && Object.values(dailyMeals).some(a => a.length > 0) ? (
                    <div style={{width:'100%',background:'#f0fdfa',borderRadius:'8px',padding:'12px',fontSize:'0.82rem',border:'1px solid #ccfbf1'}}>
                      <div style={{fontWeight:700,marginBottom:'6px',color:'#0f766e'}}>
                        {isAr ? 'الوجبات المحددة:' : 'Selected Meals:'}
                      </div>
                      {['افطار','غداء','عشاء','سناك'].map(type => {
                        const meals = dailyMeals[type] || [];
                        if (!meals.length) return null;
                        const typeLabel = { افطار: isAr?'فطور':'Breakfast', غداء: isAr?'غداء':'Lunch', عشاء: isAr?'عشاء':'Dinner', سناك: isAr?'سناك':'Snacks' };
                        return (
                          <div key={type} style={{marginBottom:'4px'}}>
                            <strong>{typeLabel[type]}:</strong> {meals.map(m => m.title).join('، ')}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="alert alert-error" style={{width:'100%'}}>
                      {isAr ? 'لا توجد وجبات محددة —' : 'No meals selected —'}
                      <Link to="/client-meals" style={{color:'#b91c1c',fontWeight:700,marginRight:'4px'}}>
                        {isAr ? 'اختر الوجبات اولاً' : 'Select meals first'}
                      </Link>
                    </div>
                  )}
                  <div style={{display:'flex',gap:'10px',width:'100%'}}>
                    <button className="btn btn-primary" style={{flex:1}} onClick={() => window.print()}>
                      {isAr ? 'طباعة الاستيكر' : 'Print Label'}
                    </button>
                    <button className="btn btn-ghost" style={{flex:1}} onClick={() => setShowSticker(false)}>
                      {isAr ? 'إغلاق' : 'Close'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showSticker && selectedClient && !loadingMeals && (
        <div className="print-only" style={{display:'none'}}>
          <StickerLabel client={selectedClient} deliveryDate={new Date(selectedDate)}
            dailyMeals={formatMealsForSticker(dailyMeals)} lang={lang} />
        </div>
      )}
    </div>
  );
}
