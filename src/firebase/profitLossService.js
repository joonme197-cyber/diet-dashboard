import { db } from './config';
import {
  doc, getDoc, setDoc, getDocs, collection, query, orderBy,
  deleteDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';

const COL = 'profitLoss';

// Standard category mapping (matches accounting practice)
// Selling & Distribution: marketing, delivery, packaging
// General & Administrative: rent, salaries, utilities, insurance, maintenance, other
export const SELLING_CATEGORIES = ['marketing', 'delivery', 'packaging'];
export const ADMIN_CATEGORIES = ['rent', 'salaries', 'utilities', 'insurance', 'maintenance', 'other'];

export async function getProfitLoss(monthYear) {
  const ref = doc(db, COL, monthYear);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function saveProfitLoss(monthYear, data) {
  const ref = doc(db, COL, monthYear);
  return setDoc(ref, { ...data, monthYear, updatedAt: serverTimestamp() });
}

export async function getAllProfitLoss() {
  const snap = await getDocs(query(collection(db, COL), orderBy('monthYear', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteProfitLoss(monthYear) {
  return deleteDoc(doc(db, COL, monthYear));
}

export async function bulkImportProfitLoss(rows) {
  const batch = writeBatch(db);
  let count = 0;
  rows.forEach(row => {
    const monthYear = row['الشهر'] || row.monthYear || '';
    if (!/^\d{4}-\d{2}$/.test(monthYear)) return;
    const data = {
      monthYear,
      // Revenue
      subscriptionRevenue: Number(row['إيرادات الاشتراكات'] || 0),
      otherRevenue: Number(row['إيرادات أخرى'] || 0),
      // COGS
      openingStock: Number(row['مخزون أول الفترة'] || 0),
      purchases: Number(row['المشتريات'] || 0),
      directCosts: Number(row['تكاليف مباشرة'] || 0),
      closingStock: Number(row['مخزون آخر الفترة'] || 0),
      // OpEx
      sellingExpenses: Number(row['مصروفات بيع وتسويق'] || 0),
      adminExpenses: Number(row['مصروفات إدارية'] || 0),
      // Below operating
      depreciation: Number(row['إهلاك'] || 0),
      interest: Number(row['فوائد'] || 0),
      taxes: Number(row['ضرائب'] || 0),
      notes: row['ملاحظات'] || '',
    };
    batch.set(doc(db, COL, monthYear), { ...data, updatedAt: serverTimestamp() });
    count++;
  });
  await batch.commit();
  return count;
}

// Pure calculation: derive complete P&L statement from inputs
export function computeStatement(inputs) {
  const {
    subscriptionRevenue = 0, otherRevenue = 0,
    openingStock = 0, purchases = 0, directCosts = 0, closingStock = 0,
    sellingExpenses = 0, adminExpenses = 0,
    depreciation = 0, interest = 0, taxes = 0,
  } = inputs;

  // 1. Total Revenue
  const totalRevenue = Number(subscriptionRevenue) + Number(otherRevenue);

  // 2. COGS (Cost of Goods Sold) = Beginning Inventory + Purchases + Direct Costs - Ending Inventory
  const cogs = Number(openingStock) + Number(purchases) + Number(directCosts) - Number(closingStock);

  // 3. Gross Profit = Revenue - COGS
  const grossProfit = totalRevenue - cogs;
  const grossProfitMargin = totalRevenue ? (grossProfit / totalRevenue) * 100 : 0;

  // 4. Operating Expenses
  const totalOpex = Number(sellingExpenses) + Number(adminExpenses);

  // 5. EBITDA = Gross Profit - OpEx (excluding D&A, Interest, Tax)
  const ebitda = grossProfit - totalOpex;
  const ebitdaMargin = totalRevenue ? (ebitda / totalRevenue) * 100 : 0;

  // 6. Operating Profit (EBIT) = EBITDA - Depreciation
  const operatingProfit = ebitda - Number(depreciation);
  const operatingMargin = totalRevenue ? (operatingProfit / totalRevenue) * 100 : 0;

  // 7. EBT (Earnings Before Tax) = Operating Profit - Interest
  const ebt = operatingProfit - Number(interest);

  // 8. Net Profit = EBT - Taxes
  const netProfit = ebt - Number(taxes);
  const netMargin = totalRevenue ? (netProfit / totalRevenue) * 100 : 0;

  return {
    // Revenue section
    subscriptionRevenue: Number(subscriptionRevenue),
    otherRevenue: Number(otherRevenue),
    totalRevenue,
    // COGS section
    openingStock: Number(openingStock),
    purchases: Number(purchases),
    directCosts: Number(directCosts),
    closingStock: Number(closingStock),
    cogs,
    cogsRatio: totalRevenue ? (cogs / totalRevenue) * 100 : 0,
    // Gross
    grossProfit,
    grossProfitMargin,
    // OpEx
    sellingExpenses: Number(sellingExpenses),
    adminExpenses: Number(adminExpenses),
    totalOpex,
    opexRatio: totalRevenue ? (totalOpex / totalRevenue) * 100 : 0,
    // EBITDA
    ebitda,
    ebitdaMargin,
    // Operating
    depreciation: Number(depreciation),
    operatingProfit,
    operatingMargin,
    // EBT
    interest: Number(interest),
    ebt,
    // Net
    taxes: Number(taxes),
    netProfit,
    netMargin,
  };
}
