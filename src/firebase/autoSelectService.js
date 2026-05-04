import { db } from './config';
import {
  doc, getDoc, setDoc, getDocs,
  collection, serverTimestamp
} from 'firebase/firestore';
import { MEALS_DATA, getMenuDay, saveClientDailyMeals, getClientDailyMeals, getMeals } from './mealService';
import { getAllSubscriptions, getSubscriptionStatus } from './subscriptionService';
import { getClients } from './clientService';
import { getPackages } from './packageService';

const SETTINGS_DOC = 'autoSelectSettings';
const LOG_DOC      = 'autoSelectLog';
const CONFIG_COLLECTION = 'appConfig';

// ─────────────────────────────────────────────
// إعدادات الـ Auto-Select
// ─────────────────────────────────────────────
export const getAutoSelectSettings = async () => {
  const snap = await getDoc(doc(db, CONFIG_COLLECTION, SETTINGS_DOC));
  return snap.exists() ? snap.data() : {
    enabled:     true,
    offsetHours: 48,       // قبل التوصيل بـ 48 ساعة
    runHour:     0,        // الساعة 12 صباحاً
    runMinute:   0,
    lastRun:     null,
    lastRunCount: 0,
  };
};

export const saveAutoSelectSettings = async (settings) => {
  await setDoc(doc(db, CONFIG_COLLECTION, SETTINGS_DOC), {
    ...settings,
    updatedAt: serverTimestamp(),
  });
};

// ─────────────────────────────────────────────
// سجل التشغيل
// ─────────────────────────────────────────────
export const getAutoSelectLog = async () => {
  const snap = await getDoc(doc(db, CONFIG_COLLECTION, LOG_DOC));
  return snap.exists() ? snap.data() : { runs: [] };
};

const saveLog = async (entry) => {
  const current = await getAutoSelectLog();
  const runs = [entry, ...(current.runs || [])].slice(0, 50); // آخر 50 تشغيل
  await setDoc(doc(db, CONFIG_COLLECTION, LOG_DOC), { runs });
};

// ─────────────────────────────────────────────
// حساب يوم الدورة
// ─────────────────────────────────────────────
const getCycleDayKey = (startDate, targetDate) => {
  const start  = new Date(startDate);
  const target = new Date(targetDate);
  const diffDays   = Math.floor((target - start) / (1000 * 60 * 60 * 24));
  const dayInCycle = ((diffDays % 28) + 28) % 28;
  const week       = Math.floor(dayInCycle / 7) + 1;
  const DAYS       = ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
  const dayMap     = [1, 2, 3, 4, 5, 6, 0];
  const dayIdx     = dayMap[target.getDay()];
  return `w${week}_${DAYS[dayIdx]}`;
};

