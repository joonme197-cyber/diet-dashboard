import { db } from './config';
import {
  collection, addDoc, getDocs, doc,
  deleteDoc, updateDoc, getDoc,
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
export const getSubscriptionStatus = (sub) => {
  // Kuwait timezone (UTC+3)
  const now = new Date();
  const kwDate = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const today = kwDate.toISOString().split('T')[0];
  if (sub.status === 'cancelled') return 'cancelled';
  if (sub.endDate < today) return 'expired';
  if (sub.startDate > today) return 'upcoming';
  return 'active';
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
