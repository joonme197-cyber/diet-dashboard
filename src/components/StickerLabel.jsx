import { forwardRef } from 'react';

const StickerLabel = forwardRef(({ client, deliveryDate, dailyMeals, lang = 'ar' }, ref) => {
  const isAr = lang === 'ar';
  const today = deliveryDate || new Date();
  const startDate = client.startDate ? new Date(client.startDate) : new Date();
  const durationDays = (client.bundlePeriodWeeks || client.durationWeeks || 4) * 7;
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays);
  const daysLeft = Math.max(0, Math.ceil((endDate - today) / (1000*60*60*24)));

  const formatDate = (d) =>
    `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getFullYear()}`;

  const protein = client.protein ? String(client.protein).replace('g','') : '---';
  const carbs   = client.carbs   ? String(client.carbs).replace('g','')   : '---';

  const meals     = dailyMeals || {};
  const breakfast = meals.breakfast || [];
  const lunch     = meals.lunch     || [];
  const dinner    = meals.dinner    || [];
  const snacks    = meals.snacks    || [];

  // ترجمات الاستيكر
  const L = {
    breakfast: isAr ? 'الفطور'            : 'Breakfast',
    lunch:     isAr ? 'الغداء'            : 'Lunch',
    dinner:    isAr ? 'العشاء'            : 'Dinner',
    snacks:    isAr ? 'السناك'            : 'Snacks',
    dislikes:  isAr ? 'الموانع'           : 'Dislikes',
    none:      isAr ? 'لا يوجد'           : 'None',
    note:      isAr ? 'ملاحظة التوصيل'   : 'Delivery Note',
    daysLeft:  isAr ? 'يوم متبقي'         : 'Days Left',
    gov:       isAr ? 'محافظة'            : 'Gov',
    area:      isAr ? 'م'                 : 'A',
    meals:     isAr ? 'وجبات'             : 'Meals',
    snacksLbl: isAr ? 'سناك'              : 'Snacks',
    govVal:    isAr ? (client.governorate || '—') : (client.governorateEn || client.governorate || '—'),
    regionVal: isAr ? (client.region      || '—') : (client.regionEn      || client.region      || '—'),
  };

  const stickerStyle = {
    width: '148mm',
    minHeight: '105mm',
    background: 'white',
    fontFamily: isAr ? "'Cairo', Arial, sans-serif" : "Arial, sans-serif",
    border: '1.5px solid #000',
    display: 'flex',
    flexDirection: 'column',
    fontSize: '13px',
    direction: isAr ? 'rtl' : 'ltr',
  };

  const colLeft = {
    flex: '1.3',
    padding: '10px 12px',
    borderRight: isAr ? 'none' : '2px solid #000',
    borderLeft:  isAr ? '2px solid #000' : 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  const colRight = {
    flex: '1',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  };

  return (
    <div ref={ref} style={stickerStyle}>
      <div style={{ display: 'flex', flex: 1 }}>

        {/* ===== العمود الأيسر ===== */}
        <div style={colLeft}>

          {/* اسم العميل + ID */}
          <div style={{ fontWeight: 800, fontSize: '14px' }}>
            {client.name} — ID#{client.clientCode || 'N/A'}
          </div>

          {/* هاتف + وجبات */}
          <div style={{ fontSize: '12px', color: '#333', marginBottom: '4px' }}>
            {client.phone} &nbsp;|&nbsp; {L.meals}: {client.mealsNumber || client.numberOfMeals || 0} &nbsp; {L.snacksLbl}: {client.snacksNumber || client.numberOfSnacks || 0}
          </div>

          {/* الفطور */}
          {breakfast.length > 0 && (
            <div style={{ marginBottom: '4px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>{L.breakfast}</div>
              {breakfast.map((item, i) => <div key={i} style={{ fontSize: '12px' }}>• {item}</div>)}
            </div>
          )}

          {/* الغداء */}
          {lunch.length > 0 && (
            <div style={{ marginBottom: '4px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>{L.lunch}</div>
              {lunch.map((item, i) => <div key={i} style={{ fontSize: '12px' }}>• {item}</div>)}
            </div>
          )}

          {/* العشاء */}
          {dinner.length > 0 && (
            <div style={{ marginBottom: '4px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>{L.dinner}</div>
              {dinner.map((item, i) => <div key={i} style={{ fontSize: '12px' }}>• {item}</div>)}
            </div>
          )}

          {/* السناك */}
          {snacks.length > 0 && (
            <div style={{ marginBottom: '4px' }}>
              <div style={{ fontWeight: 700, fontSize: '13px' }}>{L.snacks}</div>
              {snacks.map((item, i) => <div key={i} style={{ fontSize: '12px' }}>• {item}</div>)}
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* الموانع */}
          <div style={{ fontSize: '12px', marginTop: '6px' }}>
            <span style={{ fontWeight: 700 }}>{L.dislikes}: </span>
            <span style={{ color: client.allergy ? '#b91c1c' : '#999', fontWeight: client.allergy ? 700 : 400 }}>
              {client.allergy || L.none}
            </span>
          </div>

          {/* ملاحظة التوصيل */}
          <div style={{ border: '1px solid #000', padding: '4px 8px', fontSize: '12px', marginTop: '4px' }}>
            {L.note}: {client.deliveryNote || '—'}
          </div>
        </div>

        {/* ===== العمود الأيمن ===== */}
        <div style={colRight}>

          {/* Q# */}
          <div style={{
            background: '#000', color: 'white', fontWeight: 900,
            fontSize: '28px', textAlign: 'center', padding: '6px 0', letterSpacing: '2px',
          }}>
            Q#{client.zoneCode || '1'}
          </div>

          {/* التاريخ */}
          <div style={{ border: '1px solid #000', textAlign: 'center', padding: '5px', fontSize: '14px', fontWeight: 700 }}>
            {formatDate(today)}
          </div>

          {/* GM */}
          <div style={{ fontWeight: 800, fontSize: '15px' }}>
            GM: P{protein} / C{carbs}
          </div>

          {/* المحافظة */}
          <div style={{ fontSize: '12px', color: '#444' }}>
            {L.gov}: {L.govVal}
          </div>

          {/* المنطقة */}
          <div style={{ fontWeight: 800, fontSize: '14px' }}>
            {L.area}: {L.regionVal}
          </div>

          {/* العنوان */}
          <div style={{ fontSize: '12px', lineHeight: '1.9' }}>
            <div>B: {client.block||'0'}, S: {client.street||'0'}, J: {client.alley||'0'}</div>
            <div>H: {client.building||'0'}, F: {client.floor||'0'}, APT: {client.apartment||'0'}</div>
          </div>

          <div style={{ flex: 1 }} />

          {/* START / END / Days Left */}
          <div style={{ fontSize: '12px', lineHeight: '1.9', borderTop: '1.5px solid #000', paddingTop: '6px' }}>
            <div><strong>START:</strong> {formatDate(startDate)}</div>
            <div><strong>END:</strong> {formatDate(endDate)}</div>
            <div style={{ fontWeight: 900, fontSize: '16px', marginTop: '2px' }}>
              {daysLeft} {L.daysLeft}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

StickerLabel.displayName = 'StickerLabel';
export default StickerLabel;
