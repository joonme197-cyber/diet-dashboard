import { db } from './config';
import {
  collection, addDoc, getDocs, doc,
  deleteDoc, updateDoc, setDoc, getDoc,
  serverTimestamp, query, orderBy, writeBatch
} from 'firebase/firestore';

// =====================
// التصنيفات
// =====================
export const getCategories = async () => {
  try {
    const snap = await getDocs(query(collection(db, 'categories'), orderBy('order', 'asc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(db, 'categories'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

export const addCategory = async (data) => {
  // اجلب أكبر order موجود
  const cats = await getCategories();
  const maxOrder = cats.length > 0 ? Math.max(...cats.map(c => c.order || 0)) : 0;
  return await addDoc(collection(db, 'categories'), {
    ...data,
    order: maxOrder + 1,
    createdAt: serverTimestamp(),
  });
};

export const updateCategory = async (id, data) => {
  await updateDoc(doc(db, 'categories', id), data);
};

export const deleteCategory = async (id) => {
  await deleteDoc(doc(db, 'categories', id));
};

// تحديث ترتيب التصنيفات دفعة واحدة
export const reorderCategories = async (orderedIds) => {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, 'categories', id), { order: index + 1 });
  });
  await batch.commit();
};

// =====================
// الباقات
// =====================
export const getPackages = async () => {
  try {
    const snap = await getDocs(query(collection(db, 'packages'), orderBy('order', 'asc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    // fallback لو مفيش حقل order
    const snap = await getDocs(collection(db, 'packages'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

export const addPackage = async (data) => {
  // اجلب أكبر order في نفس التصنيف
  const pkgs = await getPackages();
  const sameCat = pkgs.filter(p => p.categoryId === (data.categoryId || ''));
  const maxOrder = sameCat.length > 0 ? Math.max(...sameCat.map(p => p.order || 0)) : 0;
  return await addDoc(collection(db, 'packages'), {
    ...data,
    order: maxOrder + 1,
    createdAt: serverTimestamp(),
  });
};

export const updatePackage = async (id, data) => {
  await updateDoc(doc(db, 'packages', id), data);
};

export const deletePackage = async (id) => {
  await deleteDoc(doc(db, 'packages', id));
};

export const getPackageById = async (id) => {
  const snap = await getDoc(doc(db, 'packages', id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// تحديث ترتيب الباقات داخل تصنيف
export const reorderPackages = async (orderedIds) => {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, 'packages', id), { order: index + 1 });
  });
  await batch.commit();
};
