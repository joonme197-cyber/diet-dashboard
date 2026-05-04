import { db } from './config';
import { doc, getDoc, setDoc, getDocs, collection, query, orderBy, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';

const COL = 'costAnalysis';

// Save / load monthly snapshot. Doc ID = monthYear ('2026-04')
export async function getCostAnalysis(monthYear) {
  const ref = doc(db, COL, monthYear);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveCostAnalysis(monthYear, data) {
  const ref = doc(db, COL, monthYear);
  return setDoc(ref, { ...data, monthYear, updatedAt: serverTimestamp() });
}

export async function getAllCostAnalyses() {
  const snap = await getDocs(query(collection(db, COL), orderBy('monthYear', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteCostAnalysis(monthYear) {
  return deleteDoc(doc(db, COL, monthYear));
}

// Bulk import — each row = one month's analysis
export async function bulkImportCostAnalysis(rows) {
  const batch = writeBatch(db);
  let count = 0;
  rows.forEach(row => {
    const monthYear = row['الشهر'] || row.monthYear || '';
    if (!/^\d{4}-\d{2}$/.test(monthYear)) return;
    const data = {
      monthYear,
      openingStock: Number(row['مخزون أول الفترة'] || row.openingStock || 0),
      purchases: Number(row['المشتريات'] || row.purchases || 0),
      closingStock: Number(row['مخزون آخر الفترة'] || row.closingStock || 0),
      revenue: Number(row['الإيرادات'] || row.revenue || 0),
      laborCost: Number(row['تكلفة العمالة'] || row.laborCost || 0),
      wasteQty: Number(row['كمية الهدر'] || row.wasteQty || 0),
      totalQty: Number(row['إجمالى الكمية'] || row.totalQty || 0),
      theoreticalPct: Number(row['Theoretical %'] || row.theoreticalPct || 0),
      notes: row['ملاحظات'] || row.notes || '',
    };
    // recompute derived
    const cogs = calcCOGS(data.openingStock, data.purchases, data.closingStock);
    const foodCostPct = calcFoodCostPct(cogs, data.revenue);
    data.cogs = cogs;
    data.foodCostPct = foodCostPct;
    data.grossProfit = calcGrossProfit(data.revenue, cogs);
    data.primeCost = calcPrimeCost(cogs, data.laborCost);
    data.variance = calcVariance(foodCostPct, data.theoreticalPct);
    data.wastagePct = calcWastagePct(data.wasteQty, data.totalQty);

    batch.set(doc(db, COL, monthYear), { ...data, updatedAt: serverTimestamp() });
    count++;
  });
  await batch.commit();
  return count;
}

// ── Pure calculation helpers (the 7 formulas) ──
export function calcCOGS(openingStock, purchases, closingStock) {
  return (Number(openingStock) || 0) + (Number(purchases) || 0) - (Number(closingStock) || 0);
}

export function calcFoodCostPct(cogs, revenue) {
  if (!revenue) return 0;
  return (cogs / revenue) * 100;
}

export function calcSellingPrice(recipeCost, targetFoodCostPct) {
  if (!targetFoodCostPct) return 0;
  return recipeCost / (targetFoodCostPct / 100);
}

export function calcGrossProfit(revenue, cogs) {
  return (Number(revenue) || 0) - (Number(cogs) || 0);
}

export function calcWastagePct(wasteQty, totalQty) {
  if (!totalQty) return 0;
  return (wasteQty / totalQty) * 100;
}

export function calcVariance(actualPct, theoreticalPct) {
  return (Number(actualPct) || 0) - (Number(theoreticalPct) || 0);
}

export function calcPrimeCost(foodCost, laborCost) {
  return (Number(foodCost) || 0) + (Number(laborCost) || 0);
}
