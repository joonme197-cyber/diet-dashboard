import { db } from './config';
import {
  collection, addDoc, getDocs, doc,
  updateDoc, deleteDoc, getDoc, setDoc,
  query, where, serverTimestamp
} from 'firebase/firestore';

// =====================
// CRUD الكوبونات
// =====================

export const addCoupon = async (data) => {
  return await addDoc(collection(db, 'coupons'), {
    ...data,
    usageCount: 0,
    isActive: true,
    createdAt: serverTimestamp(),
  });
};

export const getCoupons = async () => {
  const snap = await getDocs(collection(db, 'coupons'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const updateCoupon = async (id, data) => {
  await updateDoc(doc(db, 'coupons', id), data);
};

export const deleteCoupon = async (id) => {
  await deleteDoc(doc(db, 'coupons', id));
};

// =====================
// التحقق من صحة الكوبون
// =====================
export const validateCoupon = async (code, { packageId, durationWeeks, bundleType }) => {
  if (!code) return { valid: false, error: 'أدخل كود الخصم' };

  const snap = await getDocs(query(
    collection(db, 'coupons'),
    where('code', '==', code.toUpperCase().trim())
  ));

  if (snap.empty) return { valid: false, error: 'كود الخصم غير صحيح' };

  const coupon = { id: snap.docs[0].id, ...snap.docs[0].data() };

  if (!coupon.isActive) return { valid: false, error: 'هذا الكوبون معطّل' };

  // فحص تاريخ الانتهاء
  if (coupon.expiryDate) {
    const today = new Date().toISOString().split('T')[0];
    if (coupon.expiryDate < today) return { valid: false, error: 'انتهت صلاحية الكوبون' };
  }

  // فحص عدد الاستخدامات
  if (coupon.maxUsage && coupon.usageCount >= coupon.maxUsage) {
    return { valid: false, error: 'تم استنفاد الحد الأقصى لاستخدام هذا الكوبون' };
  }

  // فحص الباقة — لو الكوبون مخصص لباقات معينة
  if (coupon.applicablePackages?.length > 0 && packageId) {
    if (!coupon.applicablePackages.includes(packageId)) {
      return { valid: false, error: 'هذا الكوبون لا ينطبق على الباقة المختارة' };
    }
  }

  // فحص المدة — لو الكوبون مخصص لمدد معينة
  if (coupon.applicableWeeks?.length > 0 && durationWeeks) {
    if (!coupon.applicableWeeks.includes(Number(durationWeeks))) {
      return { valid: false, error: `هذا الكوبون يسري على: ${coupon.applicableWeeks.join(', ')} أسابيع فقط` };
    }
  }

  return { valid: true, coupon };
};

// =====================
// حساب قيمة الخصم
// =====================
export const calcDiscount = (coupon, originalPrice) => {
  if (!coupon || !originalPrice) return 0;
  if (coupon.discountType === 'percentage') {
    const discount = (originalPrice * coupon.discountValue) / 100;
    // لو في حد أقصى للخصم
    if (coupon.maxDiscount && discount > coupon.maxDiscount) return coupon.maxDiscount;
    return Math.round(discount * 1000) / 1000;
  }
  if (coupon.discountType === 'fixed') {
    return Math.min(coupon.discountValue, originalPrice);
  }
  return 0;
};

// =====================
// تسجيل استخدام الكوبون
// =====================
export const recordCouponUsage = async (couponId, subscriptionData) => {
  // زيادة عداد الاستخدام
  const couponRef = doc(db, 'coupons', couponId);
  const coupon = await getDoc(couponRef);
  if (coupon.exists()) {
    await updateDoc(couponRef, { usageCount: (coupon.data().usageCount || 0) + 1 });
  }
  // تسجيل في collection منفصل للتقارير
  await addDoc(collection(db, 'couponUsage'), {
    ...subscriptionData,
    couponId,
    usedAt: serverTimestamp(),
  });
};

// =====================
// تقرير استخدام الكوبون
// =====================
export const getCouponUsageReport = async (couponId) => {
  const q = couponId
    ? query(collection(db, 'couponUsage'), where('couponId', '==', couponId))
    : collection(db, 'couponUsage');
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
