import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getClientById, getClients, updateClient } from '../firebase/clientService';
import {
  getClientSubscriptions, addSubscription, updateSubscription, deleteSubscription,
  freezeDay, unFreezeDay, addBonusDays, addPayment, freezeDateRange,
  getSubscriptionStatus, getStatusLabel, calcRenewalStartDate,
  getRenewalSettings, saveRenewalSettings
} from '../firebase/subscriptionService';
import { getPackages } from '../firebase/packageService';
import { REGIONS_DATA } from '../LanguageContext';
import {
  MEALS_DATA, getMenuDay, saveClientDailyMeals, getClientDailyMeals,
} from '../firebase/mealService';

const PAYMENT_METHODS = ['كاش', 'Knet', 'Visa/Mastercard', 'رابط WhatsApp', 'آجل'];
const MEAL_SECTIONS = [
  { key: 'افطار', label: 'الفطور',  icon: '🍳' },
  { key: 'غداء',  label: 'الغداء',  icon: '🍛' },
  { key: 'عشاء',  label: 'العشاء',  icon: '🌙' },
  { key: 'سناك',  label: 'السناك',  icon: '🥗' },
];
const TABS = ['الاشتراكات', 'الوجبات', 'التقويم', 'المدفوعات', 'البيانات'];

const ACTION_ICONS = [
  { icon: '🗑', label: 'حذف', color: '#ef4444', action: 'delete' },
  { icon: '⏸', label: 'تجميد', color: '#f59e0b', action: 'pause' },
  { icon: '🚫', label: 'إلغاء', color: '#ef4444', action: 'cancel' },
  { icon: '✏️', label: 'تعديل', color: '#3b82f6', action: 'edit' },
  { icon: '📅', label: 'تمديد', color: '#0d9488', action: 'extend' },
  { icon: '📋', label: 'تغيير وجبات', color: '#0d9488', action: 'meals' },
  { icon: '↩️', label: 'تجديد', color: '#7c3aed', action: 'renew' },
  { icon: '📝', label: 'ملاحظات', color: '#64748b', action: 'notes' },
  { icon: '💳', label: 'دفع', color: '#16a34a', action: 'payment' },
];

const GOVERNORATES = [
  { key: 'capital',  nameAr: 'العاصمة',      nameEn: 'Capital' },
  { key: 'hawalli',  nameAr: 'حولي',          nameEn: 'Hawalli' },
  { key: 'farwaniya',nameAr: 'الفروانية',     nameEn: 'Farwaniya' },
  { key: 'ahmadi',   nameAr: 'الأحمدي',       nameEn: 'Ahmadi' },
  { key: 'jahra',    nameAr: 'الجهراء',       nameEn: 'Jahra' },
  { key: 'mubarak',  nameAr: 'مبارك الكبير',  nameEn: 'Mubarak Al-Kabeer' },
];

