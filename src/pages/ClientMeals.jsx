import { useState, useEffect } from 'react';
import { getClients } from '../firebase/clientService';
import { getAllSubscriptions, getSubscriptionStatus } from '../firebase/subscriptionService';
import {
  MEALS_DATA, CYCLE_DAYS,
  getMenuDay, saveClientDailyMeals, getClientDailyMeals
} from '../firebase/mealService';

const MEAL_ICONS = { افطار: '🍳', غداء: '🍛', عشاء: '🌙', سناك: '🥗' };

// حساب key اليوم في الدورة بناءً على تاريخ البدء
const getCycleDayKey = (startDate, targetDate) => {
  const start = new Date(startDate);
  const target = new Date(targetDate);
  const diffDays = Math.floor((target - start) / (1000 * 60 * 60 * 24));
  const dayInCycle = diffDays % 28;
  const week = Math.floor(dayInCycle / 7) + 1;
  const days = ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
  const dayOfWeek = target.getDay(); // 0=Sunday
  const dayMap = [1,2,3,4,5,6,0]; // map to our order (sat=0)
  const dayIdx = dayMap[dayOfWeek];
  return `w${week}_${days[dayIdx]}`;
};

export default function ClientMeals() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [menuMeals, setMenuMeals] = useState([]);
  const [clientMeals, setClientMeals] = useState({ افطار: [], غداء: [], عشاء: [], سناك: [] });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadActiveClients = async () => {
      const [allClients, allSubs] = await Promise.all([
        getClients(),
        getAllSubscriptions(),
      ]);
      // فقط العملاء اللي عندهم اشتراك نشط
      const activeClients = allClients.filter(c =>
        allSubs.some(s => s.clientId === c.id && getSubscriptionStatus(s) === 'active')
      );
      // أضف الاشتراك النشط على كل عميل عشان نقدر نستخدمه لاحقاً
      const clientsWithSub = activeClients.map(c => ({
        ...c,
        activeSub: allSubs.find(s => s.clientId === c.id && getSubscriptionStatus(s) === 'active'),
      }));
      setClients(clientsWithSub);
    };
    loadActiveClients();
  }, []);

  useEffect(() => {
    if (selectedClient && selectedDate) loadDayData();
  }, [selectedClient, selectedDate]);

  const loadDayData = async () => {
    setLoading(true);
    try {
      // جلب المنيو اليومي
      const subStartDate = selectedClient.activeSub?.startDate || selectedClient.startDate || selectedDate;
      const dayKey = getCycleDayKey(subStartDate, selectedDate);
      const menuDay = await getMenuDay('default', dayKey);
      const mealIds = menuDay?.meals || [];
      const meals = mealIds.map(id => MEALS_DATA.find(m => m.id === id)).filter(Boolean);
      setMenuMeals(meals);

      // جلب اختيارات العميل الحالية
      const existing = await getClientDailyMeals(selectedClient.id, selectedDate);
      if (existing) {
        setClientMeals(existing);
      } else {
        setClientMeals({ افطار: [], غداء: [], عشاء: [], سناك: [] });
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const toggleClientMeal = (meal) => {
    const type = meal.mealType;
    setClientMeals(p => {
      const current = p[type] || [];
      const exists = current.find(m => m.id === meal.id);
      return {
        ...p,
        [type]: exists
          ? current.filter(m => m.id !== meal.id)
          : [...current, { id: meal.id, title: meal.mealTitle }]
      };
    });
  };

  const isSelected = (meal) => {
    const type = meal.mealType;
    return (clientMeals[type] || []).some(m => m.id === meal.id);
  };

  const saveSelections = async () => {
    if (!selectedClient) return;
    setSaving(true);
    await saveClientDailyMeals(selectedClient.id, selectedDate, clientMeals);
    setSaving(false);
    setMsg('✅ تم حفظ اختيارات العميل بنجاح!');
    setTimeout(() => setMsg(''), 2500);
  };

  const totalSelected = Object.values(clientMeals).reduce((s, arr) => s + arr.length, 0);

  const filteredMenuMeals = menuMeals.filter(m =>
    m.mealTitle.includes(search) || m.mealTitleEn.toLowerCase().includes(search.toLowerCase())
  );

  const subStartDate = selectedClient?.activeSub?.startDate || selectedClient?.startDate;
  const dayKey = subStartDate
    ? getCycleDayKey(subStartDate, selectedDate)
    : null;
  const dayLabel = dayKey ? CYCLE_DAYS.find(d => d.key === dayKey)?.label : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>🍽️ اختيار وجبات العميل</h2>
          <div className="breadcrumb">الأدمن يختار وجبات العميل اليومية</div>
        </div>
        {totalSelected > 0 && (
          <button className="btn btn-primary" onClick={saveSelections} disabled={saving}>
            {saving ? '⏳ جاري الحفظ...' : `✅ حفظ الاختيارات (${totalSelected})`}
          </button>
        )}
      </div>

      <div className="page-body">
        {msg && <div className="alert alert-success fade-in">{msg}</div>}

        {/* Client + Date selector */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-body">
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">👤 اختر العميل</label>
                <select
                  className="form-control"
                  value={selectedClient?.id || ''}
                  onChange={e => {
                    const c = clients.find(x => x.id === e.target.value);
                    setSelectedClient(c || null);
                  }}
                >
                  <option value="">-- اختر عميل --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.clientCode}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">📅 تاريخ التوصيل</label>
                <input
                  className="form-control"
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                />
              </div>
            </div>

            {selectedClient && dayLabel && (
              <div style={{
                marginTop: '12px', padding: '10px 14px', background: '#f0fdfa',
                borderRadius: '8px', fontSize: '0.85rem', color: '#0f766e',
                border: '1px solid #ccfbf1', display: 'flex', gap: '16px'
              }}>
                <span>📅 يوم الدورة: <strong>{dayLabel}</strong></span>
                <span>🍽️ وجبات المنيو: <strong>{menuMeals.length}</strong></span>
                <span>✅ محدد: <strong>{totalSelected}</strong></span>
              </div>
            )}
          </div>
        </div>

        {selectedClient && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* LEFT: قائمة المنيو اليومي */}
            <div className="card">
              <div className="card-header">
                <h3>📋 المنيو اليومي</h3>
                <input
                  className="form-control"
                  style={{ width: '180px' }}
                  placeholder="🔍 بحث..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div style={{ padding: '12px', maxHeight: '500px', overflowY: 'auto' }}>
                {loading ? (
                  <div className="loading"><div className="spinner" /> جاري التحميل...</div>
                ) : menuMeals.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📋</div>
                    <h3>لا يوجد منيو لهذا اليوم</h3>
                    <p>اذهب لإعدادات المنيو وأضف وجبات لهذا اليوم</p>
                  </div>
                ) : (
                  ['افطار','غداء','عشاء','سناك'].map(type => {
                    const typeMeals = filteredMenuMeals.filter(m => m.mealType === type);
                    if (typeMeals.length === 0) return null;
                    return (
                      <div key={type} style={{ marginBottom: '12px' }}>
                        <div style={{
                          fontSize: '0.78rem', fontWeight: 700, color: '#64748b',
                          borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '6px'
                        }}>
                          {MEAL_ICONS[type]} {type}
                        </div>
                        {typeMeals.map(meal => (
                          <label
                            key={meal.id}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '8px 10px', borderRadius: '8px', cursor: 'pointer',
                              background: isSelected(meal) ? '#f0fdfa' : 'transparent',
                              border: isSelected(meal) ? '1px solid #ccfbf1' : '1px solid transparent',
                              marginBottom: '3px', transition: 'all 0.15s',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected(meal)}
                              onChange={() => toggleClientMeal(meal)}
                              style={{ accentColor: '#0d9488', width: '16px', height: '16px' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{meal.mealTitle}</div>
                              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                P{meal.protein} | C{meal.carbs} | {meal.calories} cal
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT: ملخص اختيارات العميل */}
            <div className="card">
              <div className="card-header">
                <h3>✅ اختيارات {selectedClient.name}</h3>
                <span className="badge badge-teal">{totalSelected} وجبة</span>
              </div>
              <div style={{ padding: '12px', maxHeight: '500px', overflowY: 'auto' }}>
                {totalSelected === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">🍽️</div>
                    <h3>لم يتم اختيار وجبات بعد</h3>
                    <p>اختر من القائمة على اليسار</p>
                  </div>
                ) : (
                  ['افطار','غداء','عشاء','سناك'].map(type => {
                    const selected = clientMeals[type] || [];
                    if (selected.length === 0) return null;
                    return (
                      <div key={type} style={{ marginBottom: '14px' }}>
                        <div style={{
                          fontSize: '0.82rem', fontWeight: 700,
                          color: '#0f766e', marginBottom: '6px',
                          display: 'flex', alignItems: 'center', gap: '6px'
                        }}>
                          {MEAL_ICONS[type]} {type}
                          <span className="badge badge-teal">{selected.length}</span>
                        </div>
                        {selected.map(m => (
                          <div
                            key={m.id}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 12px', background: '#f0fdfa', borderRadius: '8px',
                              marginBottom: '4px', fontSize: '0.88rem', fontWeight: 600,
                              border: '1px solid #ccfbf1',
                            }}
                          >
                            <span>{m.title}</span>
                            <button
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '0.8rem' }}
                              onClick={() => {
                                const meal = MEALS_DATA.find(x => x.id === m.id);
                                if (meal) toggleClientMeal(meal);
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    );
                  })
                )}

                {totalSelected > 0 && (
                  <button className="btn btn-primary btn-full" onClick={saveSelections} disabled={saving}>
                    {saving ? '⏳ جاري الحفظ...' : `✅ حفظ اختيارات ${selectedDate}`}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
