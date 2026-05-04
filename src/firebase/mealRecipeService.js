import { db } from './config';
import {
  collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';

const COL = 'mealRecipes';

// Schema: { id: mealId, mealName, baseGrams, ingredients: [{ingredientId, name, gramsPerBase}], updatedAt }

export async function getMealRecipes() {
  const snap = await getDocs(collection(db, COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveMealRecipe(mealId, data) {
  return setDoc(doc(db, COL, mealId), {
    ...data,
    baseGrams: Number(data.baseGrams) || 100,
    ingredients: (data.ingredients || []).map(i => ({
      ingredientId: i.ingredientId || '',
      name: i.name || '',
      gramsPerBase: Number(i.gramsPerBase) || 0,
    })),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteMealRecipe(mealId) {
  return deleteDoc(doc(db, COL, mealId));
}

// Bulk import from long-format rows: each row = one ingredient in one meal
export async function bulkImportMealRecipes(rows, inventory = []) {
  // Group rows by mealId
  const grouped = {};
  rows.forEach(row => {
    const mealId = row['mealId'] || row['كود الوجبة'] || row.id;
    if (!mealId) return;
    if (!grouped[mealId]) {
      grouped[mealId] = {
        mealName: row['اسم الوجبة'] || row.mealName || '',
        baseGrams: Number(row['الحجم الأساسى (جرام)'] || row.baseGrams || 100),
        ingredients: [],
      };
    }
    const ingName = row['المكون'] || row.ingredient || '';
    const grams = Number(row['الجرامات'] || row.grams || row.gramsPerBase || 0);
    if (ingName && grams > 0) {
      const inv = inventory.find(i => i.name === ingName);
      grouped[mealId].ingredients.push({
        ingredientId: inv?.id || '',
        name: ingName,
        gramsPerBase: grams,
      });
    }
  });

  const batch = writeBatch(db);
  let count = 0;
  Object.entries(grouped).forEach(([mealId, data]) => {
    if (data.ingredients.length === 0) return;
    batch.set(doc(db, COL, mealId), { ...data, updatedAt: serverTimestamp() });
    count++;
  });
  await batch.commit();
  return count;
}
