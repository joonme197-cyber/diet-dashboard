import { useState, useEffect } from 'react';
import { db } from '../firebase/config';
import { collection, getDocs } from 'firebase/firestore';
import { MEALS_DATA } from '../firebase/mealService';
import { getClients } from '../firebase/clientService';
import { getAllSubscriptions, getSubscriptionStatus } from '../firebase/subscriptionService';
import { useLang } from '../LanguageContext';

// ─────────────────────────────────────────────
// ثوابت
// ─────────────────────────────────────────────
const GRAM_SIZES = [80, 90, 100, 120, 150, 180, 200];

const MEAL_SECTIONS = [
  { key: 'افطار', labelAr: 'الفطور',  labelEn: 'Breakfast' },
  { key: 'غداء',  labelAr: 'الغداء',  labelEn: 'Lunch'      },
  { key: 'عشاء',  labelAr: 'العشاء',  labelEn: 'Dinner'     },
  { key: 'سناك',  labelAr: 'السناك',  labelEn: 'Snacks'     },
];

const fmtDate = (d) => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

// ─────────────────────────────────────────────
// MealLabels
// ─────────────────────────────────────────────
export default function MealLabels() {
  const { isAr } = useLang();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const SHELF_LIFE = 3; // ثابت — كل الوجبات 3 أيام
  const [labels, setLabels]             = useState([]); // قائمة الملصقات المرتبة
  const [loading, setLoading]           = useState(false);
  const [fetched, setFetched]           = useState(false);
  const [previewCount, setPreviewCount] = useState(0);

  const L = {
    title:      isAr ? 'ملصقات الوجبات'        : 'Meal Labels',
    subtitle:   isAr ? 'مرتبة حسب تقرير التصنيع' : 'Sorted by manufacturing batch',
    dateLabel:  isAr ? 'تاريخ الإنتاج'          : 'Production Date',

    generate:   isAr ? '🏷️ إنشاء الملصقات'      : '🏷️ Generate Labels',
    generating: isAr ? 'جاري الإنشاء...'         : 'Generating...',
    print:      isAr ? '🖨️ طباعة الملصقات'       : '🖨️ Print Labels',
    totalLabels:isAr ? 'ملصق إجمالي'             : 'total labels',
    validFor:   isAr ? 'صالح لمدة'               : 'valid for',
    days:       isAr ? 'أيام'                    : 'days',
    noData:     isAr ? 'اختر التاريخ وأنشئ الملصقات' : 'Select a date and generate labels',
  };

  // ── بناء الملصقات مرتبة حسب تقرير التصنيع ──
  const buildLabels = async () => {
    setLoading(true);
    setFetched(false);

    const [clientsList, allSubs, snapshot] = await Promise.all([
      getClients(),
      getAllSubscriptions(),
      getDocs(collection(db, 'clientDailyMeals')),
    ]);

    const dayDocs = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(d => d.date === selectedDate);

    // clientId → { proteinWeight, carbsWeight, gramSize }
    // فقط العملاء اللي عندهم اشتراك نشط
    const clientWeightMap = {};
    for (const client of clientsList) {
      const activeSub = allSubs.find(
        s => s.clientId === client.id && getSubscriptionStatus(s) === 'active'
      );
      if (!activeSub) continue; // تجاهل العملاء بدون اشتراك نشط
      // تجاهل العملاء اللي اليوم مجمّد في اشتراكهم
      if ((activeSub.frozenDays || []).includes(selectedDate)) continue;
      const proteinWeight = Number(activeSub?.protein || client.protein || 100);
      const carbsWeight   = Number(activeSub?.carbs   || client.carbs   || 100);
      // gramSize للتجميع في تقرير التصنيع = protein weight
      const gramSize = GRAM_SIZES.reduce((prev, curr) =>
        Math.abs(curr - proteinWeight) < Math.abs(prev - proteinWeight) ? curr : prev
      );
      clientWeightMap[client.id] = { proteinWeight, carbsWeight, gramSize };
    }

    // تجميع: mealId → { meal info, grams: {80: count, ...} }
    // مرتب حسب: section → mealId → gramSize (نفس ترتيب تقرير التصنيع)
    const activeClientIds = new Set(Object.keys(clientWeightMap));
    const mealAgg = {};

    for (const dayDoc of dayDocs) {
      if (!activeClientIds.has(dayDoc.clientId)) continue; // تجاهل غير النشطين
      const weights  = clientWeightMap[dayDoc.clientId] || { proteinWeight: 100, carbsWeight: 100, gramSize: 100 };
      const gramSize = weights.gramSize;
      for (const sec of MEAL_SECTIONS) {
        const mealList = dayDoc.meals?.[sec.key] || [];
        for (const entry of mealList) {
          const master  = MEALS_DATA.find(m => m.id === entry.id);
          const key     = `${sec.key}__${entry.id}`;
          if (!mealAgg[key]) {
            mealAgg[key] = {
              id:         entry.id,
              sectionKey: sec.key,
              titleAr:    master?.mealTitle    || entry.title || entry.id,
              titleEn:    master?.mealTitleEn  || entry.title || entry.id,
              protein:    master?.protein      || 0,
              carbs:      master?.carbs        || 0,
              fats:       master?.fats         || 0,
              calories:   master?.calories     || 0,
              grams:      Object.fromEntries(GRAM_SIZES.map(g => [g, 0])),
            };
          }
          // حفظ أوزان الوجبة (قد تختلف بين عملاء — نأخذ الأول أو نبني array)
          if (!mealAgg[key].weightEntries) mealAgg[key].weightEntries = [];
          mealAgg[key].weightEntries.push({ gramSize, proteinWeight: weights.proteinWeight, carbsWeight: weights.carbsWeight });
          mealAgg[key].grams[gramSize] = (mealAgg[key].grams[gramSize] || 0) + 1;
        }
      }
    }

    // ── بناء قائمة الملصقات المرتبة ──
    // الترتيب: section → meal → gramSize تصاعدي → كرر بعدد النسخ
    const result = [];

    for (const sec of MEAL_SECTIONS) {
      const sectionMeals = Object.values(mealAgg).filter(m => m.sectionKey === sec.key);
      for (const meal of sectionMeals) {
        for (const g of GRAM_SIZES) {
          const count = meal.grams[g] || 0;
          if (count === 0) continue;
          for (let i = 0; i < count; i++) {
            result.push({
              ...meal,
              gramSize:     g,
              // وزن الوجبة الفعلي من اشتراك العميل
              proteinWeight: meal.weightEntries?.find(e => e.gramSize === g)?.proteinWeight || g,
              carbsWeight:   meal.weightEntries?.find(e => e.gramSize === g)?.carbsWeight   || g,
              copyIndex:    i + 1,
              totalCopies:  count,
              date:         selectedDate,
              shelfLife:    SHELF_LIFE,
              sectionKey2: sec.key, // للرجوع إليه وقت العرض
            });
          }
        }
      }
    }

    setLabels(result);
    setPreviewCount(result.length);
    setFetched(true);
    setLoading(false);
  };

  return (
    <div>
      {/* ── Header ── */}
      <div className="page-header no-print">
        <div>
          <h2>🏷️ {L.title}</h2>
          <div className="breadcrumb">{L.subtitle}</div>
        </div>
        {fetched && labels.length > 0 && (
          <button className="btn btn-primary" onClick={() => window.print()}>
            {L.print} ({labels.length})
          </button>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="page-body no-print">
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-body">
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1, maxWidth: '240px' }}>
                <label className="form-label">📅 {L.dateLabel}</label>
                <input type="date" className="form-control" value={selectedDate}
                  onChange={e => { setSelectedDate(e.target.value); setFetched(false); }} />
              </div>

              <button className="btn btn-primary" onClick={buildLabels}
                disabled={loading} style={{ padding: '10px 28px' }}>
                {loading
                  ? <><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />&nbsp;{L.generating}</>
                  : L.generate}
              </button>
            </div>

            {fetched && (
              <div style={{
                display: 'flex', gap: '20px', marginTop: '16px',
                padding: '12px 16px', background: '#f0fdfa',
                borderRadius: '8px', fontSize: '0.88rem'
              }}>
                <span style={{ color: '#0f766e', fontWeight: 700 }}>📅 {fmtDate(selectedDate)}</span>
                <span style={{ color: '#0d9488', fontWeight: 700 }}>🏷️ {labels.length} {L.totalLabels}</span>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>⏳ {SHELF_LIFE} {L.days}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Preview ── */}
        {fetched && labels.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h3>🏷️ {isAr ? 'معاينة الملصقات' : 'Labels Preview'}</h3>
              <span className="badge badge-teal">{labels.length} {L.totalLabels}</span>
            </div>
            <div className="card-body">
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '12px',
              }}>
                {labels.slice(0, 12).map((label, i) => (
                  <LabelCard key={i} label={label} isAr={isAr} />
                ))}
                {labels.length > 12 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '2px dashed #e2e8f0', borderRadius: '8px',
                    color: '#94a3b8', fontSize: '0.85rem', fontWeight: 600,
                    minHeight: '120px',
                  }}>
                    +{labels.length - 12} {isAr ? 'ملصق آخر' : 'more labels'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!fetched && !loading && (
          <div className="card">
            <div className="empty-state">
              <div className="empty-icon">🏷️</div>
              <h3>{L.noData}</h3>
              <p>{isAr ? 'الملصقات ستُرتَّب تلقائياً حسب الوجبة والجرام' : 'Labels will be auto-sorted by meal and gram size'}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Print Area ── */}
      {fetched && labels.length > 0 && (
        <div className="print-only" style={{ display: 'none' }}>
          <style>{`
            @media print {
              .print-only { display: block !important; }
              .no-print   { display: none  !important; }

              /* المقاس: عرض 40mm × ارتفاع 30mm — landscape يعني نكتب العرض أولاً */
              @page {
                size: 40mm 30mm;
                margin: 0;
              }

              html, body {
                width: 40mm;
                height: 30mm;
                margin: 0;
                padding: 0;
                background: white !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }

              /* كل ليبول يملأ الصفحة بالكامل */
              .label-card-print {
                width: 40mm;
                height: 30mm;
                box-sizing: border-box;
                padding: 2mm;
                page-break-after: always;
                break-after: page;
                overflow: hidden;
              }

              /* الإطار على wrapper داخلي عشان ما يتاكلش */
              .label-inner {
                width: 100%;
                height: 100%;
                box-sizing: border-box;
                border: 1pt solid #000;
                border-radius: 1mm;
                padding: 1mm 1.5mm;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                gap: 0.5pt;
                font-family: Cairo, Arial, sans-serif;
                text-align: center;
                overflow: hidden;
              }

              .label-card-print:last-child {
                page-break-after: avoid;
                break-after: avoid;
              }

              /* شيل أي margin أو padding من الـ wrapper */
              .labels-grid {
                margin: 0;
                padding: 0;
              }
            }
          `}</style>
          <div className="labels-grid">
            {labels.map((label, i) => (
              <PrintLabel key={i} label={label} isAr={isAr} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// LabelCard — معاينة الشاشة
// ─────────────────────────────────────────────
function LabelCard({ label, isAr }) {
  const name = isAr ? label.titleAr : label.titleEn;
  const secLabel = isAr
    ? MEAL_SECTIONS.find(s => s.key === label.sectionKey)?.labelAr
    : MEAL_SECTIONS.find(s => s.key === label.sectionKey)?.labelEn;
  return (
    <div style={{
      border: '2px solid #1e293b',
      borderRadius: '10px',
      padding: '12px 14px',
      textAlign: 'center',
      background: 'white',
      fontFamily: "'Cairo', Arial, sans-serif",
      direction: isAr ? 'rtl' : 'ltr',
      position: 'relative',
    }}>
      {/* Copy indicator */}
      <div style={{
        position: 'absolute', top: '6px', right: '8px',
        fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600,
      }}>
        {label.copyIndex}/{label.totalCopies}
      </div>

      {/* Gram badge */}
      <div style={{
        position: 'absolute', top: '6px', left: '8px',
        background: '#0d9488', color: 'white',
        fontSize: '0.65rem', fontWeight: 700,
        padding: '2px 6px', borderRadius: '999px',
      }}>
        {label.gramSize}g
      </div>

      {/* Section label */}
      <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, marginTop: '16px', marginBottom: '2px' }}>
        {secLabel}
      </div>

      {/* Meal name */}
      <div style={{
        fontSize: '0.82rem', fontWeight: 700, color: '#1e293b',
        marginBottom: '6px', lineHeight: 1.3,
      }}>
        {name}
      </div>

      {/* فوق: وزن الباقة من الاشتراك */}
      <div style={{ fontSize: '1rem', fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}>
        P:{label.proteinWeight}g / C:{label.carbsWeight}g
      </div>

      {/* تحت: القيم الغذائية من ملف الوجبة */}
      <div style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '6px' }}>
        P:{label.protein} - C:{label.carbs} - F:{label.fats} - Cal:{label.calories}
      </div>

      {/* Date */}
      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', marginBottom: '4px' }}>
        {fmtDate(label.date)}
      </div>

      {/* Shelf life */}
      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0d9488' }}>
        {isAr ? `صالح لمدة ${label.shelfLife} أيام` : `valid for ${label.shelfLife} days`}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// PrintLabel — ملصق الطباعة
// ─────────────────────────────────────────────
function PrintLabel({ label, isAr }) {
  const name = isAr ? label.titleAr : label.titleEn;
  return (
    <div className="label-card-print">
      <div className="label-inner" style={{
        direction: isAr ? 'rtl' : 'ltr',
        fontFamily: isAr ? "'Cairo', Arial, sans-serif" : "Arial, sans-serif",
      }}>

      {/* اسم الوجبة — أكبر عنصر */}
      <div style={{
        fontSize: '8pt', fontWeight: 800, color: '#0f172a',
        lineHeight: 1.2, textAlign: 'center', marginBottom: '1.5pt',
      }}>
        {name}
      </div>

      {/* وزن الباقة — P / C */}
      <div style={{
        fontSize: '9pt', fontWeight: 900, color: '#0f172a',
        letterSpacing: '0.3px', marginBottom: '1pt',
      }}>
        P:{label.proteinWeight}g / C:{label.carbsWeight}g
      </div>

      {/* القيم الغذائية من الوجبة */}
      <div style={{ fontSize: '6pt', color: '#374151', marginBottom: '1.5pt' }}>
        P:{label.protein} - C:{label.carbs} - F:{label.fats} - Cal:{label.calories}
      </div>

      {/* التاريخ + الصلاحية في سطر واحد */}
      <div style={{ fontSize: '6.5pt', fontWeight: 700, color: '#1e293b' }}>
        {fmtDate(label.date)} &nbsp;|&nbsp;
        {isAr ? `صالح ${label.shelfLife} أيام` : `valid ${label.shelfLife} days`}
      </div>
      </div>
    </div>
  );
}
