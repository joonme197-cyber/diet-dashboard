import { useState, useEffect } from 'react';
import {
  MEALS_DATA, CYCLE_DAYS,
  saveMenuDay, getFullMenu,
  uploadMealsToFirebase
} from '../firebase/mealService';

const MENU_TYPES = [
  { key: 'default', label: '📋 Default Menu', color: '#0d9488', desc: 'المنيو الذي يختار منه العميل' },
  { key: 'chef',    label: '👨‍🍳 Chef Menu',   color: '#7c3aed', desc: 'المنيو الاحتياطي (Auto-Selection)' },
];

const MEAL_TYPES = ['افطار','غداء','عشاء','سناك'];
const MEAL_ICONS = { افطار: '🍳', غداء: '🍛', عشاء: '🌙', سناك: '🥗' };

export default function MenuSettings() {
  const [activeMenu, setActiveMenu] = useState('default');
  const [selectedDay, setSelectedDay] = useState(CYCLE_DAYS[0].key);
  const [menuData, setMenuData] = useState({});
  const [selectedMeals, setSelectedMeals] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('الكل');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState('');
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadMenu();
  }, [activeMenu]);

  const loadMenu = async () => {
    const data = await getFullMenu(activeMenu);
    setMenuData(data);
  };

  const openDay = (dayKey) => {
    setSelectedDay(dayKey);
    setSelectedMeals(menuData[dayKey] || []);
    setSearch('');
    setFilterType('الكل');
    setShowModal(true);
  };

  const toggleMeal = (mealId) => {
    setSelectedMeals(p =>
      p.includes(mealId) ? p.filter(x => x !== mealId) : [...p, mealId]
    );
  };

  const saveDay = async () => {
    setSaving(true);
    await saveMenuDay(activeMenu, selectedDay, selectedMeals);
    setMenuData(p => ({ ...p, [selectedDay]: selectedMeals }));
    setSaving(false);
    setMsg('✅ تم الحفظ بنجاح!');
    setTimeout(() => { setMsg(''); setShowModal(false); }, 1500);
  };

  const handleUploadMeals = async () => {
    setUploading(true);
    const count = await uploadMealsToFirebase();
    setUploading(false);
    setMsg(`✅ تم رفع ${count} وجبة لـ Firebase!`);
    setTimeout(() => setMsg(''), 3000);
  };

  const filteredMeals = MEALS_DATA.filter(m => {
    const matchSearch = m.mealTitle.includes(search) || m.mealTitleEn.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'الكل' || m.mealType === filterType;
    return matchSearch && matchType;
  });

  const selectedDayLabel = CYCLE_DAYS.find(d => d.key === selectedDay)?.label || '';

  // إحصائيات اليوم المحدد
  const dayMeals = menuData[selectedDay] || [];
  const getMealById = (id) => MEALS_DATA.find(m => m.id === id);

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <h2>📋 إعدادات المنيو</h2>
          <div className="breadcrumb">دورة 4 أسابيع — 28 يوم</div>
        </div>
        <button
          className="btn btn-outline"
          onClick={handleUploadMeals}
          disabled={uploading}
          style={{ fontSize: '0.85rem' }}
        >
          {uploading ? '⏳ جاري الرفع...' : '☁️ رفع الوجبات لـ Firebase'}
        </button>
      </div>

      {msg && (
        <div style={{ margin: '0 32px', marginTop: '12px' }}>
          <div className="alert alert-success">{msg}</div>
        </div>
      )}

      <div className="page-body">

        {/* Menu type tabs */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          {MENU_TYPES.map(m => (
            <button
              key={m.key}
              onClick={() => setActiveMenu(m.key)}
              style={{
                padding: '12px 24px', borderRadius: '10px', border: 'none',
                cursor: 'pointer', fontFamily: 'var(--font-main)', fontWeight: 700,
                fontSize: '0.95rem', transition: 'all 0.2s',
                background: activeMenu === m.key ? m.color : 'white',
                color: activeMenu === m.key ? 'white' : '#64748b',
                boxShadow: activeMenu === m.key ? `0 4px 12px ${m.color}40` : '0 1px 3px rgba(0,0,0,0.08)',
                border: activeMenu === m.key ? 'none' : '1.5px solid #e2e8f0',
              }}
            >
              {m.label}
              <div style={{ fontSize: '0.72rem', fontWeight: 400, opacity: 0.85, marginTop: '2px' }}>
                {m.desc}
              </div>
            </button>
          ))}
        </div>

        {/* 28 days grid */}
        <div className="card">
          <div className="card-header">
            <h3>📅 الأيام (28 يوم - دورة 4 أسابيع)</h3>
            <span className="badge badge-teal">
              {Object.keys(menuData).length} / 28 يوم مُعَد
            </span>
          </div>
          <div className="card-body">
            {[1, 2, 3, 4].map(week => (
              <div key={week} style={{ marginBottom: '16px' }}>
                <div style={{
                  fontSize: '0.8rem', fontWeight: 700, color: '#64748b',
                  marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px'
                }}>
                  الأسبوع {week}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {CYCLE_DAYS.filter(d => d.week === week).map(day => {
                    const hasMeals = menuData[day.key]?.length > 0;
                    return (
                      <button
                        key={day.key}
                        onClick={() => openDay(day.key)}
                        style={{
                          padding: '8px 14px', borderRadius: '8px', border: 'none',
                          cursor: 'pointer', fontFamily: 'var(--font-main)',
                          fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.2s',
                          background: hasMeals ? (activeMenu === 'default' ? '#f0fdfa' : '#f5f3ff') : '#f8fafc',
                          color: hasMeals ? (activeMenu === 'default' ? '#0f766e' : '#7c3aed') : '#94a3b8',
                          border: hasMeals
                            ? `1.5px solid ${activeMenu === 'default' ? '#ccfbf1' : '#ede9fe'}`
                            : '1.5px solid #e2e8f0',
                        }}
                      >
                        {day.day}
                        {hasMeals && (
                          <span style={{
                            display: 'inline-block', marginRight: '6px',
                            background: activeMenu === 'default' ? '#0d9488' : '#7c3aed',
                            color: 'white', borderRadius: '999px',
                            fontSize: '0.65rem', padding: '1px 6px', fontWeight: 700
                          }}>
                            {menuData[day.key].length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overview table */}
        {Object.keys(menuData).length > 0 && (
          <div className="card" style={{ marginTop: '20px' }}>
            <div className="card-header">
              <h3>📊 نظرة عامة على المنيو</h3>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>اليوم</th>
                    <th>🍳 فطور</th>
                    <th>🍛 غداء</th>
                    <th>🌙 عشاء</th>
                    <th>🥗 سناك</th>
                    <th>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {CYCLE_DAYS.filter(d => menuData[d.key]?.length > 0).map(day => {
                    const ids = menuData[day.key] || [];
                    const meals = ids.map(id => getMealById(id)).filter(Boolean);
                    const byType = (t) => meals.filter(m => m.mealType === t).map(m => m.mealTitle).join('، ');
                    return (
                      <tr key={day.key}>
                        <td>
                          <strong>{day.label}</strong>
                        </td>
                        <td style={{ fontSize: '0.78rem', maxWidth: '150px' }}>{byType('افطار') || '—'}</td>
                        <td style={{ fontSize: '0.78rem', maxWidth: '150px' }}>{byType('غداء') || '—'}</td>
                        <td style={{ fontSize: '0.78rem', maxWidth: '150px' }}>{byType('عشاء') || '—'}</td>
                        <td style={{ fontSize: '0.78rem', maxWidth: '150px' }}>{byType('سناك') || '—'}</td>
                        <td>
                          <span className="badge badge-teal">{ids.length}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal: اختيار وجبات اليوم */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {activeMenu === 'default' ? '📋' : '👨‍🍳'} تعديل منيو: {selectedDayLabel}
              </h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">

              {/* Search + filter */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }}>
                <input
                  className="form-control"
                  placeholder="🔍 بحث عن وجبة..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1 }}
                />
                <select
                  className="form-control"
                  style={{ width: '130px' }}
                  value={filterType}
                  onChange={e => setFilterType(e.target.value)}
                >
                  <option>الكل</option>
                  {MEAL_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>

              {/* Selected count */}
              <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  محدد: <strong style={{ color: '#0d9488' }}>{selectedMeals.length}</strong> وجبة
                </span>
                <button
                  style={{ fontSize: '0.8rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
                  onClick={() => setSelectedMeals([])}
                >
                  مسح الكل
                </button>
              </div>

              {/* Meals list grouped by type */}
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {MEAL_TYPES.map(type => {
                  const typeMeals = filteredMeals.filter(m => m.mealType === type);
                  if (typeMeals.length === 0) return null;
                  return (
                    <div key={type} style={{ marginBottom: '12px' }}>
                      <div style={{
                        fontSize: '0.78rem', fontWeight: 700, color: '#64748b',
                        padding: '4px 0', borderBottom: '1px solid #e2e8f0', marginBottom: '6px'
                      }}>
                        {MEAL_ICONS[type]} {type} ({typeMeals.filter(m => selectedMeals.includes(m.id)).length} محدد)
                      </div>
                      {typeMeals.map(meal => (
                        <label
                          key={meal.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '7px 10px', borderRadius: '8px', cursor: 'pointer',
                            background: selectedMeals.includes(meal.id) ? '#f0fdfa' : 'transparent',
                            border: selectedMeals.includes(meal.id) ? '1px solid #ccfbf1' : '1px solid transparent',
                            marginBottom: '3px', transition: 'all 0.15s',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedMeals.includes(meal.id)}
                            onChange={() => toggleMeal(meal.id)}
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
                })}
              </div>

              {/* Save button */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveDay} disabled={saving}>
                  {saving ? '⏳ جاري الحفظ...' : `✅ حفظ (${selectedMeals.length} وجبة)`}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowModal(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
