import { useState, useEffect } from 'react';
import { getClients } from '../firebase/clientService';
import { getClientDailyMeals } from '../firebase/mealService';
import { getClientSubscriptions, getSubscriptionStatus } from '../firebase/subscriptionService';
import StickerLabel from '../components/StickerLabel';
import { useLang } from '../LanguageContext';

export default function LabelsPage() {
  const { lang, isAr } = useLang();
  const [clients, setClients] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [clientsWithMeals, setClientsWithMeals] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => { getClients().then(setClients); }, []);

  const fetchAllMeals = async () => {
    setLoading(true); setFetched(false);
    const result = [];
    for (const client of clients) {
      // جلب الوجبات والاشتراك النشط معاً
      const [meals, subs] = await Promise.all([
        getClientDailyMeals(client.id, selectedDate),
        getClientSubscriptions(client.id),
      ]);
      const activeSub = subs.find(s => getSubscriptionStatus(s) === 'active') || null;
      result.push({
        ...client,
        activeSub,
        dailyMeals: meals || { افطار: [], غداء: [], عشاء: [], سناك: [] },
        hasMeals: meals && Object.values(meals).some(a => a.length > 0),
      });
    }
    setClientsWithMeals(result);
    // يظهر فقط العملاء اللي عندهم اشتراك نشط ووجبات
    setSelected(result.filter(c => c.hasMeals && c.activeSub).map(c => c.id));
    setFetched(true); setLoading(false);
  };

  const toggleSelect = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const selectAll = () => setSelected(clientsWithMeals.map(c => c.id));
  const clearAll = () => setSelected([]);
  const selectWithMeals = () => setSelected(clientsWithMeals.filter(c => c.hasMeals && c.activeSub).map(c => c.id));

  // الوجبات تبقى بمفاتيح عربية — StickerLabel يقرأها مباشرة
  const selectedClients = clientsWithMeals.filter(c => selected.includes(c.id));

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <h2>{isAr ? 'طباعة الملصقات' : 'Print Labels'}</h2>
          <div className="breadcrumb">{isAr ? 'حدد التاريخ واستدعي بيانات العملاء' : 'Select date and fetch client data'}</div>
        </div>
        {fetched && (
          <button className="btn btn-primary" disabled={selected.length === 0} onClick={() => window.print()}>
            {isAr ? `طباعة (${selected.length}) ملصق` : `Print (${selected.length}) Labels`}
          </button>
        )}
      </div>

      <div className="page-body no-print">
        {/* Date selector */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-body">
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1, maxWidth: '300px' }}>
                <label className="form-label">{isAr ? 'تاريخ التوصيل' : 'Delivery Date'}</label>
                <input type="date" className="form-control" value={selectedDate}
                  onChange={e => { setSelectedDate(e.target.value); setFetched(false); }} />
              </div>
              <button className="btn btn-primary" onClick={fetchAllMeals}
                disabled={loading || clients.length === 0} style={{ padding: '10px 28px' }}>
                {loading ? (
                  <><div className="spinner" style={{ width:'16px', height:'16px', borderWidth:'2px' }} />
                  {isAr ? ' جاري التحميل...' : ' Loading...'}</>
                ) : (isAr ? 'استدعاء البيانات' : 'Fetch Data')}
              </button>
            </div>

            {fetched && (
              <div style={{ display:'flex', gap:'16px', marginTop:'16px', padding:'12px', background:'#f0fdfa', borderRadius:'8px', flexWrap:'wrap', fontSize:'0.88rem' }}>
                <span style={{ color:'#0f766e', fontWeight:700 }}>{isAr?'إجمالي العملاء':'Total Clients'}: {clientsWithMeals.length}</span>
                <span style={{ color:'#16a34a', fontWeight:700 }}>{isAr?'لديهم وجبات':'With Meals'}: {clientsWithMeals.filter(c=>c.hasMeals).length}</span>
                <span style={{ color:'#dc2626', fontWeight:700 }}>{isAr?'بدون وجبات':'No Meals'}: {clientsWithMeals.filter(c=>!c.hasMeals).length}</span>
                <span style={{ color:'#0d9488', fontWeight:700 }}>{isAr?'محدد للطباعة':'Selected'}: {selected.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* Clients table */}
        {fetched && (
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-header">
              <h3>{isAr ? `العملاء ليوم ${selectedDate}` : `Clients for ${selectedDate}`}</h3>
              <div style={{ display:'flex', gap:'8px' }}>
                <button className="btn btn-ghost btn-sm" onClick={selectWithMeals}>{isAr?'تحديد من لديهم وجبات':'With Meals'}</button>
                <button className="btn btn-ghost btn-sm" onClick={selectAll}>{isAr?'الكل':'All'}</button>
                <button className="btn btn-ghost btn-sm" onClick={clearAll}>{isAr?'إلغاء الكل':'Clear'}</button>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th style={{ width:'40px' }}>
                      <input type="checkbox" checked={selected.length===clientsWithMeals.length}
                        onChange={e=>e.target.checked?selectAll():clearAll()} style={{accentColor:'var(--teal)'}}/>
                    </th>
                    <th>{isAr?'الكود':'Code'}</th>
                    <th>{isAr?'الاسم':'Name'}</th>
                    <th>{isAr?'الهاتف':'Phone'}</th>
                    <th>{isAr?'المنطقة':'Region'}</th>
                    <th>{isAr?'الفطور':'Breakfast'}</th>
                    <th>{isAr?'الغداء':'Lunch'}</th>
                    <th>{isAr?'العشاء':'Dinner'}</th>
                    <th>{isAr?'السناك':'Snacks'}</th>
                    <th>{isAr?'الحالة':'Status'}</th>
                  </tr>
                </thead>
                <tbody>
                  {clientsWithMeals.map(client => (
                    <tr key={client.id} style={{ background: selected.includes(client.id)?'#f0fdfa':'white' }}>
                      <td>
                        <input type="checkbox" checked={selected.includes(client.id)}
                          onChange={()=>toggleSelect(client.id)} style={{accentColor:'var(--teal)'}}/>
                      </td>
                      <td><span className="badge badge-teal">{client.clientCode}</span></td>
                      <td><strong>{client.name}</strong></td>
                      <td>{client.phone}</td>
                      <td style={{fontSize:'0.82rem'}}>
                        {isAr ? client.governorate : (client.governorateEn||client.governorate)}
                        {client.region && <span style={{color:'#94a3b8'}}> / {isAr?client.region:(client.regionEn||client.region)}</span>}
                      </td>
                      <td style={{fontSize:'0.78rem',color:'#374151'}}>{(client.dailyMeals?.['افطار']||[]).map(m=>m.title).join('، ')||'—'}</td>
                      <td style={{fontSize:'0.78rem',color:'#374151'}}>{(client.dailyMeals?.['غداء']||[]).map(m=>m.title).join('، ')||'—'}</td>
                      <td style={{fontSize:'0.78rem',color:'#374151'}}>{(client.dailyMeals?.['عشاء']||[]).map(m=>m.title).join('، ')||'—'}</td>
                      <td style={{fontSize:'0.78rem',color:'#374151'}}>{(client.dailyMeals?.['سناك']||[]).map(m=>m.title).join('، ')||'—'}</td>
                      <td>
                        {client.hasMeals
                          ? <span className="badge badge-green">{isAr?'جاهز':'Ready'}</span>
                          : <span className="badge badge-orange">{isAr?'بدون وجبات':'No Meals'}</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Preview */}
        {selectedClients.length > 0 && (
          <div>
            <div className="section-title" style={{ marginBottom:'16px' }}>
              {isAr ? `معاينة الملصقات (${selectedClients.length})` : `Preview Labels (${selectedClients.length})`}
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'16px' }}>
              {selectedClients.map((c, i) => (
                <StickerLabel
                  key={`${c.id}-${lang}`}
                  client={c}
                  activeSub={c.activeSub}
                  deliveryDate={new Date(selectedDate)}
                  dailyMeals={c.dailyMeals}
                  qIndex={i + 1}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Print area */}
      <div className="print-only" style={{ display:'none' }}>
        <style>{`
          @media print {
            .print-only { display: block !important; }
            .no-print { display: none !important; }
            body { background: white !important; }
            @page { size: 100mm 80mm; margin: 0; }
          }
        `}</style>
        {selectedClients.map((c, i) => (
          <StickerLabel
            key={`print-${c.id}-${lang}`}
            client={c}
            activeSub={c.activeSub}
            deliveryDate={new Date(selectedDate)}
            dailyMeals={c.dailyMeals}
            qIndex={i + 1}
          />
        ))}
      </div>
    </div>
  );
}
