import { db } from './config';
import {
  collection,
  addDoc,
  getDocs,
  getDoc,
  doc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';

const CLIENTS_COLLECTION = 'clients';

// إضافة عميل جديد
export const addClient = async (clientData) => {
  const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), {
    ...clientData,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
};

// جلب كل العملاء
export const getClients = async () => {
  const q = query(collection(db, CLIENTS_COLLECTION), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

// ✅ جلب عميل واحد بالـ ID مباشرة (أسرع بكثير)
export const getClientById = async (clientId) => {
  const snap = await getDoc(doc(db, CLIENTS_COLLECTION, clientId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

// حذف عميل
export const deleteClient = async (clientId) => {
  await deleteDoc(doc(db, CLIENTS_COLLECTION, clientId));
};

// تحديث عميل
export const updateClient = async (clientId, data) => {
  await updateDoc(doc(db, CLIENTS_COLLECTION, clientId), data);
};
