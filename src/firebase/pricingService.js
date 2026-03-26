import { db } from './config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const PRICING_DOC = 'pricingSettings';
const CONFIG_COL  = 'appConfig';

// ─────────────────────────────────────────────
// القيم الافتراضية
// ─────────────────────────────────────────────
export const DEFAULT_PRICING = {
  // سعر الجرام لكل نوع وجبة (KWD لكل جرام)
  breakfastPerGram: 0.010,
  lunchPerGram:     0.012,
  dinnerPerGram:    0.012,
  // سعر السناك لليوم الواحد (بغض النظر عن الجرام)
  snackPerDay:      0.250,
  // مصروف اليوم الواحد (توصيل + إدارة)
  fixedCostPerDay:  0.500,
};

// ─────────────────────────────────────────────
// جلب وحفظ الإعدادات
// ─────────────────────────────────────────────
export const getPricingSettings = async () => {
  const snap = await getDoc(doc(db, CONFIG_COL, PRICING_DOC));
  return snap.exists() ? { ...DEFAULT_PRICING, ...snap.data() } : { ...DEFAULT_PRICING };
};

export const savePricingSettings = async (settings) => {
  await setDoc(doc(db, CONFIG_COL, PRICING_DOC), {
    ...settings,
    updatedAt: serverTimestamp(),
  });
};

// ─────────────────────────────────────────────
// حساب سعر الباقة المرنة
// ─────────────────────────────────────────────
export const calcCustomPrice = (subForm, pricing, totalDays) => {
  const p = pricing || DEFAULT_PRICING;
  const days   = totalDays || 0;
  const grams  = Number(subForm.protein) || 150;

  // وجبات مسموحة
  const bfCount  = subForm.allowBreakfast !== false ? (Number(subForm.allowedBreakfast) || 1) : 0;
  const lnCount  = subForm.allowLunch     !== false ? (Number(subForm.allowedLunch)     || 1) : 0;
  const dnCount  = subForm.allowDinner    !== false ? (Number(subForm.allowedDinner)    || 1) : 0;
  const snCount  = subForm.allowSnacks    !== false ? (Number(subForm.snacksNumber)     || 1) : 0;

  // الحسابات
  const breakfastCost = p.breakfastPerGram * grams * bfCount * days;
  const lunchCost     = p.lunchPerGram     * grams * lnCount * days;
  const dinnerCost    = p.dinnerPerGram    * grams * dnCount * days;
  const snackCost     = p.snackPerDay      * snCount         * days;
  const fixedCost     = p.fixedCostPerDay                    * days;

  const total = breakfastCost + lunchCost + dinnerCost + snackCost + fixedCost;

  return {
    breakfastCost: +breakfastCost.toFixed(3),
    lunchCost:     +lunchCost.toFixed(3),
    dinnerCost:    +dinnerCost.toFixed(3),
    snackCost:     +snackCost.toFixed(3),
    fixedCost:     +fixedCost.toFixed(3),
    total:         +total.toFixed(3),
    days,
    grams,
  };
};
