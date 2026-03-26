import { db } from './config';
import {
  collection, addDoc, getDocs, doc,
  deleteDoc, updateDoc, setDoc, getDoc,
  serverTimestamp, query, orderBy
} from 'firebase/firestore';

// =====================
// التصنيفات
// =====================
export const getCategories = async () => {
  const snap = await getDocs(query(collection(db, 'categories'), orderBy('createdAt', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addCategory = async (data) => {
  return await addDoc(collection(db, 'categories'), { ...data, createdAt: serverTimestamp() });
};

export const updateCategory = async (id, data) => {
  await updateDoc(doc(db, 'categories', id), data);
};

export const deleteCategory = async (id) => {
  await deleteDoc(doc(db, 'categories', id));
};

// =====================
// الباقات
// =====================
export const getPackages = async () => {
  const snap = await getDocs(query(collection(db, 'packages'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addPackage = async (data) => {
  return await addDoc(collection(db, 'packages'), { ...data, createdAt: serverTimestamp() });
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
