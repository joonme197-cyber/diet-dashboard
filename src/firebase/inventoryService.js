import { db } from './config';
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, writeBatch
} from 'firebase/firestore';

const COL = 'inventory';

export const INGREDIENT_CATEGORIES = [
  { key: 'meat',       code: 'MT', nameAr: 'لحوم ودواجن',            nameEn: 'Meat & Poultry' },
  { key: 'fish',       code: 'FS', nameAr: 'أسماك ومأكولات بحرية',   nameEn: 'Fish & Seafood' },
  { key: 'vegetables', code: 'VG', nameAr: 'خضروات',                  nameEn: 'Vegetables' },
  { key: 'fruits',     code: 'FR', nameAr: 'فواكه',                   nameEn: 'Fruits' },
  { key: 'dairy',      code: 'DR', nameAr: 'ألبان وبيض',              nameEn: 'Dairy & Eggs' },
  { key: 'grains',     code: 'GR', nameAr: 'حبوب وبقوليات',           nameEn: 'Grains & Legumes' },
  { key: 'oils',       code: 'OL', nameAr: 'زيوت وتوابل',             nameEn: 'Oils & Spices' },
  { key: 'packaging',  code: 'PK', nameAr: 'تغليف وعبوات',            nameEn: 'Packaging' },
  { key: 'other',      code: 'OT', nameAr: 'أخرى',                   nameEn: 'Other' },
];

export const UNITS = ['كيلو', 'غرام', 'لتر', 'مل', 'حبة', 'علبة', 'كرتون'];
export const UNITS_EN = ['Kg', 'Gram', 'Liter', 'ML', 'Piece', 'Box', 'Carton'];

export async function getInventory() {
  const snap = await getDocs(query(collection(db, COL), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addIngredient(data) {
  // Keep backward-compat `name` field = nameAr for old code paths
  return addDoc(collection(db, COL), {
    ...data,
    name: data.nameAr || data.name || '',
    currentStock: Number(data.currentStock) || 0,
    minStock: Number(data.minStock) || 0,
    costPerUnit: Number(data.costPerUnit) || 0,
    weightPerUnit: Number(data.weightPerUnit) || 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateIngredient(id, data) {
  return updateDoc(doc(db, COL, id), {
    ...data,
    name: data.nameAr || data.name || '',
    updatedAt: serverTimestamp(),
  });
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
    const nameAr = row['الاسم بالعربي'] || row['اسم المكون'] || row.nameAr || row.name || '';
    const nameEn = row['الاسم بالإنجليزي'] || row.nameEn || '';
    batch.set(ref, {
      nameAr,
      nameEn,
      name: nameAr,
      code: row['الكود'] || row.code || '',
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

// Helper: get display name based on language
export function getItemName(item, lang = 'ar') {
  if (!item) return '';
  if (lang === 'en') return item.nameEn || item.nameAr || item.name || '';
  return item.nameAr || item.name || '';
}
