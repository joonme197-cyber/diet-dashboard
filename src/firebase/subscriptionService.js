import { db } from './config';
import {
  collection, addDoc, getDocs, doc,
  deleteDoc, updateDoc, getDoc, setDoc,
  serverTimestamp, query, where, orderBy
} from 'firebase/firestore';

// =====================
// الاشتراكات
// =====================

export const addSubscription = async (data) => {
  return await addDoc(collection(db, 'subscriptions'), {
    ...data,
    status: data.status || 'active',
    frozenDays: data.frozenDays || [],
    bonusDays: data.bonusDays || 0,
    payments: data.payments || [],
    createdAt: serverTimestamp(),
  });
};

export const getClientSubscriptions = async (clientId) => {
  const q = query(
    collection(db, 'subscriptions'),
    where('clientId', '==', clientId),
    orderBy('startDate', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getAllSubscriptions = async () => {
  const q = query(collection(db, 'subscriptions'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const getSubscriptionById = async (id) => {
  const snap = await getDoc(doc(db, 'subscriptions', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const updateSubscription = async (id, data) => {
  await updateDoc(doc(db, 'subscriptions', id), data);
};

export const deleteSubscription = async (id) => {
  await deleteDoc(doc(db, 'subscriptions', id));
};

// =====================
// تجميد يوم
// =====================
export const freezeDay = async (subscriptionId, dateStr) => {
  const sub = await getSubscriptionById(subscriptionId);
  if (!sub) return;
  const frozenDays = sub.frozenDays || [];
  if (frozenDays.includes(dateStr)) return;
  // مد تاريخ الانتهاء يوم
  const endDate = new Date(sub.endDate);
  endDate.setDate(endDate.getDate() + 1);
  await updateSubscription(subscriptionId, {
    frozenDays: [...frozenDays, dateStr],
    endDate: endDate.toISOString().split('T')[0],
  });
};

export const unFreezeDay = async (subscriptionId, dateStr) => {
  const sub = await getSubscriptionById(subscriptionId);
  if (!sub) return;
  const frozenDays = (sub.frozenDays || []).filter(d => d !== dateStr);
  // سحب تاريخ الانتهاء يوم للخلف
  const endDate = new Date(sub.endDate);
  endDate.setDate(endDate.getDate() - 1);
  await updateSubscription(subscriptionId, {
    frozenDays,
    endDate: endDate.toISOString().split('T')[0],
  });
};

// =====================
// إضافة/حذف أيام
// =====================
export const addBonusDays = async (subscriptionId, days) => {
  const sub = await getSubscriptionById(subscriptionId);
  if (!sub) return;
  const endDate = new Date(sub.endDate);
  endDate.setDate(endDate.getDate() + days);
  await updateSubscription(subscriptionId, {
    bonusDays: (sub.bonusDays || 0) + days,
    endDate: endDate.toISOString().split('T')[0],
  });
};

// =====================
// إضافة دفعة
// =====================
export const addPayment = async (subscriptionId, payment) => {
  const sub = await getSubscriptionById(subscriptionId);
  if (!sub) return;
  const payments = sub.payments || [];
  await updateSubscription(subscriptionId, {
    payments: [...payments, { ...payment, date: new Date().toISOString().split('T')[0] }],
    paymentStatus: 'paid',
  });
};

// =====================
// حساب حالة الاشتراك
// =====================
// تحقق إن تاريخ معين هو يوم توصيل فعلي للاشتراك
// ترتيب الأيام في النظام: 0=سبت, 1=أحد, 2=اثنين, 3=ثلاثاء, 4=أربعاء, 5=خميس, 6=جمعة
export const isDeliveryDay = (sub, dateStr) => {
  const jsToSys = [1, 2, 3, 4, 5, 6, 0]; // JS getDay() (0=أحد..6=سبت) → ترتيب النظام
  const dayIdx = jsToSys[new Date(dateStr).getDay()];
  if (sub.deliveryDays?.length > 0) {
    return sub.deliveryDays.includes(dayIdx);
  }
  // fallback للاشتراكات القديمة: الجمعة (6) تُرفض إلا لو الباقة تشملها
  if (dayIdx === 6) return sub.fridays === true;
  return true;
};

export const getSubscriptionStatus = (sub) => {
  // Kuwait timezone (UTC+3)
  const now = new Date();
  const kwDate = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const today = kwDate.toISOString().split('T')[0];
  if (sub.status === 'cancelled') return 'cancelled';
  if (sub.status === 'paused') return 'paused';
  if (sub.endDate < today) return 'expired';
  if (sub.startDate > today) return 'upcoming';
  return 'active';
};

// =====================
// تجميد نطاق أيام
// =====================
export const freezeDateRange = async (subscriptionId, fromDate, toDate) => {
  const sub = await getSubscriptionById(subscriptionId);
  if (!sub) return 0;
  const frozenDays = sub.frozenDays || [];
  const newDays = [];
  const current = new Date(fromDate);
  const end = new Date(toDate);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    if (!frozenDays.includes(dateStr)) newDays.push(dateStr);
    current.setDate(current.getDate() + 1);
  }
  if (newDays.length === 0) return 0;
  const endDate = new Date(sub.endDate);
  endDate.setDate(endDate.getDate() + newDays.length);
  await updateSubscription(subscriptionId, {
    frozenDays: [...frozenDays, ...newDays],
    endDate: endDate.toISOString().split('T')[0],
  });
  return newDays.length;
};

export const getStatusLabel = (status) => {
  const map = {
    active: { label: 'نشط', color: '#16a34a', bg: '#dcfce7' },
    upcoming: { label: 'قادم', color: '#0d9488', bg: '#f0fdfa' },
    expired: { label: 'منتهي', color: '#dc2626', bg: '#fee2e2' },
    cancelled: { label: 'ملغي', color: '#9333ea', bg: '#f3e8ff' },
    paused: { label: 'مجمد', color: '#d97706', bg: '#fff7ed' },
  };
  return map[status] || map.active;
};

// =====================
// حساب أقرب تاريخ للتجديد
// startDate = max(endDate + 1, today + leadHours)
// =====================
export const calcRenewalStartDate = (activeSub, leadHours = 96) => {
  // Kuwait timezone (UTC+3)
  const now = new Date();
  const kwNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  // اليوم + مدة التجهيز
  const minFromToday = new Date(kwNow.getTime() + leadHours * 60 * 60 * 1000);
  const minFromTodayStr = minFromToday.toISOString().split('T')[0];

  if (!activeSub?.endDate) return minFromTodayStr;

  // يوم بعد انتهاء الاشتراك الحالي
  const dayAfterEnd = new Date(activeSub.endDate);
  dayAfterEnd.setDate(dayAfterEnd.getDate() + 1);
  const dayAfterEndStr = dayAfterEnd.toISOString().split('T')[0];

  // أبعد التاريخين
  return dayAfterEndStr > minFromTodayStr ? dayAfterEndStr : minFromTodayStr;
};

// =====================
// إعدادات التجديد (Firestore)
// =====================
export const getRenewalSettings = async () => {
  try {
    const snap = await getDoc(doc(db, 'settings', 'renewal'));
    return snap.exists() ? snap.data() : { leadHours: 96 };
  } catch {
    return { leadHours: 96 };
  }
};

export const saveRenewalSettings = async (settings) => {
  await setDoc(doc(db, 'settings', 'renewal'), settings, { merge: true });
};
