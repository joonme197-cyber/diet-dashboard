import { db } from './config';
import {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  getDoc
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
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// جلب عميل بالـ ID
export const getClientById = async (clientId) => {
  const docRef = doc(db, CLIENTS_COLLECTION, clientId);
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() };
  }
  return null;
};

// حذف عميل
export const deleteClient = async (clientId) => {
  await deleteDoc(doc(db, CLIENTS_COLLECTION, clientId));
};

// تحديث عميل
export const updateClient = async (clientId, data) => {
  await updateDoc(doc(db, CLIENTS_COLLECTION, clientId), data);
};
