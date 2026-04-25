import { db } from './config';
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy
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

export function calcFoodCostPct(mealCost, sellingPrice) {
  if (!sellingPrice) return 0;
  return ((mealCost / sellingPrice) * 100).toFixed(1);
}
