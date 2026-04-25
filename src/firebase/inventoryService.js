import { db } from './config';
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, writeBatch
} from 'firebase/firestore';

const COL = 'inventory';

export const INGREDIENT_CATEGORIES = [
  { key: 'meat',       label: 'لحوم ودواجن' },
  { key: 'fish',       label: 'أسماك ومأكولات بحرية' },
  { key: 'vegetables', label: 'خضروات' },
  { key: 'fruits',     label: 'فواكه' },
  { key: 'dairy',      label: 'ألبان وبيض' },
  { key: 'grains',     label: 'حبوب وبقوليات' },
  { key: 'oils',       label: 'زيوت وتوابل' },
  { key: 'packaging',  label: 'تغليف وعبوات' },
  { key: 'other',      label: 'أخرى' },
];

export const UNITS = ['كيلو', 'غرام', 'لتر', 'مل', 'حبة', 'علبة', 'كرتون'];

export async function getInventory() {
  const snap = await getDocs(query(collection(db, COL), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addIngredient(data) {
  return addDoc(collection(db, COL), {
    ...data,
    currentStock: Number(data.currentStock) || 0,
    minStock: Number(data.minStock) || 0,
    costPerUnit: Number(data.costPerUnit) || 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateIngredient(id, data) {
  return updateDoc(doc(db, COL, id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteIngredient(id) {
  return deleteDoc(doc(db, COL, id));
}

export async function adjustStock(id, delta) {
  const snap = await getDocs(collection(db, COL));
  const item = snap.docs.find(d => d.id === id);
  if (!item) return;
  const current = item.data().currentStock || 0;
  return updateDoc(doc(db, COL, id), {
    currentStock: Math.max(0, current + delta),
    updatedAt: serverTimestamp(),
  });
}

// Bulk import — adds many items at once
export async function bulkAddIngredients(rows) {
  const batch = writeBatch(db);
  let count = 0;
  rows.forEach(row => {
    const ref = doc(collection(db, COL));
    batch.set(ref, {
      name: row['اسم المكون'] || row.name || '',
      unit: row['الوحدة'] || row.unit || 'كيلو',
      category: row['التصنيف'] || row.category || 'other',
      currentStock: Number(row['المخزون الحالي'] || row.currentStock || 0),
      minStock: Number(row['الحد الأدنى'] || row.minStock || 0),
      costPerUnit: Number(row['تكلفة الوحدة'] || row.costPerUnit || 0),
      notes: row['ملاحظات'] || row.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    count++;
  });
  await batch.commit();
  return count;
}

export function getLowStockItems(items) {
  return items.filter(i => i.currentStock <= i.minStock);
}

export function calcInventoryValue(items) {
  return items.reduce((sum, i) => sum + (i.currentStock * i.costPerUnit), 0);
}
