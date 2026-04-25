import { db } from './config';
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, writeBatch
} from 'firebase/firestore';

const COL = 'suppliers';

export const SUPPLIER_CATEGORIES = [
  { key: 'meat',       label: 'لحوم ودواجن' },
  { key: 'fish',       label: 'أسماك ومأكولات بحرية' },
  { key: 'vegetables', label: 'خضروات وفواكه' },
  { key: 'dairy',      label: 'ألبان وبيض' },
  { key: 'grains',     label: 'حبوب وبقوليات' },
  { key: 'packaging',  label: 'تغليف وعبوات' },
  { key: 'general',    label: 'عام' },
];

export async function getSuppliers() {
  const snap = await getDocs(query(collection(db, COL), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addSupplier(data) {
  return addDoc(collection(db, COL), { ...data, balance: 0, createdAt: serverTimestamp() });
}

export async function updateSupplier(id, data) {
  return updateDoc(doc(db, COL, id), data);
}

export async function deleteSupplier(id) {
  return deleteDoc(doc(db, COL, id));
}

export async function updateSupplierBalance(id, delta) {
  const snap = await getDocs(collection(db, COL));
  const sup = snap.docs.find(d => d.id === id);
  if (!sup) return;
  const current = sup.data().balance || 0;
  return updateDoc(doc(db, COL, id), { balance: current + delta });
}

export async function bulkAddSuppliers(rows) {
  const batch = writeBatch(db);
  let count = 0;
  rows.forEach(row => {
    const ref = doc(collection(db, COL));
    batch.set(ref, {
      name: row['اسم المورد'] || row.name || '',
      phone: row['الهاتف'] || row.phone || '',
      email: row['البريد'] || row.email || '',
      category: row['الفئة'] || row.category || 'general',
      address: row['العنوان'] || row.address || '',
      notes: row['ملاحظات'] || row.notes || '',
      balance: 0,
      createdAt: serverTimestamp(),
    });
    count++;
  });
  await batch.commit();
  return count;
}