// ─────────────────────────────────────────────
// اختيار وجبات من منيو الشيف
// ─────────────────────────────────────────────
const autoSelectMealsForClient = async (clientId, deliveryDate, activeSub, allMeals) => {
  const existing = await getClientDailyMeals(clientId, deliveryDate) || {
    افطار: [], غداء: [], عشاء: [], سناك: []
  };

  const dayKey = getCycleDayKey(activeSub.startDate || deliveryDate, deliveryDate);

  let menuDay = await getMenuDay('chef', dayKey);
  if (!menuDay?.meals?.length) menuDay = await getMenuDay('default', dayKey);
  if (!menuDay?.meals?.length) return false;

  const meals = menuDay.meals
    .map(id => allMeals.find(m => m.id === id) || MEALS_DATA.find(m => m.id === id))
    .filter(Boolean);

  // ── 1. الأنواع المسموحة ──
  const allowMap = {
    افطار: activeSub.allowBreakfast !== false,
    غداء:  activeSub.allowLunch     !== false,
    عشاء:  activeSub.allowDinner    !== false,
    سناك:  activeSub.allowSnacks    !== false,
  };

  // ── 2. الأعداد المحددة لكل نوع ──
  // باقة ثابتة: allowedBreakfast/Lunch/Dinner محددة من إعدادات الباقة
  // باقة مرنة:  allowedBreakfast/Lunch/Dinner محددة من اختيار العميل في الاشتراك
  // في الحالتين نفس الحقول — الكرون يلتزم بيها مباشرة
  const maxPerType = {
    افطار: !allowMap['افطار'] ? 0 : (activeSub.allowedBreakfast ?? 0),
    غداء:  !allowMap['غداء']  ? 0 : (activeSub.allowedLunch     ?? activeSub.mealsNumber ?? 0),
    عشاء:  !allowMap['عشاء']  ? 0 : (activeSub.allowedDinner    ?? 0),
    سناك:  !allowMap['سناك']  ? 0 : (activeSub.snacksNumber     ?? 0),
  };

  // ── 3. المتاح في المنيو لكل نوع ──
  const availableByType = {
    افطار: meals.filter(m => m.mealType === 'افطار'),
    غداء:  meals.filter(m => m.mealType === 'غداء'),
    عشاء:  meals.filter(m => m.mealType === 'عشاء'),
    سناك:  meals.filter(m => m.mealType === 'سناك'),
  };

  // ── 4. بناء الاختيارات مع مراعاة الحد الكلي للوجبات ──
  const mealsLimit = activeSub.mealsNumber ?? 999; // إجمالي وجبات الباقة اليومية
  let mealsBudget  = mealsLimit;

  // استهلك ما هو موجود مسبقاً من الوجبات الرئيسية
  const existingMealsTotal =
    (existing['افطار']?.length || 0) +
    (existing['غداء']?.length  || 0) +
    (existing['عشاء']?.length  || 0);
  mealsBudget = Math.max(0, mealsLimit - existingMealsTotal);

  const buildMealType = (type) => {
    if (!allowMap[type]) return [];
    const perTypeMax = maxPerType[type];
    if (perTypeMax === 0) return [];

    const currentCount = (existing[type] || []).length;
    // الحد الفعلي = أقل قيمة بين حد النوع والميزانية المتبقية
    const effectiveTarget = Math.min(perTypeMax, currentCount + mealsBudget);
    if (currentCount >= effectiveTarget) return existing[type] || [];

    const existingIds = (existing[type] || []).map(m => m.id);
    const toAdd = availableByType[type]
      .filter(m => !existingIds.includes(m.id))
      .slice(0, effectiveTarget - currentCount)
      .map(m => ({ id: m.id, title: m.mealTitle }));

    mealsBudget -= toAdd.length; // خصم ما تمت إضافته من الميزانية
    return [...(existing[type] || []), ...toAdd];
  };

  const buildSnack = () => {
    if (!allowMap['سناك']) return [];
    const target = maxPerType['سناك'];
    if (target === 0) return [];
    const currentCount = (existing['سناك'] || []).length;
    if (currentCount >= target) return existing['سناك'] || [];
    const existingIds = (existing['سناك'] || []).map(m => m.id);
    const toAdd = availableByType['سناك']
      .filter(m => !existingIds.includes(m.id))
      .slice(0, target - currentCount)
      .map(m => ({ id: m.id, title: m.mealTitle }));
    return [...(existing['سناك'] || []), ...toAdd];
  };

  const selections = {
    افطار: buildMealType('افطار'),
    غداء:  buildMealType('غداء'),
    عشاء:  buildMealType('عشاء'),
    سناك:  buildSnack(),
  };

  const totalExisting = Object.values(existing).reduce((s, a) => s + a.length, 0);
  const totalNew      = Object.values(selections).reduce((s, a) => s + a.length, 0);
  if (totalNew <= totalExisting) return false;

  await saveClientDailyMeals(clientId, deliveryDate, selections);
  return true;
};

