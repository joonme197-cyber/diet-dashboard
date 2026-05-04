// ── أضيف دي في firebase/packageService.js ──
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, orderBy, query } from 'firebase/firestore';
import { db } from './config';

// جلب التصنيفات
export const getCategories = async () => {
  const snap = await getDocs(query(collection(db, 'packageCategories'), orderBy('createdAt', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// إضافة تصنيف
export const addCategory = async (data) => {
  return await addDoc(collection(db, 'packageCategories'), { ...data, createdAt: serverTimestamp() });
};

// تعديل تصنيف
export const updateCategory = async (id, data) => {
  await updateDoc(doc(db, 'packageCategories', id), { ...data, updatedAt: serverTimestamp() });
};

// حذف تصنيف
export const deleteCategory = async (id) => {
  await deleteDoc(doc(db, 'packageCategories', id));
};
