import { forwardRef } from 'react';
import { useLang } from '../LanguageContext';
import { useGovernorates } from '../hooks/useGovernorates';

// ─────────────────────────────────────────────────────────────
// StickerLabel — طابعة حرارية 10×8 سم
// Props:
//   client       — بيانات العميل
//   activeSub    — الاشتراك النشط (البروتين والكارب والباقة منه)
//   deliveryDate — تاريخ التوصيل (Date أو string)
//   dailyMeals   — { افطار:[], غداء:[], عشاء:[], سناك:[] }
//   qIndex       — ترتيب الليبول (1, 2, 3, ...) يتحدد من الصفحة الأب
// ─────────────────────────────────────────────────────────────
const StickerLabel = forwardRef(({ client, activeSub, deliveryDate, dailyMeals, qIndex = 1, allMeals = [] }, ref) => {
  const { lang } = useLang();
  const { governorates } = useGovernorates();
  const isAr = lang === 'ar';

  const today = deliveryDate ? new Date(deliveryDate) : new Date();

  // ── تواريخ الاشتراك ──
  const sub       = activeSub || client;
  const startDate = sub?.startDate ? new Date(sub.startDate) : new Date();
  const endDate   = sub?.endDate   ? new Date(sub.endDate)
    : (() => { const d = new Date(startDate); d.setDate(d.getDate() + (sub?.durationWeeks || 4) * 7); return d; })();
  const daysLeft  = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)));

  // ── البروتين والكارب من الاشتراك أو الـ flexConfig داخله ──
  const rawProtein = sub?.protein || sub?.flexConfig?.protein || sub?.packageSnapshot?.protein || 0;
  const rawCarbs   = sub?.carbs   || sub?.flexConfig?.carbs   || sub?.packageSnapshot?.carbs   || sub?.packageSnapshot?.carbohydrates || 0;
  const protein = rawProtein ? String(rawProtein).replace('g', '') : '---';
  const carbs   = rawCarbs   ? String(rawCarbs).replace('g', '')   : '---';

  // ── اسم الباقة من الاشتراك ──
  const packageName = isAr
    ? (sub?.packageName || sub?.packageNameAr || '')
    : (sub?.packageNameEn || sub?.packageName || '');

  // ── الوجبات (مفاتيح عربية من الداش بورد) ──
  const meals     = dailyMeals || {};
  const breakfast = meals['افطار'] || meals.breakfast || [];
  const lunch     = meals['غداء']  || meals.lunch     || [];
  const dinner    = meals['عشاء']  || meals.dinner    || [];
  const snacks    = meals['سناك']  || meals.snacks    || [];

  // ── اسم الوجبة — يبحث في MEALS_DATA للحصول على الاسم الإنجليزي ──
  const mealName = (item) => {
    if (!item) return '';
    const master = item.id && allMeals.length > 0 ? allMeals.find(m => m.id === item.id) : null;
    if (master) return isAr ? master.mealTitle : (master.mealTitleEn || master.mealTitle);
    if (typeof item === 'string') return item;
    if (item.title) return item.title;
    return isAr ? (item.ar || item.en || '') : (item.en || item.ar || '');
  };

  const formatDate = (d) =>
    `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;

  // ── ترجمة المحافظة والمنطقة من Firestore ──
  const govObj    = governorates.find(g => g.nameAr === client.governorate || g.nameEn === client.governorate);
  const regionObj = govObj?.regions?.find(r => r.ar === client.region || r.en === client.region || r.nameAr === client.region || r.nameEn === client.region);

  const L = {
    breakfast: isAr ? 'الفطور'          : 'Breakfast',
    lunch:     isAr ? 'الغداء'          : 'Lunch',
    dinner:    isAr ? 'العشاء'          : 'Dinner',
    snacks:    isAr ? 'السناك'          : 'Snacks',
    dislikes:  isAr ? 'الموانع'         : 'Dislikes',
    none:      isAr ? 'لا يوجد'         : 'None',
    note:      isAr ? 'ملاحظة التوصيل' : 'Delivery Note',
    daysLeft:  isAr ? 'يوم متبقي'       : 'Days Left',
    gov:       isAr ? 'محافظة'          : 'Gov',
    area:      isAr ? 'م'               : 'A',
    meals:     isAr ? 'وجبات'           : 'Meals',
    snacksLbl: isAr ? 'سناك'            : 'Snacks',
    govVal:    isAr ? (govObj?.nameAr  || client.governorate || '—') : (govObj?.nameEn  || client.governorate || '—'),
    regionVal: isAr ? (regionObj?.ar || regionObj?.nameAr || client.region || '—') : (regionObj?.en || regionObj?.nameEn || client.region || '—'),
  };

  const mealsCount  = sub?.mealsNumber  || sub?.flexConfig?.mealsNumber  || client.mealsNumber  || 0;
  const snacksCount = sub?.snacksNumber || sub?.flexConfig?.snacksNumber || client.snacksNumber || 0;

  return (
    <>
      <style>{`
        @media print {
          @page { size: 100mm 80mm; margin: 0; }
          body { margin: 0; }
          .sticker-label { page-break-after: always; }
        }
      `}</style>

      <div ref={ref} className="sticker-label" style={{
        width: '100mm',
        height: '80mm',
        background: 'white',
        fontFamily: isAr ? "'Cairo', Arial, sans-serif" : "Arial, sans-serif",
        border: '1.5px solid #000',
        display: 'flex',
        flexDirection: 'column',
        fontSize: '11px',
        direction: isAr ? 'rtl' : 'ltr',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}>

        {/* ── Header: اسم الباقة ── */}
        {packageName && (
          <div style={{
            background: '#0d9488', color: 'white', textAlign: 'center',
            fontWeight: 800, fontSize: '10px', padding: '2px 6px',
            letterSpacing: '0.5px', flexShrink: 0,
          }}>
            {packageName}
          </div>
        )}

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* ══ عمود الوجبات ══ */}
          <div style={{
            flex: '1.4',
            padding: '5px 8px',
            borderRight: isAr ? 'none' : '1.5px solid #000',
            borderLeft:  isAr ? '1.5px solid #000' : 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            overflow: 'hidden',
          }}>
            <div style={{ fontWeight: 800, fontSize: '11px', lineHeight: 1.2 }}>
              {client.name} — ID#{client.clientCode || 'N/A'}
            </div>
            <div style={{ fontSize: '9px', color: '#333', marginBottom: '2px' }}>
              {client.phone} | {L.meals}: {mealsCount} {L.snacksLbl}: {snacksCount}
            </div>

            {breakfast.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: '10px' }}>{L.breakfast}</div>
                {breakfast.map((item, i) => <div key={i} style={{ fontSize: '9px', lineHeight: 1.3 }}>• {mealName(item)}</div>)}
              </div>
            )}
            {lunch.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: '10px' }}>{L.lunch}</div>
                {lunch.map((item, i) => <div key={i} style={{ fontSize: '9px', lineHeight: 1.3 }}>• {mealName(item)}</div>)}
              </div>
            )}
            {dinner.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: '10px' }}>{L.dinner}</div>
                {dinner.map((item, i) => <div key={i} style={{ fontSize: '9px', lineHeight: 1.3 }}>• {mealName(item)}</div>)}
              </div>
            )}
            {snacks.length > 0 && (
              <div>
                <div style={{ fontWeight: 700, fontSize: '10px' }}>{L.snacks}</div>
                {snacks.map((item, i) => <div key={i} style={{ fontSize: '9px', lineHeight: 1.3 }}>• {mealName(item)}</div>)}
              </div>
            )}

            <div style={{ flex: 1 }} />

            <div style={{ fontSize: '9px', marginTop: '2px' }}>
              <span style={{ fontWeight: 700 }}>{L.dislikes}: </span>
              <span style={{ color: client.allergy ? '#b91c1c' : '#999', fontWeight: client.allergy ? 700 : 400 }}>
                {client.allergy || L.none}
              </span>
            </div>
            <div style={{ border: '1px solid #000', padding: '2px 5px', fontSize: '9px', marginTop: '2px' }}>
              {L.note}: {client.deliveryNote || '—'}
            </div>
          </div>

          {/* ══ عمود Q# والعنوان ══ */}
          <div style={{
            flex: '1',
            padding: '5px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}>
            {/* Q# — يأتي من الخارج حسب الترتيب */}
            <div style={{
              background: '#000', color: 'white', fontWeight: 900,
              fontSize: '22px', textAlign: 'center', padding: '3px 0',
              letterSpacing: '2px', lineHeight: 1.1,
            }}>
              Q#{qIndex}
            </div>

            <div style={{ border: '1px solid #000', textAlign: 'center', padding: '3px', fontSize: '11px', fontWeight: 700 }}>
              {formatDate(today)}
            </div>

            {/* البروتين والكارب من الاشتراك */}
            <div style={{ fontWeight: 800, fontSize: '12px' }}>
              GM: P{protein} / C{carbs}
            </div>

            <div style={{ fontSize: '9px', color: '#444' }}>
              {L.gov}: {L.govVal}
            </div>
            <div style={{ fontWeight: 800, fontSize: '11px' }}>
              {L.area}: {L.regionVal}
            </div>
            <div style={{ fontSize: '9px', lineHeight: 1.6 }}>
              <div>B: {client.block||'0'}, S: {client.street||'0'}, J: {client.alley||'0'}</div>
              <div>H: {client.building||'0'}, F: {client.floor||'0'}, APT: {client.apartment||'0'}</div>
            </div>

            <div style={{ flex: 1 }} />

            <div style={{ fontSize: '9px', lineHeight: 1.6, borderTop: '1.5px solid #000', paddingTop: '3px' }}>
              <div><strong>START:</strong> {formatDate(startDate)}</div>
              <div><strong>END:</strong> {formatDate(endDate)}</div>
              <div style={{ fontWeight: 900, fontSize: '13px', marginTop: '1px' }}>
                {daysLeft} {L.daysLeft}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

StickerLabel.displayName = 'StickerLabel';
export default StickerLabel;