export default function ClientProfile() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [client, setClient]           = useState(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [packages, setPackages]       = useState([]);
  const [activeTab, setActiveTab]     = useState('الاشتراكات');
  const [loading, setLoading]         = useState(true);
  const [msg, setMsg]                 = useState('');
  const [selectedSub, setSelectedSub] = useState(null);

  // Modals
  const [showAddSub, setShowAddSub]         = useState(false);
  const [showRenew, setShowRenew]           = useState(false);
  const [showDaysModal, setShowDaysModal]   = useState(false);
  const [showPayment, setShowPayment]       = useState(false);
  const [showChangeMeals, setShowChangeMeals] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showPauseConfirm, setShowPauseConfirm]   = useState(false);
  const [showFreezeRange, setShowFreezeRange]     = useState(false);
  const [freezeRange, setFreezeRange]             = useState({ from: '', to: '' });
  // calendar selection mode: 'single' | 'range'
  const [calSelectMode, setCalSelectMode]         = useState('single');
  const [calRangeStart, setCalRangeStart]         = useState(null);

  // إعدادات التجديد
  const [renewalSettings, setRenewalSettings]     = useState({ leadHours: 96 });
  const [showRenewalSettings, setShowRenewalSettings] = useState(false);
  const [savingSettings, setSavingSettings]       = useState(false);

  // Calendar
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // ── تعديل بيانات العميل ──
  const [editingClient, setEditingClient] = useState(false);
  const [clientForm, setClientForm]       = useState({});
  const [savingClient, setSavingClient]   = useState(false);

  // Forms
  const emptySubForm = {
    packageId: '', packageName: '', bundleType: 'normal',
    startDate: '', endDate: '', durationWeeks: 4,
    protein: '150', carbs: '100',
    mealsNumber: 3, snacksNumber: 1,
    allowedBreakfast: 2, allowedLunch: 2, allowedDinner: 2,
    allowBreakfast: true, allowLunch: true, allowDinner: true, allowSnacks: true,
    paymentMethod: 'كاش', paymentAmount: '', notes: '',
  };
  const [subForm, setSubForm]       = useState(emptySubForm);
  const [renewType, setRenewType]   = useState('same');
  const [daysAction, setDaysAction] = useState({ type: 'add', days: 1 });
  const [paymentForm, setPaymentForm] = useState({ method: 'كاش', amount: '', notes: '' });
  const [mealsForm, setMealsForm]   = useState({ mealsNumber: 3, snacksNumber: 1, allowedBreakfast: 2, allowedLunch: 2, allowedDinner: 2 });

  // ── تاب الوجبات ──
  const [mealDate, setMealDate]         = useState(new Date().toISOString().split('T')[0]);
  const [menuMeals, setMenuMeals]       = useState([]);
  const [clientMeals, setClientMeals]   = useState({ افطار: [], غداء: [], عشاء: [], سناك: [] });
  const [loadingMeals, setLoadingMeals] = useState(false);
  const [savingMeals, setSavingMeals]   = useState(false);
  const [mealsMsg, setMealsMsg]         = useState('');

  // ── load ──
  const load = async () => {
    setLoading(true);
    try {
      // جلب العميل — نجرب الطريقتين
      let c = await getClientById(clientId);
      if (!c) {
        const allClients = await getClients();
        c = allClients.find(x => x.id === clientId) || null;
      }
      const [subs, pkgs, settings] = await Promise.all([
        getClientSubscriptions(clientId),
        getPackages(),
        getRenewalSettings(),
      ]);
      setClient(c);
      setSubscriptions(subs);
      setPackages(pkgs);
      if (settings) setRenewalSettings(settings);
      const active = subs.find(s => getSubscriptionStatus(s) === 'active');
      if (active) setSelectedSub(active);
    } catch (e) {
      console.error('ClientProfile load error:', e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [clientId]);

  const showMsg = (m) => { setMsg(m); setTimeout(() => setMsg(''), 2500); };

  const calcEndDate = (start, weeks) => {
    if (!start) return '';
    const d = new Date(start);
    d.setDate(d.getDate() + weeks * 7);
    return d.toISOString().split('T')[0];
  };

  // ── تعديل بيانات العميل ──
  const startEditClient = () => {
    setClientForm({
      name:         client.name         || '',
      phone:        client.phone        || '',
      email:        client.email        || '',
      gender:       client.gender       || '',
      allergy:      client.allergy      || '',
      deliveryNote: client.deliveryNote || '',
      governorate:  client.governorate  || '',
      region:       client.region       || '',
      block:        client.block        || '',
      street:       client.street       || '',
      alley:        client.alley        || '',
      building:     client.building     || '',
      floor:        client.floor        || '',
      apartment:    client.apartment    || '',
    });
    setEditingClient(true);
  };

  const saveClientEdit = async () => {
    setSavingClient(true);
    await updateClient(clientId, clientForm);
    setSavingClient(false);
    setEditingClient(false);
    load();
    showMsg('✅ تم تحديث بيانات العميل');
  };

  // مناطق المحافظة المختارة
  const selectedGovData = REGIONS_DATA.find(g =>
    g.nameAr === clientForm.governorate || g.nameEn === clientForm.governorate
  );
  const regions = selectedGovData?.regions || [];

  const handleAction = async (action) => {
    const active = subscriptions.find(s => getSubscriptionStatus(s) === 'active');
    setSelectedSub(active || subscriptions[0]);
    if (action === 'meals') {
      const sub = active || subscriptions[0];
      if (sub) setMealsForm({ mealsNumber: sub.mealsNumber||3, snacksNumber: sub.snacksNumber||1, allowedBreakfast: sub.allowedBreakfast||2, allowedLunch: sub.allowedLunch||2, allowedDinner: sub.allowedDinner||2 });
      setShowChangeMeals(true);
    } else if (action === 'renew') {
      setRenewType('same');
      // الداش بورد: حر — بس يوم بعد انتهاء الاشتراك كحد أدنى
      const dayAfterEnd = active?.endDate ? (() => {
        const d = new Date(active.endDate); d.setDate(d.getDate() + 1);
        return d.toISOString().split('T')[0];
      })() : '';
      setSubForm(f => ({...f, startDate: dayAfterEnd, durationWeeks: active?.durationWeeks||4}));
      setShowRenew(true);
    } else if (action === 'extend') {
      setDaysAction({ type: 'add', days: 1 });
      setShowDaysModal(true);
    } else if (action === 'payment') {
      setPaymentForm({ method: 'كاش', amount: '', notes: '' });
      setShowPayment(true);
    } else if (action === 'edit') {
      setSubForm({...emptySubForm, ...active});
      setShowAddSub(true);
    } else if (action === 'delete') {
      setShowDeleteConfirm(true);
    } else if (action === 'pause') {
      setFreezeRange({ from: '', to: '' });
      setShowFreezeRange(true);
    } else if (action === 'cancel') {
      const sub = active || subscriptions[0];
      if (sub && window.confirm('هل تريد إلغاء هذا الاشتراك؟')) {
        await updateSubscription(sub.id, { status: 'cancelled' });
        load(); showMsg('تم إلغاء الاشتراك');
      }
    }
  };

  const handleAddSub = async () => {
    if (!subForm.startDate) { alert('تاريخ البدء مطلوب'); return; }
    const pkg = packages.find(p => p.id === subForm.packageId);
    const endDate = calcEndDate(subForm.startDate, subForm.durationWeeks);
    await addSubscription({
      clientId, clientName: client?.name,
      packageId: subForm.packageId,
      packageName: pkg?.nameAr || 'باقة مخصصة',
      bundleType: subForm.bundleType,
      startDate: subForm.startDate, endDate,
      durationWeeks: subForm.durationWeeks,
      protein: subForm.protein, carbs: subForm.carbs,
      mealsNumber: subForm.mealsNumber, snacksNumber: subForm.snacksNumber,
      allowedBreakfast: subForm.allowedBreakfast,
      allowedLunch: subForm.allowedLunch,
      allowedDinner: subForm.allowedDinner,
      payments: subForm.paymentMethod !== 'آجل' ? [{ method: subForm.paymentMethod, amount: subForm.paymentAmount, date: new Date().toISOString().split('T')[0] }] : [],
      paymentStatus: subForm.paymentMethod === 'آجل' ? 'pending' : 'paid',
      notes: subForm.notes,
    });
    setShowAddSub(false); load(); showMsg('تم إضافة الاشتراك بنجاح');
  };

  const handleRenew = async () => {
    const active = subscriptions.find(s => getSubscriptionStatus(s) === 'active');
    // الداش بورد: الحد الأدنى هو يوم بعد انتهاء الاشتراك فقط
    const dayAfterEnd = active?.endDate ? (() => {
      const d = new Date(active.endDate); d.setDate(d.getDate() + 1);
      return d.toISOString().split('T')[0];
    })() : new Date().toISOString().split('T')[0];
    const startDate = (!subForm.startDate || subForm.startDate < dayAfterEnd) ? dayAfterEnd : subForm.startDate;
    const endDate = calcEndDate(startDate, (active?.durationWeeks||4));
    const data = renewType === 'same'
      ? { ...active, id: undefined, startDate, endDate, status: 'upcoming', payments: [], paymentStatus: 'pending', frozenDays: [], bonusDays: 0, createdAt: undefined }
      : { clientId, clientName: client?.name, startDate, endDate, bundleType: subForm.bundleType, packageId: subForm.packageId, packageName: packages.find(p=>p.id===subForm.packageId)?.nameAr||'', durationWeeks: subForm.durationWeeks, protein: subForm.protein, carbs: subForm.carbs, mealsNumber: subForm.mealsNumber, snacksNumber: subForm.snacksNumber, allowedBreakfast: subForm.allowedBreakfast, allowedLunch: subForm.allowedLunch, allowedDinner: subForm.allowedDinner, status: 'upcoming', payments: [], paymentStatus: 'pending', frozenDays: [], bonusDays: 0 };
    await addSubscription(data);
    setShowRenew(false); load(); showMsg('تم التجديد بنجاح');
  };

  const handleFreezeDay = async (dateStr) => {
    if (!selectedSub) return;
    const frozen = selectedSub.frozenDays || [];
    if (frozen.includes(dateStr)) {
      await unFreezeDay(selectedSub.id, dateStr);
      showMsg(`تم إلغاء تجميد ${dateStr}`);
    } else {
      await freezeDay(selectedSub.id, dateStr);
      showMsg(`تم تجميد ${dateStr} ❄`);
    }
    load();
  };

  const handleDaysAction = async () => {
    if (!selectedSub) return;
    await addBonusDays(selectedSub.id, daysAction.type === 'add' ? daysAction.days : -daysAction.days);
    setShowDaysModal(false); load();
    showMsg(`تم ${daysAction.type === 'add' ? 'إضافة' : 'خصم'} ${daysAction.days} يوم`);
  };

  const handleAddPayment = async () => {
    if (!selectedSub) return;
    await addPayment(selectedSub.id, paymentForm);
    setShowPayment(false); load(); showMsg('تم تسجيل الدفعة');
  };

  const handleChangeMeals = async () => {
    if (!selectedSub) return;
    await updateSubscription(selectedSub.id, mealsForm);
    setShowChangeMeals(false); load(); showMsg('تم تحديث الوجبات بنجاح');
  };

  const handleDeleteSub = async () => {
    if (!selectedSub) return;
    await deleteSubscription(selectedSub.id);
    setShowDeleteConfirm(false);
    load();
    showMsg('🗑 تم حذف الاشتراك');
  };

  const handlePauseSub = async () => {
    if (!selectedSub) return;
    await updateSubscription(selectedSub.id, { status: 'paused' });
    setShowPauseConfirm(false);
    load();
    showMsg('⏸ تم تجميد الاشتراك');
  };

  const handleFreezeRange = async () => {
    if (!selectedSub || !freezeRange.from || !freezeRange.to) return;
    if (freezeRange.from > freezeRange.to) { alert('تاريخ البداية يجب أن يكون قبل تاريخ النهاية'); return; }
    const count = await freezeDateRange(selectedSub.id, freezeRange.from, freezeRange.to);
    setShowFreezeRange(false);
    load();
    showMsg(`❄ تم تجميد ${count} يوم — تم تمديد الاشتراك تلقائياً`);
  };

  const handleSaveRenewalSettings = async () => {
    setSavingSettings(true);
    await saveRenewalSettings(renewalSettings);
    setSavingSettings(false);
    setShowRenewalSettings(false);
    showMsg('✅ تم حفظ إعدادات التجديد');
  };

  // تجميد نطاق من التقويم مباشرة
  const handleCalendarClick = async (day) => {
    if (!day.isInRange) return;
    if (calSelectMode === 'single') {
      await handleFreezeDay(day.dateStr);
    } else {
      // وضع النطاق
      if (!calRangeStart) {
        setCalRangeStart(day.dateStr);
      } else {
        const from = calRangeStart < day.dateStr ? calRangeStart : day.dateStr;
        const to   = calRangeStart < day.dateStr ? day.dateStr : calRangeStart;
        setCalRangeStart(null);
        const count = await freezeDateRange(selectedSub.id, from, to);
        load();
        showMsg(`❄ تم تجميد ${count} يوم`);
      }
    }
  };

  // ── دوال تاب الوجبات ──
  const loadMealDay = async (date) => {
    const mealSub = activeSub || subscriptions.find(s => getSubscriptionStatus(s) === 'upcoming');
    if (!mealSub) return;
    setLoadingMeals(true);
    try {
      // حساب key اليوم في الدورة
      const startDate = mealSub.startDate || date;
      const start  = new Date(startDate);
      const target = new Date(date);
      const diffDays = Math.floor((target - start) / (1000 * 60 * 60 * 24));
      const dayInCycle = ((diffDays % 28) + 28) % 28;
      const week = Math.floor(dayInCycle / 7) + 1;
      const DAYS = ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
      const dayMap = [1,2,3,4,5,6,0];
      const dayIdx = dayMap[target.getDay()];
      const dayKey = `w${week}_${DAYS[dayIdx]}`;

      // جلب منيو اليوم
      const menuDay = await getMenuDay('default', dayKey);
      const mealIds = menuDay?.meals || [];
      const meals = mealIds.map(id => MEALS_DATA.find(m => m.id === id)).filter(Boolean);
      setMenuMeals(meals);

      // جلب اختيارات العميل الحالية
      const existing = await getClientDailyMeals(clientId, date);
      setClientMeals(existing || { افطار: [], غداء: [], عشاء: [], سناك: [] });
    } catch(e) {
      console.error(e);
    }
    setLoadingMeals(false);
  };

  const getMealLimit = (type, mealSub) => {
    // للتطبيق والكرون فقط — الداش بورد حر
    if (!mealSub) return 99;

    const allowed = {
      'افطار': mealSub.allowBreakfast !== false,
      'غداء':  mealSub.allowLunch     !== false,
      'عشاء':  mealSub.allowDinner    !== false,
      'سناك':  mealSub.allowSnacks    !== false,
    };
    if (!allowed[type]) return 0;

    if (type === 'سناك') return mealSub.snacksNumber ?? 99;

    // للباقة الثابتة: فيها حدود منفصلة لكل نوع
    if (mealSub.bundleType === 'normal') {
      if (type === 'افطار') return mealSub.allowedBreakfast ?? mealSub.mealsNumber ?? 99;
      if (type === 'غداء')  return mealSub.allowedLunch     ?? mealSub.mealsNumber ?? 99;
      if (type === 'عشاء')  return mealSub.allowedDinner    ?? mealSub.mealsNumber ?? 99;
    }

    // للباقة المرنة: mealsNumber هو الحد الكلي للوجبات (غير السناك)
    // كل نوع مسموح يشارك في نفس الحد الكلي
    return mealSub.mealsNumber ?? 99;
  };

  // حساب الوجبات الكلي بدون السناك (للباقة المرنة)
  const totalMealsWithoutSnacks = Object.entries(clientMeals)
    .filter(([key]) => key !== 'سناك')
    .reduce((s, [, arr]) => s + arr.length, 0);

  // الأدمن حر تماماً — toggleMeal بدون قيود
  const toggleMeal = (meal) => {
    const type = meal.mealType;
    setClientMeals(p => {
      const current = p[type] || [];
      const exists  = current.find(m => m.id === meal.id);
      return {
        ...p,
        [type]: exists
          ? current.filter(m => m.id !== meal.id)
          : [...current, { id: meal.id, title: meal.mealTitle }]
      };
    });
  };

  const isMealSelected = (meal) =>
    (clientMeals[meal.mealType] || []).some(m => m.id === meal.id);

  const saveMeals = async () => {
    setSavingMeals(true);
    await saveClientDailyMeals(clientId, mealDate, clientMeals);
    setSavingMeals(false);
    setMealsMsg('✅ تم حفظ الوجبات بنجاح!');
    setTimeout(() => setMealsMsg(''), 2500);
  };

  const totalSelected = Object.values(clientMeals).reduce((s, a) => s + a.length, 0);

  // ── التقويم

  const renderCalendar = () => {
    if (!selectedSub) return null;
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const frozen = selectedSub.frozenDays || [];
    const today = new Date().toISOString().split('T')[0];
    const days = [];
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isRangePreview = calSelectMode === 'range' && calRangeStart && dateStr >= Math.min(calRangeStart, dateStr) && dateStr === calRangeStart;
      days.push({
        d, dateStr,
        isFrozen: frozen.includes(dateStr),
        isInRange: dateStr >= selectedSub.startDate && dateStr <= selectedSub.endDate,
        isToday: dateStr === today,
        isRangeStart: dateStr === calRangeStart,
      });
    }
    return (
      <div>
        {/* أدوات التحكم في التقويم */}
        <div style={{ display:'flex', gap:'8px', marginBottom:'12px', alignItems:'center', flexWrap:'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setCalendarMonth(p => new Date(p.getFullYear(), p.getMonth()-1))}>→</button>
          <strong style={{ flex:1, textAlign:'center' }}>{calendarMonth.toLocaleDateString('ar', { month: 'long', year: 'numeric' })}</strong>
          <button className="btn btn-ghost btn-sm" onClick={() => setCalendarMonth(p => new Date(p.getFullYear(), p.getMonth()+1))}>←</button>
        </div>

        {/* مفتاح وضع التحديد */}
        <div style={{ display:'flex', gap:'6px', marginBottom:'12px', background:'#f8fafc', borderRadius:'8px', padding:'4px' }}>
          <button onClick={() => { setCalSelectMode('single'); setCalRangeStart(null); }}
            style={{ flex:1, padding:'6px', border:'none', borderRadius:'6px', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-main)',
              background: calSelectMode==='single' ? 'white' : 'transparent',
              color: calSelectMode==='single' ? '#0d9488' : '#94a3b8',
              boxShadow: calSelectMode==='single' ? '0 1px 3px #0001' : 'none',
            }}>
            ☝️ يوم واحد
          </button>
          <button onClick={() => { setCalSelectMode('range'); setCalRangeStart(null); }}
            style={{ flex:1, padding:'6px', border:'none', borderRadius:'6px', fontSize:'0.8rem', fontWeight:600, cursor:'pointer', fontFamily:'var(--font-main)',
              background: calSelectMode==='range' ? 'white' : 'transparent',
              color: calSelectMode==='range' ? '#0d9488' : '#94a3b8',
              boxShadow: calSelectMode==='range' ? '0 1px 3px #0001' : 'none',
            }}>
            📅 نطاق تواريخ
          </button>
        </div>

        {/* تلميح وضع النطاق */}
        {calSelectMode === 'range' && (
          <div style={{ background: calRangeStart ? '#fff7ed' : '#f0fdfa', border:`1px solid ${calRangeStart ? '#fed7aa' : '#ccfbf1'}`, borderRadius:'8px', padding:'8px 12px', marginBottom:'10px', fontSize:'0.8rem', color: calRangeStart ? '#c2410c' : '#0d9488', textAlign:'center' }}>
            {calRangeStart ? `✅ اختر تاريخ النهاية — البداية: ${calRangeStart}` : '👆 اضغط على يوم البداية'}
          </div>
        )}

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:'4px', marginBottom:'8px' }}>
          {['م','ث','أ','خ','ج','س','أح'].map(d => (
            <div key={d} style={{ textAlign:'center', fontSize:'0.72rem', fontWeight:700, color:'#94a3b8' }}>{d}</div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:'4px' }}>
          {days.map((day, i) => (
            <div key={i}>
              {day ? (
                <button onClick={() => handleCalendarClick(day)}
                  style={{
                    width:'100%', aspectRatio:'1', borderRadius:'8px', border:'none',
                    cursor: day.isInRange ? 'pointer' : 'default',
                    fontFamily:'var(--font-main)', fontSize:'0.82rem', fontWeight:600,
                    transition:'all 0.12s',
                    background: day.isRangeStart ? '#0d9488' : day.isFrozen ? '#fef3c7' : day.isToday ? '#0d9488' : day.isInRange ? '#f0fdfa' : '#f8fafc',
                    color: day.isRangeStart ? 'white' : day.isFrozen ? '#d97706' : day.isToday ? 'white' : day.isInRange ? '#0f766e' : '#cbd5e1',
                    border: day.isRangeStart ? '2px solid #0d9488' : day.isFrozen ? '1.5px solid #fde68a' : day.isInRange ? '1px solid #ccfbf1' : '1px solid transparent',
                    outline: day.isRangeStart ? '2px solid #5eead4' : 'none',
                  }}
                >
                  {day.d}
                  {day.isFrozen && <div style={{ fontSize:'0.55rem' }}>❄</div>}
                  {day.isRangeStart && !day.isFrozen && <div style={{ fontSize:'0.55rem' }}>📍</div>}
                </button>
              ) : <div />}
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:'12px', marginTop:'10px', fontSize:'0.75rem', color:'#64748b', flexWrap:'wrap' }}>
          <span>🟩 في الاشتراك</span>
          <span>🟨 مجمد ❄</span>
          <span>🟦 اليوم</span>
          {calSelectMode==='range' && <span>📍 بداية النطاق</span>}
          <span style={{ marginRight:'auto', fontWeight:700, color:'#d97706' }}>
            {frozen.length} يوم مجمد
          </span>
        </div>
      </div>
    );
  };

  if (loading) return <div className="loading"><div className="spinner" />جاري التحميل...</div>;
  if (!client) return <div className="page-body"><div className="alert alert-error">العميل غير موجود</div></div>;

  const activeSub    = subscriptions.find(s => getSubscriptionStatus(s) === 'active');
  const upcomingSubs = subscriptions.filter(s => getSubscriptionStatus(s) === 'upcoming');
  const expiredSubs  = subscriptions.filter(s => ['expired','cancelled'].includes(getSubscriptionStatus(s)));

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <h2>{client.name}</h2>
          <div className="breadcrumb">
            <Link to="/clients" style={{ color: 'var(--text-muted)' }}>العملاء</Link> / {client.name}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => { setSubForm(emptySubForm); setShowAddSub(true); }}>
          + اشتراك جديد
        </button>
      </div>

      {msg && <div style={{ margin: '0 32px' }}><div className="alert alert-success fade-in">{msg}</div></div>}

      <div className="page-body">
        {/* Client Info */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-body" style={{ padding: '16px 24px' }}>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '12px', background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '1.4rem', fontWeight: 900, flexShrink: 0 }}>
                {client.name?.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{client.name}</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '2px' }}>
                  {client.phone} {client.email && `• ${client.email}`}
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <span className="badge badge-teal">{client.clientCode}</span>
                  {activeSub && <span className="badge badge-green">Active</span>}
                  {client.allergy && <span style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700 }}>⚠️ {client.allergy}</span>}
                </div>
              </div>
              {activeSub && (
                <div style={{ textAlign: 'left', background: '#f0fdfa', padding: '10px 16px', borderRadius: '10px', border: '1px solid #ccfbf1' }}>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>الاشتراك النشط</div>
                  <div style={{ fontWeight: 700, color: '#0d9488' }}>{activeSub.packageName}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    ينتهي: {activeSub.endDate}
                    {(activeSub.frozenDays||[]).length > 0 && ` • ❄ ${activeSub.frozenDays.length} مجمد`}
                  </div>
                </div>
              )}
            </div>

            {subscriptions.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
                {ACTION_ICONS.map(a => (
                  <button key={a.action}
                    onClick={() => handleAction(a.action)}
                    title={a.label}
                    style={{
                      width: '38px', height: '38px', borderRadius: '50%', border: `2px solid ${a.color}20`,
                      background: `${a.color}10`, cursor: 'pointer', fontSize: '1rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = `${a.color}25`; e.currentTarget.style.borderColor = a.color; }}
                    onMouseOut={e => { e.currentTarget.style.background = `${a.color}10`; e.currentTarget.style.borderColor = `${a.color}20`; }}
                  >
                    {a.icon}
                  </button>
                ))}
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', alignSelf: 'center', marginRight: '8px' }}>
                  Subscription ID: {activeSub?.id?.slice(-6) || '---'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #e2e8f0' }}>
          {TABS.map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); if(tab === 'التقويم' && activeSub) setSelectedSub(activeSub); }}
              style={{
                padding: '10px 20px', border: 'none', background: 'none',
                fontFamily: 'var(--font-main)', fontSize: '0.9rem', fontWeight: 600,
                cursor: 'pointer', color: activeTab === tab ? '#0d9488' : '#64748b',
                borderBottom: activeTab === tab ? '2px solid #0d9488' : '2px solid transparent',
                marginBottom: '-2px',
              }}
            >{tab}</button>
          ))}
        </div>

        {/* ── الاشتراكات ── */}
        {activeTab === 'الاشتراكات' && (
          <div>
            {activeSub && (
              <div style={{ marginBottom: '16px' }}>
                <div className="section-title">الاشتراك النشط</div>
                <SubCard sub={activeSub} onCalendar={() => { setSelectedSub(activeSub); setActiveTab('التقويم'); }} />
              </div>
            )}
            {upcomingSubs.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div className="section-title">الاشتراكات القادمة</div>
                {upcomingSubs.map(s => <SubCard key={s.id} sub={s} />)}
              </div>
            )}
            {expiredSubs.length > 0 && (
              <div>
                <div className="section-title">السجل السابق</div>
                {expiredSubs.map(s => <SubCard key={s.id} sub={s} />)}
              </div>
            )}
            {subscriptions.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>لا يوجد اشتراكات</h3>
                <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => setShowAddSub(true)}>+ إضافة اشتراك</button>
              </div>
            )}
          </div>
        )}

        {/* ── التقويم ── */}
        {/* ── تاب الوجبات ── */}
        {activeTab === 'الوجبات' && (() => {
          // نقبل اشتراك نشط أو قادم
          const mealSub = activeSub || subscriptions.find(s => getSubscriptionStatus(s) === 'upcoming');
          return (
          <div>
            {!mealSub ? (
              <div className="empty-state">
                <div className="empty-icon">🍽️</div>
                <h3>لا يوجد اشتراك</h3>
                <p>أضف اشتراكاً أولاً لتحديد الوجبات</p>
              </div>
            ) : (
              <div>
                {getSubscriptionStatus(mealSub) === 'upcoming' && (
                  <div className="alert alert-success" style={{ marginBottom: '12px', background: '#fff7ed', border: '1px solid #fed7aa', color: '#c2410c' }}>
                    ⏳ الاشتراك قادم — يمكنك تحديد الوجبات مسبقاً
                  </div>
                )}
                {/* Date selector */}
                <div className="card" style={{ marginBottom: '16px' }}>
                  <div className="card-body">
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div className="form-group" style={{ marginBottom: 0, flex: 1, maxWidth: '260px' }}>
                        <label className="form-label">📅 تاريخ التوصيل</label>
                        <input type="date" className="form-control" value={mealDate}
                          min={mealSub.startDate} max={mealSub.endDate}
                          onChange={e => setMealDate(e.target.value)} />
                      </div>
                      <button className="btn btn-primary" onClick={() => loadMealDay(mealDate)} disabled={loadingMeals}>
                        {loadingMeals ? <><div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} /> جاري التحميل...</> : '📋 تحميل المنيو'}
                      </button>
                      {totalSelected > 0 && (
                        <button className="btn btn-outline" onClick={saveMeals} disabled={savingMeals}
                          style={{ color: '#16a34a', borderColor: '#16a34a' }}>
                          {savingMeals ? 'جاري الحفظ...' : `✅ حفظ (${totalSelected} وجبة)`}
                        </button>
                      )}
                    </div>
                    {mealsMsg && <div className="alert alert-success" style={{ marginTop: '12px', marginBottom: 0 }}>{mealsMsg}</div>}
                  </div>
                </div>

                {/* القائمة */}
                {menuMeals.length > 0 && (
                  <div>
                    {/* ── شريط حدود الباقة (للعرض فقط - الأدمن حر) ── */}
                    <div className="card" style={{ marginBottom: '16px' }}>
                      <div className="card-body" style={{ padding: '12px 16px' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
                          <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#475569' }}>
                            📊 إعدادات الباقة — {mealSub.packageName}
                          </span>
                          <span style={{ fontSize:'0.72rem', color:'#94a3b8', background:'#f1f5f9', padding:'2px 8px', borderRadius:'999px' }}>
                            للمرجع فقط — الأدمن حر
                          </span>
                        </div>
                        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                          {[
                            { key:'افطار', label:'الفطور', icon:'🍳' },
                            { key:'غداء',  label:'الغداء', icon:'🍛' },
                            { key:'عشاء',  label:'العشاء', icon:'🌙' },
                            { key:'سناك',  label:'السناك', icon:'🥗' },
                          ].map(({ key, label, icon }) => {
                            const selected = (clientMeals[key] || []).length;
                            const allowed = { 'افطار': mealSub.allowBreakfast !== false, 'غداء': mealSub.allowLunch !== false, 'عشاء': mealSub.allowDinner !== false, 'سناك': mealSub.allowSnacks !== false }[key];

                            let limit;
                            if (!allowed) {
                              limit = null;
                            } else if (key === 'سناك') {
                              limit = mealSub.snacksNumber ?? '∞';
                            } else if (mealSub.bundleType === 'normal') {
                              const perType = { 'افطار': mealSub.allowedBreakfast, 'غداء': mealSub.allowedLunch, 'عشاء': mealSub.allowedDinner }[key];
                              limit = perType ?? mealSub.mealsNumber ?? '∞';
                            } else {
                              limit = mealSub.mealsNumber ?? '∞';
                            }

                            const blocked = limit === null;
                            const over    = !blocked && limit !== '∞' && selected > limit;
                            const full    = !blocked && limit !== '∞' && selected === limit && limit > 0;
                            return (
                              <div key={key} style={{
                                display:'flex', alignItems:'center', gap:'6px',
                                padding:'6px 12px', borderRadius:'999px', fontSize:'0.8rem', fontWeight:700,
                                background: blocked ? '#f8fafc' : over ? '#fff7ed' : full ? '#f0fdf4' : '#f0fdfa',
                                border:`1.5px solid ${blocked ? '#e2e8f0' : over ? '#fed7aa' : full ? '#bbf7d0' : '#ccfbf1'}`,
                                color: blocked ? '#94a3b8' : over ? '#d97706' : full ? '#16a34a' : '#0d9488',
                              }}>
                                <span>{icon} {label}</span>
                                {blocked
                                  ? <span style={{ fontSize:'0.7rem', marginRight:'2px' }}>غير مضمّن</span>
                                  : <span style={{ marginRight:'2px' }}>{selected}/{limit} {over ? '⚠️' : full ? '✅' : ''}</span>
                                }
                              </div>
                            );
                          })}
                          <div style={{
                            display:'flex', alignItems:'center', gap:'6px',
                            padding:'6px 12px', borderRadius:'999px', fontSize:'0.8rem', fontWeight:700,
                            background:'#f8fafc', border:'1.5px solid #e2e8f0', color:'#475569',
                          }}>
                            🍽️ {mealSub.bundleType === 'flex'
                              ? `${totalMealsWithoutSnacks}/${mealSub.mealsNumber ?? '∞'} وجبة + ${(clientMeals['سناك']||[]).length}/${mealSub.snacksNumber ?? '∞'} سناك`
                              : `${totalSelected} / ${(mealSub.mealsNumber ?? 0) + (mealSub.snacksNumber ?? 0)} إجمالي`
                            }
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                    {/* المنيو */}
                    <div className="card">
                      <div className="card-header">
                        <h3>📋 منيو اليوم</h3>
                        <span className="badge badge-teal">{menuMeals.length} وجبة</span>
                      </div>
                      <div style={{ padding:'12px', maxHeight:'450px', overflowY:'auto' }}>
                        {MEAL_SECTIONS.map(sec => {
                          const meals    = menuMeals.filter(m => m.mealType === sec.key);
                          const selCount = (clientMeals[sec.key] || []).length;
                          if (!meals.length) return null;
                          return (
                            <div key={sec.key} style={{ marginBottom:'12px' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #e2e8f0', paddingBottom:'4px', marginBottom:'6px' }}>
                                <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#64748b' }}>
                                  {sec.icon} {sec.label}
                                </span>
                                {selCount > 0 && (
                                  <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#0d9488', background:'#f0fdfa', padding:'1px 7px', borderRadius:'999px' }}>
                                    {selCount} مختار
                                  </span>
                                )}
                              </div>
                              {meals.map(meal => {
                                const selected = isMealSelected(meal);
                                return (
                                  <label key={meal.id} style={{
                                    display:'flex', alignItems:'center', gap:'10px',
                                    padding:'7px 10px', borderRadius:'8px', cursor:'pointer',
                                    background: selected ? '#f0fdfa' : 'transparent',
                                    border: selected ? '1px solid #ccfbf1' : '1px solid transparent',
                                    marginBottom:'3px', transition:'all 0.15s',
                                  }}>
                                    <input type="checkbox" checked={selected}
                                      onChange={() => toggleMeal(meal)}
                                      style={{ accentColor:'#0d9488', width:'16px', height:'16px' }} />
                                    <div style={{ flex:1 }}>
                                      <div style={{ fontSize:'0.88rem', fontWeight:600 }}>{meal.mealTitle}</div>
                                      <div style={{ fontSize:'0.72rem', color:'#94a3b8' }}>
                                        P{meal.protein} | C{meal.carbs} | {meal.calories} cal
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* الاختيارات */}
                    <div className="card">
                      <div className="card-header">
                        <h3>✅ اختيارات {client.name}</h3>
                        <span className="badge badge-teal">{totalSelected} وجبة</span>
                      </div>
                      <div style={{ padding:'12px', maxHeight:'450px', overflowY:'auto' }}>
                        {totalSelected === 0 ? (
                          <div className="empty-state">
                            <div className="empty-icon">🍽️</div>
                            <h3>لم يتم اختيار وجبات</h3>
                            <p>اختر من القائمة على اليسار</p>
                          </div>
                        ) : (
                          MEAL_SECTIONS.map(sec => {
                            const selected = clientMeals[sec.key] || [];
                            if (!selected.length) return null;
                            return (
                              <div key={sec.key} style={{ marginBottom:'14px' }}>
                                <div style={{ fontSize:'0.82rem', fontWeight:700, color:'#0f766e', marginBottom:'6px' }}>
                                  {sec.icon} {sec.label}
                                  <span className="badge badge-teal" style={{ marginRight:'8px' }}>{selected.length}</span>
                                </div>
                                {selected.map(m => (
                                  <div key={m.id} style={{
                                    display:'flex', justifyContent:'space-between', alignItems:'center',
                                    padding:'7px 12px', background:'#f0fdfa', borderRadius:'8px',
                                    marginBottom:'4px', fontSize:'0.88rem', fontWeight:600,
                                    border:'1px solid #ccfbf1',
                                  }}>
                                    <span>{m.title}</span>
                                    <button style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444' }}
                                      onClick={() => { const meal = MEALS_DATA.find(x => x.id === m.id); if (meal) toggleMeal(meal); }}>
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </div>
                            );
                          })
                        )}
                        {totalSelected > 0 && (
                          <button className="btn btn-primary btn-full" onClick={saveMeals} disabled={savingMeals} style={{ marginTop:'12px' }}>
                            {savingMeals ? 'جاري الحفظ...' : `✅ حفظ وجبات ${mealDate}`}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  </div>
                )}

                {menuMeals.length === 0 && !loadingMeals && (
                  <div className="card">
                    <div className="empty-state">
                      <div className="empty-icon">📋</div>
                      <h3>اضغط "تحميل المنيو" لعرض وجبات اليوم</h3>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          );
        })()}

        {/* ── تاب التقويم ── */}
        {activeTab === 'التقويم' && (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>اختر الاشتراك</div>
              {subscriptions.map(s => {
                const st = getSubscriptionStatus(s);
                const stl = getStatusLabel(st);
                return (
                  <div key={s.id} onClick={() => setSelectedSub(s)}
                    style={{
                      padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', marginBottom: '8px',
                      border: selectedSub?.id === s.id ? '2px solid #0d9488' : '1.5px solid #e2e8f0',
                      background: selectedSub?.id === s.id ? '#f0fdfa' : 'white',
                    }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.packageName}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{s.startDate} → {s.endDate}</div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: stl.color, background: stl.bg, padding: '1px 7px', borderRadius: '999px', display: 'inline-block', marginTop: '3px' }}>{stl.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="card" style={{ padding: '20px' }}>
              {selectedSub ? renderCalendar() : <div className="empty-state"><h3>اختر اشتراكاً</h3></div>}
            </div>
          </div>
        )}

        {/* ── المدفوعات ── */}
        {activeTab === 'المدفوعات' && (
          <div className="card">
            <div className="card-header"><h3>سجل المدفوعات</h3></div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>التاريخ</th><th>الباقة</th><th>المبلغ</th><th>طريقة الدفع</th><th>الحالة</th></tr></thead>
                <tbody>
                  {subscriptions.flatMap(s => (s.payments||[]).map((p,i) => (
                    <tr key={`${s.id}-${i}`}>
                      <td>{p.date||'---'}</td>
                      <td>{s.packageName}</td>
                      <td><strong>{p.amount} KWD</strong></td>
                      <td>{p.method}</td>
                      <td><span className="badge badge-green">مدفوع</span></td>
                    </tr>
                  )))}
                  {subscriptions.every(s=>!s.payments?.length) && (
                    <tr><td colSpan={5}><div className="empty-state"><h3>لا يوجد مدفوعات</h3></div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── البيانات ── */}
        {activeTab === 'البيانات' && (
          <div className="card">
            <div className="card-header">
              <h3>بيانات العميل</h3>
              {!editingClient ? (
                <button className="btn btn-outline btn-sm" onClick={startEditClient}>
                  ✏️ تعديل البيانات
                </button>
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-primary btn-sm" onClick={saveClientEdit} disabled={savingClient}>
                    {savingClient ? 'جاري الحفظ...' : '✅ حفظ'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingClient(false)}>إلغاء</button>
                </div>
              )}
            </div>
            <div className="card-body">
              {!editingClient ? (
                /* ── عرض البيانات ── */
                <div className="form-grid">
                  {[
                    ['الاسم', client.name], ['الهاتف', client.phone],
                    ['الإيميل', client.email], ['الجنس', client.gender === 'male' ? 'ذكر' : client.gender === 'female' ? 'أنثى' : client.gender],
                    ['المحافظة', client.governorate], ['المنطقة', client.region],
                    ['القطعة', client.block], ['الشارع', client.street],
                    ['الجادة', client.alley], ['المنزل', client.building],
                    ['الدور', client.floor], ['الشقة', client.apartment],
                    ['الموانع الغذائية', client.allergy], ['ملاحظة التوصيل', client.deliveryNote],
                  ].map(([l, v]) => (
                    <div key={l} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{l}</div>
                      <div style={{ fontWeight: 600, marginTop: '2px' }}>{v || '---'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ── نموذج التعديل ── */
                <div>
                  <div className="section-title">البيانات الأساسية</div>
                  <div className="form-grid" style={{ marginBottom: '20px' }}>
                    <div className="form-group">
                      <label className="form-label">الاسم الكامل</label>
                      <input className="form-control" value={clientForm.name}
                        onChange={e => setClientForm(p => ({...p, name: e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">رقم الهاتف</label>
                      <input className="form-control" value={clientForm.phone}
                        onChange={e => setClientForm(p => ({...p, phone: e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">البريد الإلكتروني</label>
                      <input className="form-control" type="email" value={clientForm.email}
                        onChange={e => setClientForm(p => ({...p, email: e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">الجنس</label>
                      <select className="form-control" value={clientForm.gender}
                        onChange={e => setClientForm(p => ({...p, gender: e.target.value}))}>
                        <option value="">-- اختر --</option>
                        <option value="male">ذكر</option>
                        <option value="female">أنثى</option>
                      </select>
                    </div>
                    <div className="form-group full-width">
                      <label className="form-label">الموانع الغذائية</label>
                      <input className="form-control" placeholder="مثال: لا حليب، لا جلوتين"
                        value={clientForm.allergy}
                        onChange={e => setClientForm(p => ({...p, allergy: e.target.value}))} />
                    </div>
                    <div className="form-group full-width">
                      <label className="form-label">ملاحظة التوصيل</label>
                      <input className="form-control" placeholder="مثال: الباب الخلفي"
                        value={clientForm.deliveryNote}
                        onChange={e => setClientForm(p => ({...p, deliveryNote: e.target.value}))} />
                    </div>
                  </div>

                  <div className="section-title">العنوان</div>
                  <div className="form-grid" style={{ marginBottom: '20px' }}>
                    <div className="form-group">
                      <label className="form-label">المحافظة</label>
                      <select className="form-control" value={clientForm.governorate}
                        onChange={e => setClientForm(p => ({...p, governorate: e.target.value, region: ''}))}>
                        <option value="">-- اختر --</option>
                        {REGIONS_DATA.map(g => (
                          <option key={g.key} value={g.nameAr}>{g.nameAr}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">المنطقة</label>
                      <select className="form-control" value={clientForm.region}
                        onChange={e => setClientForm(p => ({...p, region: e.target.value}))}>
                        <option value="">-- اختر --</option>
                        {regions.map(r => (
                          <option key={r.nameEn} value={r.nameAr}>{r.nameAr}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">القطعة</label>
                      <input className="form-control" value={clientForm.block}
                        onChange={e => setClientForm(p => ({...p, block: e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">الشارع</label>
                      <input className="form-control" value={clientForm.street}
                        onChange={e => setClientForm(p => ({...p, street: e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">الجادة</label>
                      <input className="form-control" value={clientForm.alley}
                        onChange={e => setClientForm(p => ({...p, alley: e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">المنزل</label>
                      <input className="form-control" value={clientForm.building}
                        onChange={e => setClientForm(p => ({...p, building: e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">الدور</label>
                      <input className="form-control" value={clientForm.floor}
                        onChange={e => setClientForm(p => ({...p, floor: e.target.value}))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">الشقة</label>
                      <input className="form-control" value={clientForm.apartment}
                        onChange={e => setClientForm(p => ({...p, apartment: e.target.value}))} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal: إضافة اشتراك ── */}
      {showAddSub && (
        <div className="modal-overlay" onClick={() => setShowAddSub(false)}>
          <div className="modal" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>+ اشتراك جديد</h3>
              <button className="modal-close" onClick={() => setShowAddSub(false)}>X</button>
            </div>
            <div className="modal-body">
              <SubForm form={subForm} setForm={setSubForm} packages={packages} calcEndDate={calcEndDate} />
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleAddSub}>حفظ الاشتراك</button>
                <button className="btn btn-ghost" onClick={() => setShowAddSub(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: تجديد ── */}
      {showRenew && (
        <div className="modal-overlay" onClick={() => setShowRenew(false)}>
          <div className="modal" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>↩️ تجديد الاشتراك</h3>
              <button className="modal-close" onClick={() => setShowRenew(false)}>X</button>
            </div>
            <div className="modal-body">
              {/* معلومات التاريخ */}
              {(() => {
                const active = subscriptions.find(s => getSubscriptionStatus(s) === 'active');
                const dayAfterEnd = active?.endDate ? (() => {
                  const d = new Date(active.endDate); d.setDate(d.getDate() + 1);
                  return d.toISOString().split('T')[0];
                })() : null;
                return dayAfterEnd ? (
                  <div style={{ background:'#f0fdfa', border:'1px solid #ccfbf1', borderRadius:'10px', padding:'12px 16px', marginBottom:'16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px' }}>
                      <span style={{ fontSize:'0.82rem', color:'#64748b' }}>أقرب تاريخ للتجديد</span>
                      <span style={{ fontSize:'0.75rem', background:'#dcfce7', color:'#16a34a', padding:'2px 8px', borderRadius:'999px', fontWeight:700 }}>داش بورد — حر ✓</span>
                    </div>
                    <div style={{ fontWeight:800, fontSize:'1.05rem', color:'#0d9488' }}>{dayAfterEnd}</div>
                    <div style={{ fontSize:'0.78rem', color:'#64748b', marginTop:'4px' }}>
                      📅 يوم بعد انتهاء الاشتراك الحالي ({active.endDate}) — يمكنك اختيار أي تاريخ بعده
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="radio-group" style={{ marginBottom: '16px' }}>
                <div className="radio-option">
                  <input type="radio" id="same" name="rt" checked={renewType==='same'} onChange={() => setRenewType('same')} />
                  <label htmlFor="same">نفس الباقة</label>
                </div>
                <div className="radio-option">
                  <input type="radio" id="new" name="rt" checked={renewType==='new'} onChange={() => setRenewType('new')} />
                  <label htmlFor="new">باقة جديدة</label>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">تاريخ بداية التجديد</label>
                <input className="form-control" type="date" value={subForm.startDate}
                  min={(() => {
                    const active = subscriptions.find(s => getSubscriptionStatus(s) === 'active');
                    if (!active?.endDate) return '';
                    const d = new Date(active.endDate); d.setDate(d.getDate() + 1);
                    return d.toISOString().split('T')[0];
                  })()}
                  onChange={e => setSubForm(p => ({...p, startDate: e.target.value}))} />
                <div style={{ fontSize:'0.75rem', color:'#94a3b8', marginTop:'4px' }}>
                  ⚠️ يجب أن يكون بعد انتهاء الاشتراك الحالي
                </div>
              </div>

              {renewType === 'new' && <SubForm form={subForm} setForm={setSubForm} packages={packages} calcEndDate={calcEndDate} />}
              <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleRenew}>تأكيد التجديد</button>
                <button className="btn btn-ghost" onClick={() => setShowRenew(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: تغيير الوجبات ── */}
      {showChangeMeals && (
        <div className="modal-overlay" onClick={() => setShowChangeMeals(false)}>
          <div className="modal" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Change Meals Number</h3>
              <button className="modal-close" onClick={() => setShowChangeMeals(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ marginBottom: '16px' }}>
                {[['mealsNumber','Meals Number',1],['snacksNumber','Snacks Number',0]].map(([key,label,min]) => (
                  <div key={key} className="form-group">
                    <label className="form-label">{label}</label>
                    <div className="number-input">
                      <button type="button" onClick={() => setMealsForm(p => ({...p, [key]: Math.max(min, p[key]-1)}))}>-</button>
                      <input type="number" value={mealsForm[key]} readOnly />
                      <button type="button" onClick={() => setMealsForm(p => ({...p, [key]: p[key]+1}))}>+</button>
                    </div>
                  </div>
                ))}
              </div>
              {[['allowedBreakfast','Allowed Breakfast'],['allowedLunch','Allowed Lunch'],['allowedDinner','Allowed Dinner']].map(([key,label]) => (
                <div key={key} className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label">{label}</label>
                  <div className="number-input">
                    <button type="button" onClick={() => setMealsForm(p => ({...p, [key]: Math.max(0, p[key]-1)}))}>-</button>
                    <input type="number" value={mealsForm[key]} readOnly />
                    <button type="button" onClick={() => setMealsForm(p => ({...p, [key]: p[key]+1}))}>+</button>
                  </div>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button className="btn" style={{ background: 'white', color: '#ef4444', border: '1.5px solid #ef4444', justifyContent: 'center' }} onClick={() => setShowChangeMeals(false)}>✕ Cancel</button>
                <button className="btn btn-primary" style={{ justifyContent: 'center' }} onClick={handleChangeMeals}>✓ Apply Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: + / - أيام ── */}
      {showDaysModal && (
        <div className="modal-overlay" onClick={() => setShowDaysModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>تعديل الأيام</h3>
              <button className="modal-close" onClick={() => setShowDaysModal(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="radio-group" style={{ marginBottom: '16px' }}>
                <div className="radio-option">
                  <input type="radio" id="add" name="dt" checked={daysAction.type==='add'} onChange={() => setDaysAction(p=>({...p,type:'add'}))} />
                  <label htmlFor="add">إضافة أيام Bonus</label>
                </div>
                <div className="radio-option">
                  <input type="radio" id="remove" name="dt" checked={daysAction.type==='remove'} onChange={() => setDaysAction(p=>({...p,type:'remove'}))} />
                  <label htmlFor="remove">خصم أيام</label>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">عدد الأيام</label>
                <div className="number-input">
                  <button type="button" onClick={() => setDaysAction(p=>({...p,days:Math.max(1,p.days-1)}))}>-</button>
                  <input type="number" value={daysAction.days} readOnly />
                  <button type="button" onClick={() => setDaysAction(p=>({...p,days:p.days+1}))}>+</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleDaysAction}>
                  {daysAction.type==='add' ? `+ إضافة ${daysAction.days} يوم` : `- خصم ${daysAction.days} يوم`}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowDaysModal(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: دفعة ── */}
      {showPayment && (
        <div className="modal-overlay" onClick={() => setShowPayment(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>تسجيل دفعة</h3>
              <button className="modal-close" onClick={() => setShowPayment(false)}>X</button>
            </div>
            <div className="modal-body">
              <div className="form-grid col-1">
                <div className="form-group">
                  <label className="form-label">طريقة الدفع</label>
                  <select className="form-control" value={paymentForm.method}
                    onChange={e => setPaymentForm(p=>({...p,method:e.target.value}))}>
                    {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">المبلغ (KWD)</label>
                  <input className="form-control" type="number" placeholder="0.000"
                    value={paymentForm.amount}
                    onChange={e => setPaymentForm(p=>({...p,amount:e.target.value}))} />
                </div>
                <div className="form-group">
                  <label className="form-label">ملاحظات</label>
                  <input className="form-control" placeholder="اختياري"
                    value={paymentForm.notes}
                    onChange={e => setPaymentForm(p=>({...p,notes:e.target.value}))} />
                </div>
                <button className="btn btn-primary btn-full" onClick={handleAddPayment}>تسجيل الدفعة</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: تأكيد الحذف ── */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>🗑 حذف الاشتراك</h3>
              <button className="modal-close" onClick={() => setShowDeleteConfirm(false)}>X</button>
            </div>
            <div className="modal-body">
              <p style={{ textAlign: 'center', marginBottom: '8px' }}>
                هل أنت متأكد من حذف اشتراك
                <strong style={{ color: '#ef4444' }}> {selectedSub?.packageName}</strong>؟
              </p>
              <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '20px' }}>
                لا يمكن التراجع عن هذا الإجراء
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-primary" style={{ background: '#ef4444', borderColor: '#ef4444', flex: 1 }} onClick={handleDeleteSub}>
                  نعم، احذف
                </button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowDeleteConfirm(false)}>
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: تجميد نطاق تواريخ ── */}
      {showFreezeRange && (
        <div className="modal-overlay" onClick={() => setShowFreezeRange(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>❄ تجميد أيام</h3>
              <button className="modal-close" onClick={() => setShowFreezeRange(false)}>X</button>
            </div>
            <div className="modal-body">
              <p style={{ textAlign:'center', fontSize:'0.85rem', color:'#64748b', marginBottom:'16px' }}>
                اختر نطاق الأيام — سيتم تمديد الاشتراك تلقائياً بعدد الأيام المجمدة
              </p>
              <div className="form-grid" style={{ marginBottom:'12px' }}>
                <div className="form-group">
                  <label className="form-label">📅 من تاريخ</label>
                  <input className="form-control" type="date"
                    min={selectedSub?.startDate} max={selectedSub?.endDate}
                    value={freezeRange.from}
                    onChange={e => setFreezeRange(p => ({ ...p, from: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">📅 لتاريخ</label>
                  <input className="form-control" type="date"
                    min={freezeRange.from || selectedSub?.startDate} max={selectedSub?.endDate}
                    value={freezeRange.to}
                    onChange={e => setFreezeRange(p => ({ ...p, to: e.target.value }))} />
                </div>
              </div>

              {/* معاينة عدد الأيام */}
              {freezeRange.from && freezeRange.to && freezeRange.from <= freezeRange.to && (() => {
                const from = new Date(freezeRange.from);
                const to   = new Date(freezeRange.to);
                const totalDays = Math.floor((to - from) / (1000*60*60*24)) + 1;
                const alreadyFrozen = (selectedSub?.frozenDays || []).filter(d => d >= freezeRange.from && d <= freezeRange.to).length;
                const newDays = totalDays - alreadyFrozen;
                return (
                  <div style={{ background:'#f0fdfa', border:'1px solid #ccfbf1', borderRadius:'10px', padding:'12px 16px', marginBottom:'16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', color:'#64748b', marginBottom:'6px' }}>
                      <span>إجمالي الأيام المختارة</span>
                      <strong>{totalDays} يوم</strong>
                    </div>
                    {alreadyFrozen > 0 && (
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.82rem', color:'#d97706', marginBottom:'6px' }}>
                        <span>❄ مجمدة مسبقاً</span>
                        <strong>{alreadyFrozen} يوم</strong>
                      </div>
                    )}
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.88rem', color:'#0d9488', borderTop:'1px solid #ccfbf1', paddingTop:'6px', marginTop:'4px' }}>
                      <span style={{ fontWeight:700 }}>سيتم تجميد</span>
                      <strong style={{ fontWeight:800 }}>{newDays} يوم جديد ❄</strong>
                    </div>
                    {newDays > 0 && (
                      <div style={{ fontSize:'0.75rem', color:'#94a3b8', marginTop:'4px', textAlign:'center' }}>
                        سيمتد الاشتراك حتى {(() => {
                          const end = new Date(selectedSub?.endDate || '');
                          end.setDate(end.getDate() + newDays);
                          return end.toISOString().split('T')[0];
                        })()}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div style={{ display:'flex', gap:'12px' }}>
                <button className="btn btn-primary"
                  style={{ background:'#0d9488', borderColor:'#0d9488', flex:1 }}
                  disabled={!freezeRange.from || !freezeRange.to || freezeRange.from > freezeRange.to}
                  onClick={handleFreezeRange}>
                  ❄ تجميد الأيام
                </button>
                <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setShowFreezeRange(false)}>
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: تأكيد التجميد (احتياطي) ── */}
      {showPauseConfirm && (
        <div className="modal-overlay" onClick={() => setShowPauseConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>⏸ تجميد الاشتراك</h3>
              <button className="modal-close" onClick={() => setShowPauseConfirm(false)}>X</button>
            </div>
            <div className="modal-body">
              <p style={{ textAlign: 'center', marginBottom: '8px' }}>
                هل تريد تجميد اشتراك
                <strong style={{ color: '#f59e0b' }}> {selectedSub?.packageName}</strong>؟
              </p>
              <p style={{ textAlign: 'center', fontSize: '0.82rem', color: '#94a3b8', marginBottom: '20px' }}>
                سيتغير الاشتراك إلى حالة "مجمد" ويمكن إعادة تفعيله لاحقاً
              </p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-primary" style={{ background: '#f59e0b', borderColor: '#f59e0b', flex: 1 }} onClick={handlePauseSub}>
                  نعم، جمّد
                </button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowPauseConfirm(false)}>
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: إعدادات التجديد ── */}
      {showRenewalSettings && (
        <div className="modal-overlay" onClick={() => setShowRenewalSettings(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>⚙️ إعدادات التجديد</h3>
              <button className="modal-close" onClick={() => setShowRenewalSettings(false)}>X</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '20px' }}>
                حدد كم ساعة قبل اليوم الحالي يُسمح للعميل بالتجديد — التاريخ الفعلي للاشتراك الجديد سيكون دائماً يوم بعد انتهاء الاشتراك الحالي أو اليوم + هذه المدة، أيهما أبعد.
              </p>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">مدة التجهيز (بالساعات)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input className="form-control" type="number" min="0" max="720" step="24"
                    value={renewalSettings.leadHours}
                    onChange={e => setRenewalSettings(p => ({ ...p, leadHours: parseInt(e.target.value) || 0 }))}
                    style={{ flex: 1 }} />
                  <span style={{ color: '#64748b', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                    = {(renewalSettings.leadHours / 24).toFixed(1)} يوم
                  </span>
                </div>
              </div>

              {/* اختصارات سريعة */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                {[24, 48, 72, 96, 120].map(h => (
                  <button key={h}
                    onClick={() => setRenewalSettings(p => ({ ...p, leadHours: h }))}
                    style={{
                      padding: '6px 14px', borderRadius: '999px', border: '1.5px solid',
                      fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
                      fontFamily: 'var(--font-main)',
                      borderColor: renewalSettings.leadHours === h ? '#0d9488' : '#e2e8f0',
                      background: renewalSettings.leadHours === h ? '#f0fdfa' : 'white',
                      color: renewalSettings.leadHours === h ? '#0d9488' : '#64748b',
                    }}>
                    {h}س ({h/24}ي)
                  </button>
                ))}
              </div>

              {/* مثال توضيحي */}
              <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', marginBottom: '20px', fontSize: '0.8rem', color: '#64748b' }}>
                <div style={{ fontWeight: 700, marginBottom: '6px', color: '#475569' }}>📌 مثال توضيحي:</div>
                {(() => {
                  const today = new Date();
                  const ex1End = new Date(today); ex1End.setDate(ex1End.getDate() + 5);
                  const ex1Min = calcRenewalStartDate({ endDate: ex1End.toISOString().split('T')[0] }, renewalSettings.leadHours);
                  const ex2End = new Date(today); ex2End.setDate(ex2End.getDate() + 2);
                  const ex2Min = calcRenewalStartDate({ endDate: ex2End.toISOString().split('T')[0] }, renewalSettings.leadHours);
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>اشتراك ينتهي <strong>{ex1End.toISOString().split('T')[0]}</strong> → أول يوم للتجديد: <strong style={{ color: '#0d9488' }}>{ex1Min}</strong></div>
                      <div>اشتراك ينتهي <strong>{ex2End.toISOString().split('T')[0]}</strong> → أول يوم للتجديد: <strong style={{ color: '#0d9488' }}>{ex2Min}</strong></div>
                    </div>
                  );
                })()}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveRenewalSettings} disabled={savingSettings}>
                  {savingSettings ? 'جاري الحفظ...' : '✅ حفظ الإعدادات'}
                </button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowRenewalSettings(false)}>إلغاء</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── SubCard ──
function SubCard({ sub, onCalendar }) {
  const status = getSubscriptionStatus(sub);
  const stl = getStatusLabel(status);
  const daysLeft = Math.max(0, Math.ceil((new Date(sub.endDate) - new Date()) / (1000*60*60*24)));
  return (
    <div style={{ padding:'16px 20px', borderRadius:'10px', border:'1.5px solid #e2e8f0', background:'white', marginBottom:'10px', borderRight:`4px solid ${stl.color}` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:'1rem' }}>{sub.packageName}</div>
          <div style={{ fontSize:'0.8rem', color:'#64748b', marginTop:'4px' }}>
            {sub.startDate} → {sub.endDate}
            {status === 'active' && <span style={{ marginRight:'8px', color:'#0d9488', fontWeight:600 }}>({daysLeft} يوم متبقي)</span>}
          </div>
          <div style={{ fontSize:'0.78rem', color:'#94a3b8', marginTop:'4px' }}>
            P{sub.protein} / C{sub.carbs} • {sub.mealsNumber} وجبة / {sub.snacksNumber} سناك
            {(sub.frozenDays||[]).length > 0 && <span style={{ color:'#d97706', marginRight:'8px' }}>❄ {sub.frozenDays.length} مجمد</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <span style={{ fontSize:'0.78rem', fontWeight:700, color:stl.color, background:stl.bg, padding:'4px 12px', borderRadius:'999px' }}>{stl.label}</span>
          {onCalendar && <button className="btn btn-outline btn-sm" onClick={onCalendar}>التقويم</button>}
        </div>
      </div>
    </div>
  );
}

// ── SubForm ──
function SubForm({ form, setForm, packages, calcEndDate }) {
  const update = (k, v) => setForm(p => ({...p, [k]: v}));
  return (
    <div>
      <div className="section-title">نوع الباقة</div>
      <div className="radio-group" style={{ marginBottom:'16px' }}>
        <div className="radio-option">
          <input type="radio" id="f-normal" name="sbt" checked={form.bundleType==='normal'} onChange={() => update('bundleType','normal')} />
          <label htmlFor="f-normal">باقة ثابتة</label>
        </div>
        <div className="radio-option">
          <input type="radio" id="f-flex" name="sbt" checked={form.bundleType==='flex'} onChange={() => update('bundleType','flex')} />
          <label htmlFor="f-flex">باقة مرنة</label>
        </div>
      </div>
      {form.bundleType === 'normal' ? (
        <div className="form-group" style={{ marginBottom:'16px' }}>
          <label className="form-label">اختر الباقة</label>
          <select className="form-control" value={form.packageId}
            onChange={e => {
              const pkg = packages.find(p => p.id === e.target.value);
              setForm(p => ({...p, packageId: e.target.value, protein: pkg?.protein||'', carbs: pkg?.carbohydrates||'', mealsNumber: pkg?.mealsNumber||3, snacksNumber: pkg?.snacksNumber||1, allowedBreakfast: pkg?.allowedBreakfast||2, allowedLunch: pkg?.allowedLunch||2, allowedDinner: pkg?.allowedDinner||2}));
            }}>
            <option value="">-- اختر الباقة --</option>
            {packages.map(p => <option key={p.id} value={p.id}>{p.nameAr}</option>)}
          </select>
        </div>
      ) : (
        <div>
          {/* أنواع الوجبات المسموحة */}
          <div className="section-title" style={{ marginBottom: '10px' }}>أنواع الوجبات المسموحة</div>
          <div className="checkbox-row" style={{ marginBottom: '16px' }}>
            {[
              { key: 'allowBreakfast', label: '🍳 الفطور' },
              { key: 'allowLunch',     label: '🍛 الغداء' },
              { key: 'allowDinner',    label: '🌙 العشاء' },
              { key: 'allowSnacks',    label: '🥗 السناك' },
            ].map(({ key, label }) => (
              <label key={key} className="checkbox-item">
                <input type="checkbox"
                  checked={form[key] !== false}
                  onChange={e => update(key, e.target.checked)} />
                <label>{label}</label>
              </label>
            ))}
          </div>

          {/* الجرامات والأعداد */}
          <div className="form-grid" style={{ marginBottom: '16px' }}>
            <div className="form-group"><label className="form-label">البروتين (جرام)</label><input className="form-control" type="number" value={form.protein} onChange={e=>update('protein',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">الكارب (جرام)</label><input className="form-control" type="number" value={form.carbs} onChange={e=>update('carbs',e.target.value)} /></div>
            <div className="form-group"><label className="form-label">عدد الوجبات</label><input className="form-control" type="number" value={form.mealsNumber} onChange={e=>update('mealsNumber',parseInt(e.target.value))} /></div>
            <div className="form-group"><label className="form-label">عدد السناك</label><input className="form-control" type="number" value={form.snacksNumber} onChange={e=>update('snacksNumber',parseInt(e.target.value))} /></div>
          </div>
        </div>
      )}
      <div className="form-grid" style={{ marginBottom:'16px' }}>
        <div className="form-group">
          <label className="form-label">تاريخ البدء</label>
          <input className="form-control" type="date" value={form.startDate}
            onChange={e => { update('startDate', e.target.value); update('endDate', calcEndDate(e.target.value, form.durationWeeks)); }} />
        </div>
        <div className="form-group">
          <label className="form-label">المدة</label>
          <select className="form-control" value={form.durationWeeks}
            onChange={e => { const w=parseInt(e.target.value); update('durationWeeks',w); update('endDate',calcEndDate(form.startDate,w)); }}>
            {[1,2,3,4,6,8,12].map(w => <option key={w} value={w}>{w} {w===1?'أسبوع':'أسابيع'}</option>)}
          </select>
        </div>
        {form.endDate && (
          <div className="form-group" style={{ gridColumn:'1/-1' }}>
            <label className="form-label">تاريخ الانتهاء</label>
            <input className="form-control" value={form.endDate} readOnly style={{ background:'#f0fdfa', color:'#0f766e', fontWeight:700 }} />
          </div>
        )}
      </div>
      <div className="section-title">الدفع</div>
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label">طريقة الدفع</label>
          <select className="form-control" value={form.paymentMethod} onChange={e=>update('paymentMethod',e.target.value)}>
            {PAYMENT_METHODS.map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        {form.paymentMethod !== 'آجل' && (
          <div className="form-group">
            <label className="form-label">المبلغ (KWD)</label>
            <input className="form-control" type="number" placeholder="0.000" value={form.paymentAmount} onChange={e=>update('paymentAmount',e.target.value)} />
          </div>
        )}
      </div>
    </div>
  );
}
