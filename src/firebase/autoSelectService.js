import { db } from './config';
import {
  doc, getDoc, setDoc, getDocs,
  collection, serverTimestamp
} from 'firebase/firestore';
import { MEALS_DATA, getMenuDay, saveClientDailyMeals, getClientDailyMeals } from './mealService';
import { getAllSubscriptions, getSubscriptionStatus } from './subscriptionService';
import { getClients } from './clientService';

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
const autoSelectMealsForClient = async (clientId, deliveryDate, activeSub) => {
  // جلب الاختيارات الموجودة (لو في)
  const existing = await getClientDailyMeals(clientId, deliveryDate) || {
    افطار: [], غداء: [], عشاء: [], سناك: []
  };

  const dayKey = getCycleDayKey(activeSub.startDate || deliveryDate, deliveryDate);

  // جرب منيو الشيف أولاً
  let menuDay = await getMenuDay('chef', dayKey);
  // لو مفيش → جرب المنيو العادي
  if (!menuDay?.meals?.length) {
    menuDay = await getMenuDay('default', dayKey);
  }

  if (!menuDay?.meals?.length) return false; // مفيش منيو

  const mealIds = menuDay.meals;
  const meals   = mealIds.map(id => MEALS_DATA.find(m => m.id === id)).filter(Boolean);

  // ── منطق الاختيار حسب الباقة ──
  // 1. الأنواع المسموحة
  const MEAL_TYPES = ['افطار', 'غداء', 'عشاء'];
  const allowMap = {
    افطار: activeSub.allowBreakfast !== false,
    غداء:  activeSub.allowLunch     !== false,
    عشاء:  activeSub.allowDinner    !== false,
    سناك:  activeSub.allowSnacks    !== false,
  };

  // 2. الحد الأقصى لكل نوع من الباقة
  const maxPerType = {
    افطار: activeSub.allowedBreakfast || 2,
    غداء:  activeSub.allowedLunch     || 2,
    عشاء:  activeSub.allowedDinner    || 2,
    سناك:  activeSub.snacksNumber     || 1,
  };

  // 3. الأنواع المسموحة فعلاً (بدون سناك)
  const allowedTypes = MEAL_TYPES.filter(t => allowMap[t]);

  // 4. إجمالي الوجبات المطلوبة (بدون سناك)
  const mealsTarget = activeSub.mealsNumber || 3;

  // 5. توزيع الوجبات على الأنواع المسموحة
  // أولاً: نحسب كم وجبة متاحة في المنيو لكل نوع
  const availableByType = {};
  for (const type of allowedTypes) {
    availableByType[type] = meals.filter(m => m.mealType === type);
  }

  // ثانياً: توزيع mealsTarget على الأنواع بالتساوي مع مراعاة الحد الأقصى والمتاح
  const allocated = {};
  for (const type of allowedTypes) allocated[type] = 0;

  let remaining = mealsTarget;
  let changed = true;

  // نوزع بالتساوي ونكرر لحد ما نوزع كل الوجبات أو نفضل مش قادرين
  while (remaining > 0 && changed) {
    changed = false;
    for (const type of allowedTypes) {
      if (remaining <= 0) break;
      const canAdd = Math.min(
        maxPerType[type] - allocated[type],      // لا يتجاوز الحد الأقصى
        availableByType[type].length - allocated[type], // لا يتجاوز المتاح في المنيو
        1                                        // واحدة في كل جولة للتوزيع العادل
      );
      if (canAdd > 0) {
        allocated[type] += canAdd;
        remaining -= canAdd;
        changed = true;
      }
    }
  }

  // 6. بناء الاختيارات — نكمل الناقص فقط ولا نلمس الموجود
  const buildType = (type, allocCount, isSnack = false) => {
    if (!allowMap[type]) return existing[type] || [];

    const currentCount = (existing[type] || []).length;
    const target = isSnack ? maxPerType['سناك'] : (allocCount || 0);

    // لو الموجود = المطلوب أو أكتر → خليه زي ما هو
    if (currentCount >= target) return existing[type] || [];

    // محتاج نكمل — خد الموجود + أضف الناقص من المنيو
    const existingIds = (existing[type] || []).map(m => m.id);
    const toAdd = meals
      .filter(m => m.mealType === type && !existingIds.includes(m.id))
      .slice(0, target - currentCount)
      .map(m => ({ id: m.id, title: m.mealTitle }));

    return [...(existing[type] || []), ...toAdd];
  };

  const selections = {
    افطار: buildType('افطار', allocated['افطار'] || 0),
    غداء:  buildType('غداء',  allocated['غداء']  || 0),
    عشاء:  buildType('عشاء',  allocated['عشاء']  || 0),
    سناك:  buildType('سناك',  0, true),
  };

  // تأكد إن في تغيير فعلي قبل الحفظ
  const totalExisting = Object.values(existing).reduce((s, a) => s + a.length, 0);
  const totalNew      = Object.values(selections).reduce((s, a) => s + a.length, 0);
  if (totalNew <= totalExisting) return false; // مفيش جديد

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
    const [clients, allSubs] = await Promise.all([
      getClients(),
      getAllSubscriptions(),
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

        const didSelect = await autoSelectMealsForClient(client.id, deliveryDate, activeSub);
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