// ─────────────────────────────────────────────
// التشغيل الرئيسي
// ─────────────────────────────────────────────
export const runAutoSelect = async (manual = false) => {
  const startTime = new Date();
  const settings  = await getAutoSelectSettings();

  // حساب تاريخ التوصيل المستهدف
  const offsetMs      = (settings.offsetHours || 48) * 60 * 60 * 1000;
  const deliveryTime  = new Date(Date.now() + offsetMs);
  const deliveryDate  = deliveryTime.toISOString().split('T')[0];

  let processed = 0;
  let skipped   = 0;
  let errors    = 0;
  const details = [];

  try {
    const [clients, allSubs, allMeals, allPackages] = await Promise.all([
      getClients(),
      getAllSubscriptions(),
      getMeals(),
      getPackages(),
    ]);

    for (const client of clients) {
      try {
        const activeSub = allSubs.find(
          s => s.clientId === client.id && getSubscriptionStatus(s) === 'active'
        );
        if (!activeSub) { skipped++; continue; }

        // تأكد إن تاريخ التوصيل ضمن الاشتراك
        if (deliveryDate < activeSub.startDate || deliveryDate > activeSub.endDate) {
          skipped++;
          continue;
        }

        // تخطى لو اليوم مجمّد في الاشتراك
        if ((activeSub.frozenDays || []).includes(deliveryDate)) {
          skipped++;
          continue;
        }

        // تحقق من أيام التوصيل المفعّلة في الاشتراك
        // deliveryDays: [0=سبت, 1=أحد, ..., 6=جمعة]
        const jsToSysDay = [1, 2, 3, 4, 5, 6, 0]; // JS getDay() → ترتيب النظام
        const deliveryDayIdx = jsToSysDay[new Date(deliveryDate).getDay()];

        if (activeSub.deliveryDays?.length > 0) {
          if (!activeSub.deliveryDays.includes(deliveryDayIdx)) {
            skipped++;
            continue;
          }
        } else {
          // fallback للاشتراكات القديمة: تحقق من الجمعة عبر الباقة
          if (deliveryDayIdx === 6) {
            const pkg = allPackages.find(p => p.id === activeSub.packageId);
            if (pkg?.fridays !== true) {
              skipped++;
              continue;
            }
          }
        }

        const didSelect = await autoSelectMealsForClient(client.id, deliveryDate, activeSub, allMeals);
        if (didSelect) {
          processed++;
          details.push({ clientId: client.id, name: client.name, date: deliveryDate, status: 'auto-selected' });
        } else {
          skipped++;
        }
      } catch (e) {
        errors++;
        details.push({ clientId: client.id, name: client.name, status: 'error', error: e.message });
      }
    }
  } catch (e) {
    errors++;
  }

  const endTime  = new Date();
  const duration = Math.round((endTime - startTime) / 1000);

  const logEntry = {
    runAt:        startTime.toISOString(),
    manual,
    deliveryDate,
    offsetHours:  settings.offsetHours,
    processed,
    skipped,
    errors,
    duration,
    details: details.slice(0, 20), // آخر 20 تفصيلة
  };

  // حفظ السجل وتحديث الإعدادات
  await Promise.all([
    saveLog(logEntry),
    saveAutoSelectSettings({
      ...settings,
      lastRun:      startTime.toISOString(),
      lastRunCount: processed,
    }),
  ]);

  return logEntry;
};

// ─────────────────────────────────────────────
// اختيار وجبات لعميل محدد بعد إلغاء التجميد
// ─────────────────────────────────────────────
export const runAutoSelectForClient = async (clientId, dateStr, activeSub) => {
  try {
    const allMeals = await getMeals();
    await autoSelectMealsForClient(clientId, dateStr, activeSub, allMeals);
  } catch (e) {
    console.warn('runAutoSelectForClient error:', e);
  }
};

// ─────────────────────────────────────────────
// التحقق من وقت التشغيل التلقائي
// (يُستدعى عند فتح الداشبورد)
// ─────────────────────────────────────────────
export const checkAndRunScheduled = async () => {
  const settings = await getAutoSelectSettings();
  if (!settings.enabled) return null;

  const now     = new Date();
  const today   = now.toISOString().split('T')[0];
  const lastRun = settings.lastRun ? new Date(settings.lastRun) : null;

  // هل اتشغل النهارده؟
  const ranToday = lastRun && lastRun.toISOString().split('T')[0] === today;
  if (ranToday) return null;

  // هل وصلنا لوقت التشغيل؟
  const runHour   = settings.runHour   ?? 0;
  const runMinute = settings.runMinute ?? 0;
  const shouldRun = now.getHours() > runHour ||
    (now.getHours() === runHour && now.getMinutes() >= runMinute);

  if (!shouldRun) return null;

  // شغّل!
  return await runAutoSelect(false);
};
