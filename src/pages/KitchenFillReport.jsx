import { useState } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { getClients } from '../firebase/clientService';
import { getAllSubscriptions, getSubscriptionStatus, isDeliveryDay } from '../firebase/subscriptionService';
import { useLang } from '../LanguageContext';

const MEAL_SECTIONS = [
  { key: 'افطار', labelAr: 'الفطور', labelEn: 'Breakfast' },
  { key: 'غداء', labelAr: 'الغداء', labelEn: 'Lunch' },
  { key: 'عشاء', labelAr: 'العشاء', labelEn: 'Dinner' },
  { key: 'سناك', labelAr: 'السناك', labelEn: 'Snacks' },
];

export default function KitchenFillReport() {
  const { isAr } = useLang();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const L = {
    title: isAr ? 'تقرير تعبئة المطبخ' : 'Kitchen Fill Report',
    date: isAr ? 'تاريخ التوصيل' : 'Delivery Date',
    generate: isAr ? '📊 إنشاء التقرير' : '📊 Generate Report',
    print: isAr ? '🖨️ طباعة' : '🖨️ Print',
    client: isAr ? 'العميل' : 'Customer',
    code: isAr ? 'الكود' : 'Code',
    meal: isAr ? 'الوجبة' : 'Meal',
    protein: isAr ? 'بروتين' : 'Protein',
    carb: isAr ? 'كارب' : 'Carb',
    notes: isAr ? 'الملاحظات / الموانع' : 'Notes / Dislikes',
    noData: isAr ? 'لا يوجد بيانات' : 'No data found',
    loading: isAr ? 'جاري التحميل...' : 'Loading...',
  };

  const buildReport = async () => {
    setLoading(true);
    setFetched(false);

    try {
      const [clientsList, allSubs, snapshot, mealsSnap] = await Promise.all([
        getClients(),
        getAllSubscriptions(),
        getDocs(collection(db, 'clientDailyMeals')),
        getDocs(collection(db, 'meals')),
      ]);

      const allMeals = mealsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const dayDocs = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.date === selectedDate);

      // map clientId → client + activeSub
      // ✅ لم نعد نستبعد العميل لو مفيش active subscription
      const clientMap = {};
      for (const client of clientsList) {
        const activeSub = allSubs.find(
          s => s.clientId === client.id && getSubscriptionStatus(s) === 'active'
        );

        clientMap[client.id] = {
          client,
          activeSub: activeSub || null,
        };
      }

      // بناء الصفوف — كل عميل له مجموعة وجبات
      const result = [];

      for (const dayDoc of dayDocs) {
        const entry = clientMap[dayDoc.clientId];
        if (!entry || !entry.activeSub) continue;
        // تخطى لو selectedDate خارج نطاق الاشتراك
        if (selectedDate < entry.activeSub.startDate || selectedDate > entry.activeSub.endDate) continue;
        // تخطى لو اليوم مش ضمن أيام التوصيل للاشتراك
        if (!isDeliveryDay(entry.activeSub, selectedDate)) continue;
        // تخطى العميل لو اليوم مجمّد في اشتراكه
        if ((entry.activeSub.frozenDays || []).includes(selectedDate)) continue;

        const { client, activeSub } = entry;
        const protein = activeSub?.protein || client.protein || '---';
        const carb = activeSub?.carbs || client.carbs || '---';
        const notes = [client.allergy, client.deliveryNote].filter(Boolean).join(' | ') || '';

        const clientMeals = [];

        for (const sec of MEAL_SECTIONS) {
          const mealList = dayDoc.meals?.[sec.key] || [];

          for (const m of mealList) {
            const master = allMeals.find(x => x.id === m.id);
            clientMeals.push({
              section: isAr ? sec.labelAr : sec.labelEn,
              mealName: isAr
                ? (master?.mealTitle || m.title || m.id)
                : (master?.mealTitleEn || master?.mealTitle || m.title || m.id),
            });
          }
        }

        if (clientMeals.length === 0) continue;

        result.push({
          clientId: client.id,
          clientName: client.name,
          clientCode: client.clientCode || '',
          protein,
          carb,
          notes,
          meals: clientMeals,
        });
      }

      // ترتيب حسب اسم العميل
      result.sort((a, b) => a.clientName.localeCompare(b.clientName));

      setRows(result);
      setFetched(true);
    } catch (error) {
      console.error('Error building kitchen fill report:', error);
      setRows([]);
      setFetched(true);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => {
    const dt = new Date(d);
    return `${dt.getDate().toString().padStart(2, '0')}/${(dt.getMonth() + 1).toString().padStart(2, '0')}/${dt.getFullYear()}`;
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header no-print">
        <div>
          <h2>🍽️ {L.title}</h2>
          <div className="breadcrumb">{isAr ? 'تقرير تعبئة الوجبات لكل عميل' : 'Meal filling report per client'}</div>
        </div>
        {fetched && rows.length > 0 && (
          <button className="btn btn-primary" onClick={() => window.print()}>
            {L.print}
          </button>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="page-body no-print">
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-body">
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1, maxWidth: '300px' }}>
                <label className="form-label">{L.date}</label>
                <input
                  type="date"
                  className="form-control"
                  value={selectedDate}
                  onChange={e => { setSelectedDate(e.target.value); setFetched(false); }}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={buildReport}
                disabled={loading}
                style={{ padding: '10px 28px' }}
              >
                {loading
                  ? <><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> {L.loading}</>
                  : L.generate}
              </button>
            </div>

            {fetched && (
              <div style={{
                display: 'flex',
                gap: '16px',
                marginTop: '16px',
                padding: '12px',
                background: '#f0fdfa',
                borderRadius: '8px',
                flexWrap: 'wrap',
                fontSize: '0.88rem'
              }}>
                <span style={{ color: '#0f766e', fontWeight: 700 }}>
                  {isAr ? 'عدد العملاء' : 'Clients'}: {rows.length}
                </span>
                <span style={{ color: '#7c3aed', fontWeight: 700 }}>
                  {isAr ? 'إجمالي الوجبات' : 'Total Meals'}: {rows.reduce((s, r) => s + r.meals.length, 0)}
                </span>
              </div>
            )}
          </div>
        </div>

        {fetched && rows.length === 0 && (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">🍽️</div>
              <h3>{L.noData}</h3>
            </div>
          </div>
        )}
      </div>

      {/* ── Print/Preview Area ── */}
      {fetched && rows.length > 0 && (
        <div className="print-area" style={{ padding: '0 32px' }}>
          <style>{`
            @media print {
              .no-print { display: none !important; }
              .print-area { padding: 0 !important; }
              @page { size: A4; margin: 15mm 12mm; }
              body { background: white !important; }
              .client-block { page-break-inside: avoid; }
            }
          `}</style>

          {/* Report Header */}
          <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid #0d9488' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0d9488', margin: 0 }}>
              🍽️ {L.title}
            </h1>
            <div style={{ fontSize: '0.88rem', color: '#64748b', marginTop: '4px' }}>
              {isAr ? 'تاريخ' : 'Date'}: <strong>{formatDate(selectedDate)}</strong>
              &nbsp;|&nbsp;
              {isAr ? 'عدد العملاء' : 'Clients'}: <strong>{rows.length}</strong>
              &nbsp;|&nbsp;
              {isAr ? 'إجمالي الوجبات' : 'Total Meals'}: <strong>{rows.reduce((s, r) => s + r.meals.length, 0)}</strong>
            </div>
          </div>

          {/* Table */}
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontFamily: isAr ? "'Cairo', Arial, sans-serif" : "Arial, sans-serif",
            fontSize: '12px',
            direction: isAr ? 'rtl' : 'ltr',
          }}>
            <thead>
              <tr style={{ background: '#0d9488', color: 'white' }}>
                <th style={th}>{L.client}</th>
                <th style={th}>{L.code}</th>
                <th style={th}>{L.meal}</th>
                <th style={{ ...th, width: '70px' }}>{L.protein}</th>
                <th style={{ ...th, width: '70px' }}>{L.carb}</th>
                <th style={{ ...th, width: '180px' }}>{L.notes}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                row.meals.map((meal, mi) => (
                  <tr
                    key={`${row.clientId}-${mi}`}
                    className={mi === 0 ? 'client-block' : ''}
                    style={{
                      background: ri % 2 === 0 ? 'white' : '#f8fafc',
                      borderTop: mi === 0 ? '2px solid #0d9488' : 'none',
                    }}
                  >
                    {mi === 0 && (
                      <td rowSpan={row.meals.length} style={{
                        ...td,
                        fontWeight: 700,
                        verticalAlign: 'middle',
                        borderRight: isAr ? 'none' : '1px solid #e2e8f0',
                        borderLeft: isAr ? '1px solid #e2e8f0' : 'none',
                        background: ri % 2 === 0 ? '#f0fdfa' : '#e0f7f4',
                      }}>
                        {row.clientName}
                      </td>
                    )}

                    {mi === 0 && (
                      <td rowSpan={row.meals.length} style={{
                        ...td,
                        textAlign: 'center',
                        fontWeight: 700,
                        color: '#0d9488',
                        verticalAlign: 'middle',
                        background: ri % 2 === 0 ? '#f0fdfa' : '#e0f7f4',
                      }}>
                        {row.clientCode}
                      </td>
                    )}

                    <td style={td}>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#7c3aed',
                        marginLeft: isAr ? '0' : '4px',
                        marginRight: isAr ? '4px' : '0',
                      }}>
                        {meal.section}:
                      </span>
                      {meal.mealName}
                    </td>

                    {mi === 0 && (
                      <td rowSpan={row.meals.length} style={{
                        ...td,
                        textAlign: 'center',
                        fontWeight: 700,
                        verticalAlign: 'middle',
                      }}>
                        {row.protein}g
                      </td>
                    )}

                    {mi === 0 && (
                      <td rowSpan={row.meals.length} style={{
                        ...td,
                        textAlign: 'center',
                        fontWeight: 700,
                        verticalAlign: 'middle',
                      }}>
                        {row.carb}g
                      </td>
                    )}

                    {mi === 0 && (
                      <td rowSpan={row.meals.length} style={{
                        ...td,
                        verticalAlign: 'middle',
                        color: row.notes ? '#dc2626' : '#94a3b8',
                        fontWeight: row.notes ? 700 : 400,
                        fontSize: '11px',
                      }}>
                        {row.notes || '—'}
                      </td>
                    )}
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Styles ──
const th = {
  padding: '10px 12px',
  textAlign: 'right',
  fontWeight: 700,
  fontSize: '12px',
  border: '1px solid #0a7a6e',
};

const td = {
  padding: '8px 12px',
  border: '1px solid #e2e8f0',
  fontSize: '12px',
  verticalAlign: 'top',
};