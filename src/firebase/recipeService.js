import { db } from './config';
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, writeBatch
} from 'firebase/firestore';

const COL = 'recipes';

export async function getRecipes() {
  const snap = await getDocs(query(collection(db, COL), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export function calcRecipeCost(ingredients) {
  return (ingredients || []).reduce((s, i) =>
    s + ((Number(i.quantity) || 0) * (Number(i.costPerUnit) || 0)), 0);
}

export async function addRecipe(data) {
  return addDoc(collection(db, COL), {
    ...data,
    totalCost: calcRecipeCost(data.ingredients),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateRecipe(id, data) {
  return updateDoc(doc(db, COL, id), {
    ...data,
    totalCost: calcRecipeCost(data.ingredients),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRecipe(id) {
  return deleteDoc(doc(db, COL, id));
}

// Bulk import recipes — one row = one recipe (ingredients as comma-separated "name:qty:cost")
export async function bulkAddRecipes(rows) {
  const batch = writeBatch(db);
  let count = 0;
  rows.forEach(row => {
    const ingStr = row['المكونات'] || row.ingredients || '';
    const ingredients = ingStr.split('|').filter(Boolean).map(part => {
      const [name, qty, cost] = part.split(':').map(s => s.trim());
      return { name: name || '', quantity: Number(qty) || 0, costPerUnit: Number(cost) || 0 };
    });
    const totalCost = calcRecipeCost(ingredients);
    const ref = doc(collection(db, COL));
    batch.set(ref, {
      name: row['اسم الوصفة'] || row.name || '',
      sellingPrice: Number(row['سعر البيع'] || row.sellingPrice || 0),
      ingredients, totalCost,
      notes: row['ملاحظات'] || row.notes || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    count++;
  });
  await batch.commit();
  return count;
}

export function calcFoodCostPct(mealCost, sellingPrice) {
  if (!sellingPrice) return 0;
  return ((mealCost / sellingPrice) * 100).toFixed(1);
}
