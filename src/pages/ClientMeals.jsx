import { useState, useEffect, useRef } from 'react';
import { getClients } from '../firebase/clientService';
import { getAllSubscriptions, getSubscriptionStatus } from '../firebase/subscriptionService';
import {
  MEALS_DATA, CYCLE_DAYS,
  getMenuDay, saveClientDailyMeals, getClientDailyMeals
} from '../firebase/mealService';
import * as XLSX from 'xlsx';

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
  const [importing, setImporting] = useState(false);
  const [activeTab, setActiveTab] = useState('daily'); // daily | excel
  const xlsxRef = useRef();

  // ── توليد Sample Excel للعميل ──
  const generateSampleExcel = async () => {
    if (!selectedClient) return;
    const sub = selectedClient.activeSub;
    if (!sub?.startDate) return;

    const wb = XLSX.utils.book_new();
    const DAYS_AR = ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
    const SECTIONS = ['افطار','غداء','عشاء','سناك'];
    const SEC_LABEL = { افطار:'🍳 فطار', غداء:'🍛 غداء', عشاء:'🌙 عشاء', سناك:'🥗 سناك' };

    for (let week = 1; week <= 4; week++) {
      const rows = [];

      // Header الملف
      rows.push([`اختيارات وجبات الأسبوع ${week} — ${selectedClient.name} (${selectedClient.clientCode})`]);
      rows.push([`الباقة: ${sub.packageName} | بروتين: ${sub.protein}g | كارب: ${sub.carbs}g`]);
      rows.push([]); // فراغ
      rows.push(['التاريخ', 'اليوم', 'القسم', 'الوجبة المتاحة', 'اختيارك ✓']);

      for (let d = 0; d < 7; d++) {
        const dayName = DAYS_AR[d];
        const dayKey  = `w${week}_${dayName}`;
        const menu    = await getMenuDay('default', dayKey);
        const mealIds = menu?.meals || [];
        const meals   = mealIds.map(id => MEALS_DATA.find(m => m.id === id)).filter(Boolean);

        // حساب التاريخ الفعلي
        const startD = new Date(sub.startDate);
        const offset = (week - 1) * 7 + d;
        const date   = new Date(startD);
        date.setDate(startD.getDate() + offset);
        const dateStr = date.toISOString().split('T')[0];

        // فراغ بين الأيام
        rows.push([]);
        rows.push([dateStr, dayName, '', '', '']);

        let firstRow = true;
        for (const sec of SECTIONS) {
          const secMeals = meals.filter(m => m.mealType === sec);
          if (secMeals.length === 0) continue;

          for (let mi = 0; mi < secMeals.length; mi++) {
            const meal = secMeals[mi];
            rows.push([
              firstRow && mi === 0 ? dateStr : '',  // التاريخ — بس في أول صف
              firstRow && mi === 0 ? dayName  : '',  // اليوم
              mi === 0 ? SEC_LABEL[sec] : '',         // القسم — بس في أول صف من القسم
              meal.mealTitle,                          // اسم الوجبة
              '',                                      // خلية الاختيار — العميل يكتب ✓
            ]);
            firstRow = false;
          }
        }

        if (meals.length === 0) {
          rows.push(['', '', '—', 'لا يوجد منيو لهذا اليوم', '']);
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch:14 }, { wch:12 }, { wch:12 }, { wch:35 }, { wch:12 }];

      // تلوين header
      if (!ws['!rows']) ws['!rows'] = [];

      XLSX.utils.book_append_sheet(wb, ws, `أسبوع ${week}`);
    }

    // sheet بيانات العميل
    const infoRows = [
      ['بيانات العميل', ''],
      ['الاسم', selectedClient.name],
      ['الكود', selectedClient.clientCode],
      ['الباقة', sub.packageName],
      ['البروتين', `${sub.protein}g`],
      ['الكارب', `${sub.carbs}g`],
      ['بداية الاشتراك', sub.startDate],
      ['نهاية الاشتراك', sub.endDate],
      ['الموانع الغذائية', selectedClient.allergy || '—'],
      [],
      ['تعليمات:', ''],
      ['1', 'اكتب ✓ أو X في خانة "اختيارك" بجانب الوجبة اللي تريدها'],
      ['2', 'يمكنك اختيار أكثر من وجبة في نفس القسم'],
      ['3', 'أرسل الملف بعد اكتماله'],
    ];
    const infoSheet = XLSX.utils.aoa_to_sheet(infoRows);
    infoSheet['!cols'] = [{ wch:25 }, { wch:35 }];
    XLSX.utils.book_append_sheet(wb, infoSheet, 'بيانات العميل');

    XLSX.writeFile(wb, `menu_${selectedClient.clientCode}_${sub.startDate}.xlsx`);
    setMsg('✅ تم تنزيل ملف Excel');
    setTimeout(() => setMsg(''), 2500);
  };

  // ── قراءة Excel المرفوع وحفظ الاختيارات ──
  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedClient) return;
    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb   = XLSX.read(ev.target.result, { type: 'array' });
        let saved  = 0;
        let errors = 0;

        for (const sheetName of wb.SheetNames) {
          if (sheetName === 'بيانات العميل') continue;
          const ws   = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

          // تجميع الاختيارات حسب التاريخ
          const dayMap = {}; // { dateStr: { افطار:[], غداء:[], عشاء:[], سناك:[] } }
          let currentDate = '';
          let currentSec  = '';
          const SEC_MAP = {
            '🍳 فطار':'افطار', 'فطار':'افطار',
            '🍛 غداء':'غداء',  'غداء':'غداء',
            '🌙 عشاء':'عشاء',  'عشاء':'عشاء',
            '🥗 سناك':'سناك',  'سناك':'سناك',
          };

          for (const row of rows) {
            const col0 = row[0]?.toString().trim(); // التاريخ
            const col2 = row[2]?.toString().trim(); // القسم
            const col3 = row[3]?.toString().trim(); // اسم الوجبة
            const col4 = row[4]?.toString().trim(); // الاختيار

            // تحديث التاريخ الحالي
            if (col0 && /^\d{4}-\d{2}-\d{2}$/.test(col0)) {
              currentDate = col0;
              if (!dayMap[currentDate]) {
                dayMap[currentDate] = { افطار:[], غداء:[], عشاء:[], سناك:[] };
              }
            }

            // تحديث القسم الحالي
            if (col2 && SEC_MAP[col2]) {
              currentSec = SEC_MAP[col2];
            }

            // لو العميل اختار الوجبة
            if (col3 && col4 && ['✓','x','X','نعم','yes','1','صح'].includes(col4.toLowerCase())) {
              if (!currentDate || !currentSec) continue;
              // ابحث عن الوجبة بالاسم بالضبط
              const meal = MEALS_DATA.find(m =>
                m.mealTitle === col3 || m.mealTitleEn === col3
              );
              if (meal) {
                dayMap[currentDate][currentSec].push({ id: meal.id, title: meal.mealTitle });
              } else {
                errors++;
              }
            }
          }

          // حفظ كل يوم في Firestore
          for (const [dateStr, meals] of Object.entries(dayMap)) {
            const hasAny = Object.values(meals).some(a => a.length > 0);
            if (hasAny) {
              await saveClientDailyMeals(selectedClient.id, dateStr, meals);
              saved++;
            }
          }
        }

        let msg = `✅ تم استيراد اختيارات ${saved} يوم بنجاح!`;
        if (errors > 0) msg += ` (${errors} وجبة غير معروفة تم تجاهلها)`;
        setMsg(msg);
        setTimeout(() => setMsg(''), 4000);
      } catch (err) {
        setMsg(`❌ خطأ في قراءة الملف: ${err.message}`);
        setTimeout(() => setMsg(''), 4000);
      }
      setImporting(false);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

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
    const sub  = selectedClient?.activeSub;
    setClientMeals(p => {
      const current = p[type] || [];
      const exists  = current.find(m => m.id === meal.id);
      // removing — always allowed
      if (exists) return { ...p, [type]: current.filter(m => m.id !== meal.id) };
      // adding — check constraints
      if (sub) {
        const allowMap = { افطار:'allowBreakfast', غداء:'allowLunch', عشاء:'allowDinner', سناك:'allowSnacks' };
        if (sub[allowMap[type]] === false) return p; // نوع غير مسموح
        const perTypeMax = { افطار: sub.allowedBreakfast, غداء: sub.allowedLunch, عشاء: sub.allowedDinner, سناك: sub.snacksNumber };
        if (perTypeMax[type] != null && current.length >= perTypeMax[type]) return p; // تجاوز حد النوع
        if (type !== 'سناك') {
          const totalMeals = (p['افطار']?.length||0) + (p['غداء']?.length||0) + (p['عشاء']?.length||0);
          if (sub.mealsNumber && totalMeals >= sub.mealsNumber) return p; // تجاوز إجمالي الوجبات
        }
      }
      return { ...p, [type]: [...current, { id: meal.id, title: meal.mealTitle }] };
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

  // ── تقرير اختيارات الوجبات Excel ──
  const generateMealsReportExcel = async () => {
    if (!selectedClient) return;
    const sub = selectedClient.activeSub;
    if (!sub?.startDate) return;

    const wb   = XLSX.utils.book_new();
    const DAYS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    const aoa  = [
      [`تقرير اختيارات وجبات العميل: ${selectedClient.name} — ${selectedClient.clientCode}`],
      [`الباقة: ${sub.packageName} | من: ${sub.startDate} إلى: ${sub.endDate}`],
      [],
      ['التاريخ','اليوم','الفطور','الغداء','العشاء','السناك','المجموع'],
    ];

    const start = new Date(sub.startDate);
    const end   = new Date(sub.endDate);
    let totalDays = 0, frozenDays = 0, deliveryDays = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr  = d.toISOString().split('T')[0];
      const dayName  = DAYS[d.getDay()];
      const isFrozen = (sub.frozenDays || []).includes(dateStr);
      totalDays++;

      if (isFrozen) {
        frozenDays++;
        aoa.push([dateStr, dayName, '❄ مجمد', '', '', '', 0]);
        continue;
      }
      deliveryDays++;
      const meals    = await getClientDailyMeals(selectedClient.id, dateStr);
      const breakfast = (meals?.افطار || []).map(m => m.title).join(' / ') || '—';
      const lunch     = (meals?.غداء  || []).map(m => m.title).join(' / ') || '—';
      const dinner    = (meals?.عشاء  || []).map(m => m.title).join(' / ') || '—';
      const snacks    = (meals?.سناك  || []).map(m => m.title).join(' / ') || '—';
      const total     = (meals?.افطار?.length||0)+(meals?.غداء?.length||0)+(meals?.عشاء?.length||0)+(meals?.سناك?.length||0);
      aoa.push([dateStr, dayName, breakfast, lunch, dinner, snacks, total]);
    }
    aoa.push([]);
    aoa.push(['📊 ملخص']);
    aoa.push(['إجمالي الأيام', totalDays]);
    aoa.push(['أيام التجميد', frozenDays]);
    aoa.push(['أيام التوصيل', deliveryDays]);
    if (sub.bonusDays > 0) aoa.push(['أيام التعويض 🎁', sub.bonusDays]);
    if (sub.couponCode) aoa.push(['كوبون الخصم', `${sub.couponCode} — خصم ${Number(sub.discountAmount||0).toFixed(3)} KWD`]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{wch:14},{wch:12},{wch:30},{wch:30},{wch:30},{wch:20},{wch:8}];
    XLSX.utils.book_append_sheet(wb, ws, 'تقرير الوجبات');
    XLSX.writeFile(wb, `report_${selectedClient.clientCode}_${sub.startDate}.xlsx`);
    setMsg('✅ تم تنزيل تقرير Excel');
    setTimeout(() => setMsg(''), 2500);
  };

  // ── تقرير PDF ──
  const generateMealsReportPDF = async () => {
    if (!selectedClient) return;
    const sub = selectedClient.activeSub;
    if (!sub?.startDate) return;

    const DAYS = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
    const start = new Date(sub.startDate);
    const end   = new Date(sub.endDate);
    let rows = '', totalDays=0, frozenDays=0, deliveryDays=0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr  = d.toISOString().split('T')[0];
      const dayName  = DAYS[d.getDay()];
      const isFrozen = (sub.frozenDays || []).includes(dateStr);
      const i        = totalDays;
      totalDays++;

      if (isFrozen) {
        frozenDays++;
        rows += `<tr style="background:#fef3c7"><td>${dateStr}</td><td>${dayName}</td><td colspan="4" style="text-align:center;color:#d97706;font-weight:700">❄ يوم مجمد</td><td style="text-align:center">0</td></tr>`;
        continue;
      }
      deliveryDays++;
      const meals    = await getClientDailyMeals(selectedClient.id, dateStr);
      const breakfast = (meals?.افطار||[]).map(m=>m.title).join('، ') || '—';
      const lunch     = (meals?.غداء ||[]).map(m=>m.title).join('، ') || '—';
      const dinner    = (meals?.عشاء ||[]).map(m=>m.title).join('، ') || '—';
      const snacks    = (meals?.سناك ||[]).map(m=>m.title).join('، ') || '—';
      const total     = (meals?.افطار?.length||0)+(meals?.غداء?.length||0)+(meals?.عشاء?.length||0)+(meals?.سناك?.length||0);
      rows += `<tr style="background:${i%2===0?'#fff':'#f8fafc'}"><td>${dateStr}</td><td>${dayName}</td><td>${breakfast}</td><td>${lunch}</td><td>${dinner}</td><td>${snacks}</td><td style="text-align:center;font-weight:700">${total}</td></tr>`;
    }

    const html = `<!DOCTYPE html><html dir="rtl" lang="ar">
    <head><meta charset="UTF-8">
    <style>
      body{font-family:'Cairo',Arial,sans-serif;margin:20px;color:#1e293b;font-size:12px}
      h1{color:#0d9488;font-size:16px;margin:0 0 4px}
      .info{color:#64748b;font-size:11px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:10px}
      th{background:#0d9488;color:#fff;padding:7px 8px;text-align:right;border:1px solid #0a7a6e}
      td{padding:5px 8px;border:1px solid #e2e8f0;vertical-align:top}
      .summary{margin-top:16px;padding:10px;background:#f0fdfa;border-radius:6px;border:1px solid #ccfbf1;font-size:11px}
      .summary b{color:#0d9488;margin-left:16px}
      @page{size:A4;margin:10mm}
    </style></head>
    <body>
      <h1>🥗 تقرير اختيارات وجبات العميل</h1>
      <div class="info">
        العميل: <strong>${selectedClient.name}</strong> — الكود: <strong>${selectedClient.clientCode}</strong><br/>
        الباقة: <strong>${sub.packageName}</strong> | بروتين: ${sub.protein}g | كارب: ${sub.carbs}g<br/>
        من: <strong>${sub.startDate}</strong> إلى: <strong>${sub.endDate}</strong>
        ${sub.couponCode ? `<br/>كوبون: <strong>${sub.couponCode}</strong> — خصم: <strong>${Number(sub.discountAmount||0).toFixed(3)} KWD</strong>` : ''}
      </div>
      <table>
        <thead><tr>
          <th>التاريخ</th><th>اليوم</th><th>الفطور</th><th>الغداء</th><th>العشاء</th><th>السناك</th><th>المجموع</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="summary">
        <b>إجمالي الأيام: ${totalDays}</b>
        <b>أيام التجميد: ${frozenDays}</b>
        <b>أيام التوصيل: ${deliveryDays}</b>
        ${sub.bonusDays > 0 ? `<b>🎁 أيام التعويض: ${sub.bonusDays}</b>` : ''}
      </div>
    </body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
  };

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
          <div className="breadcrumb">الأدمن يختار وجبات العميل اليومية أو يستورد من Excel</div>
        </div>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          {selectedClient && (
            <>
              <button className="btn btn-outline" onClick={generateSampleExcel}>
                📥 Sample Excel
              </button>
              <input ref={xlsxRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={handleExcelUpload} />
              <button className="btn btn-ghost" onClick={() => xlsxRef.current.click()} disabled={importing}>
                {importing ? '⏳ جاري الاستيراد...' : '📤 رفع اختيارات Excel'}
              </button>
              <button className="btn btn-outline" onClick={generateMealsReportExcel} title="تقرير Excel">
                📊 تقرير Excel
              </button>
              <button className="btn btn-outline" onClick={generateMealsReportPDF} title="تقرير PDF">
                🖨️ تقرير PDF
              </button>
            </>
          )}
          {totalSelected > 0 && activeTab === 'daily' && (
            <button className="btn btn-primary" onClick={saveSelections} disabled={saving}>
              {saving ? '⏳ جاري الحفظ...' : `✅ حفظ الاختيارات (${totalSelected})`}
            </button>
          )}
        </div>
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
                border: '1px solid #ccfbf1', display: 'flex', gap: '16px', flexWrap: 'wrap'
              }}>
                <span>📅 يوم الدورة: <strong>{dayLabel}</strong></span>
                <span>🍽️ وجبات المنيو: <strong>{menuMeals.length}</strong></span>
                {(() => {
                  const sub = selectedClient?.activeSub;
                  const mealTotal = (clientMeals['افطار']?.length||0)+(clientMeals['غداء']?.length||0)+(clientMeals['عشاء']?.length||0);
                  const snackTotal = clientMeals['سناك']?.length||0;
                  const mealsLimit = sub?.mealsNumber;
                  const snacksLimit = sub?.snacksNumber;
                  return (
                    <>
                      <span style={{ color: mealsLimit && mealTotal >= mealsLimit ? '#ef4444' : '#0f766e' }}>
                        🍛 وجبات: <strong>{mealTotal}{mealsLimit ? ` / ${mealsLimit}` : ''}</strong>
                      </span>
                      {snacksLimit > 0 && (
                        <span style={{ color: snacksLimit && snackTotal >= snacksLimit ? '#ef4444' : '#0f766e' }}>
                          🥗 سناك: <strong>{snackTotal}{snacksLimit ? ` / ${snacksLimit}` : ''}</strong>
                        </span>
                      )}
                    </>
                  );
                })()}
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
                    const sub = selectedClient?.activeSub;
                    const typeMeals = filteredMenuMeals.filter(m => m.mealType === type);
                    if (typeMeals.length === 0) return null;
                    const perTypeMax = { افطار: sub?.allowedBreakfast, غداء: sub?.allowedLunch, عشاء: sub?.allowedDinner, سناك: sub?.snacksNumber };
                    const typeCount  = clientMeals[type]?.length || 0;
                    const mealTotal  = (clientMeals['افطار']?.length||0)+(clientMeals['غداء']?.length||0)+(clientMeals['عشاء']?.length||0);
                    const totalFull  = type !== 'سناك' && sub?.mealsNumber && mealTotal >= sub.mealsNumber;
                    const typeFull   = perTypeMax[type] != null && typeCount >= perTypeMax[type];
                    return (
                      <div key={type} style={{ marginBottom: '12px' }}>
                        <div style={{
                          fontSize: '0.78rem', fontWeight: 700, color: '#64748b',
                          borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '6px',
                          display: 'flex', justifyContent: 'space-between'
                        }}>
                          <span>{MEAL_ICONS[type]} {type}</span>
                          {perTypeMax[type] != null && (
                            <span style={{ color: typeFull ? '#ef4444' : '#0d9488' }}>
                              {typeCount} / {perTypeMax[type]}
                            </span>
                          )}
                        </div>
                        {typeMeals.map(meal => {
                          const sel     = isSelected(meal);
                          const blocked = !sel && (typeFull || (type !== 'سناك' && totalFull));
                          return (
                            <label
                              key={meal.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '8px 10px', borderRadius: '8px',
                                cursor: blocked ? 'not-allowed' : 'pointer',
                                background: sel ? '#f0fdfa' : 'transparent',
                                border: sel ? '1px solid #ccfbf1' : '1px solid transparent',
                                marginBottom: '3px', transition: 'all 0.15s',
                                opacity: blocked ? 0.4 : 1,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={sel}
                                onChange={() => toggleClientMeal(meal)}
                                disabled={blocked}
                                style={{ accentColor: '#0d9488', width: '16px', height: '16px', cursor: blocked ? 'not-allowed' : 'pointer' }}
                              />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{meal.mealTitle}</div>
                                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                                  P{meal.protein} | C{meal.carbs} | {meal.calories} cal
                                </div>
                              </div>
                            </label>
                          );
                        })}
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
