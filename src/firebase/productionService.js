import { db } from './config';
import {
  collection, addDoc, getDocs, doc, deleteDoc, serverTimestamp, query, orderBy,
} from 'firebase/firestore';
import { getMealRecipes } from './mealRecipeService';
import { getInventory, adjustStock } from './inventoryService';

const COL = 'productions';

// Build aggregated ingredient demand from manufacturing data (read-only — no writes to source)
// Reads: clientDailyMeals + meals + subscriptions + clients (same as ManufacturingReport)
export async function buildProductionPlan(date, { clientDailyMeals, meals, subscriptions, clients }) {
  const recipes = await getMealRecipes();
  const inventory = await getInventory();

  const recipeMap = {};
  recipes.forEach(r => { recipeMap[r.id] = r; });

  const mealMap = {};
  meals.forEach(m => { mealMap[m.id] = m; });

  const clientsMap = {};
  clients.forEach(c => { clientsMap[c.id] = c; });

  const dayDocs = clientDailyMeals.filter(d => d.date === date);

  // Aggregate: count meals per (mealId, scaleFactor)
  const mealCounts = {}; // key = mealId|grams → count

  for (const dayDoc of dayDocs) {
    const client = clientsMap[dayDoc.clientId];
    if (!client) continue;
    const sub = subscriptions.find(s => s.clientId === dayDoc.clientId
      && s.status === 'active'
      && date >= (s.startDate || '')
      && date <= (s.endDate || '9999')
    );
    if (!sub) continue;
    if ((sub.frozenDays || []).includes(date)) continue;

    const grams = Number(sub.protein || client.protein || 100);

    const sections = dayDoc.meals || {};
    Object.values(sections).forEach(mealList => {
      (mealList || []).forEach(entry => {
        const key = `${entry.id}|${grams}`;
        mealCounts[key] = (mealCounts[key] || 0) + 1;
      });
    });
  }

  // For each (meal, grams, count) → use recipe to compute ingredient demand
  const ingredientNeed = {}; // ingredientId or name → { name, ingredientId, totalGrams, cost, mealsUsing[] }
  const mealsWithoutRecipe = new Set();
  const mealBreakdown = []; // for display: meal name × grams × count

  Object.entries(mealCounts).forEach(([key, count]) => {
    const [mealId, gramsStr] = key.split('|');
    const grams = Number(gramsStr);
    const recipe = recipeMap[mealId];
    const meal = mealMap[mealId];
    const mealName = meal?.mealTitle || mealId;

    mealBreakdown.push({ mealId, mealName, grams, count });

    if (!recipe || !recipe.ingredients?.length) {
      mealsWithoutRecipe.add(mealName);
      return;
    }

    const baseGrams = Number(recipe.baseGrams) || 100;
    const scale = grams / baseGrams;

    recipe.ingredients.forEach(ing => {
      const totalGrams = (Number(ing.gramsPerBase) || 0) * scale * count;
      const inv = inventory.find(i => i.id === ing.ingredientId) ||
                  inventory.find(i => i.name === ing.name);
      const key = inv?.id || ing.name;
      if (!ingredientNeed[key]) {
        ingredientNeed[key] = {
          ingredientId: inv?.id || '',
          name: ing.name,
          unit: inv?.unit || 'جرام',
          totalGrams: 0,
          cost: 0,
          inStock: inv ? Number(inv.currentStock) || 0 : 0,
          inStockUnit: inv?.unit || 'جرام',
          costPerUnit: inv ? Number(inv.costPerUnit) || 0 : 0,
          category: inv?.category || 'other',
        };
      }
      ingredientNeed[key].totalGrams += totalGrams;
    });
  });

  // Calculate cost — convert grams to inventory unit
  // Supports: كيلو, غرام, لتر, مل, حبة, علبة, كرتون
  // Piece-based units (حبة/علبة/كرتون) need `weightPerUnit` field on inventory item
  const conversionWarnings = [];
  Object.values(ingredientNeed).forEach(ing => {
    const inv = inventory.find(i => i.id === ing.ingredientId);
    let demandInUnit = ing.totalGrams;
    let supported = true;
    let warning = null;

    switch (ing.unit) {
      case 'كيلو':
        demandInUnit = ing.totalGrams / 1000;
        break;
      case 'لتر':
        // Approximation: 1ml ≈ 1g (true for water; fats/oils ~0.92g/ml; sugars ~1.4g/ml)
        demandInUnit = ing.totalGrams / 1000;
        break;
      case 'غرام':
        demandInUnit = ing.totalGrams;
        break;
      case 'مل':
        demandInUnit = ing.totalGrams; // ~1:1 approximation
        break;
      case 'حبة':
      case 'علبة':
      case 'كرتون': {
        const weightPerUnit = Number(inv?.weightPerUnit) || 0;
        if (weightPerUnit > 0) {
          demandInUnit = ing.totalGrams / weightPerUnit;
        } else {
          supported = false;
          warning = `${ing.name} (${ing.unit}): مينفعش يتحوّل من جرام بدون "وزن الوحدة" — أضفه فى المخزون`;
          demandInUnit = 0;
        }
        break;
      }
      default:
        demandInUnit = ing.totalGrams;
    }

    ing.demandInUnit = demandInUnit;
    ing.unitConversionSupported = supported;
    ing.cost = supported ? demandInUnit * ing.costPerUnit : 0;
    ing.shortage = supported ? Math.max(0, demandInUnit - ing.inStock) : 0;
    if (warning) conversionWarnings.push(warning);
  });

  const totalMeals = Object.values(mealCounts).reduce((s, c) => s + c, 0);
  const totalCost = Object.values(ingredientNeed).reduce((s, i) => s + i.cost, 0);

  return {
    date,
    totalMeals,
    totalCost,
    ingredients: Object.values(ingredientNeed).sort((a, b) => b.cost - a.cost),
    mealBreakdown: mealBreakdown.sort((a, b) => b.count - a.count),
    mealsWithoutRecipe: [...mealsWithoutRecipe],
    conversionWarnings,
  };
}

// Commit production: deduct from inventory + save record
export async function commitProduction(plan) {
  const ref = await addDoc(collection(db, COL), {
    date: plan.date,
    totalMeals: plan.totalMeals,
    totalCost: plan.totalCost,
    ingredients: plan.ingredients.map(i => ({
      ingredientId: i.ingredientId,
      name: i.name,
      demandInUnit: i.demandInUnit,
      unit: i.unit,
      cost: i.cost,
    })),
    mealBreakdown: plan.mealBreakdown,
    createdAt: serverTimestamp(),
  });

  for (const ing of plan.ingredients) {
    if (ing.ingredientId && ing.demandInUnit > 0) {
      await adjustStock(ing.ingredientId, -ing.demandInUnit);
    }
  }
  return ref;
}

export async function getProductions() {
  const snap = await getDocs(query(collection(db, COL), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteProduction(id) {
  return deleteDoc(doc(db, COL, id));
}
