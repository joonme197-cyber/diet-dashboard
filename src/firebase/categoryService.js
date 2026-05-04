import { db } from './config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const INVENTORY_DEFAULTS = [
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

const EXPENSE_DEFAULTS = {
  fixed: [
    { key: 'rent',       code: 'RNT', nameAr: 'إيجار',         nameEn: 'Rent' },
    { key: 'salaries',   code: 'SAL', nameAr: 'رواتب',          nameEn: 'Salaries' },
    { key: 'utilities',  code: 'UTL', nameAr: 'كهرباء وماء',    nameEn: 'Utilities' },
    { key: 'insurance',  code: 'INS', nameAr: 'تأمين',          nameEn: 'Insurance' },
  ],
  variable: [
    { key: 'marketing',   code: 'MKT', nameAr: 'إعلانات وتسويق', nameEn: 'Marketing' },
    { key: 'delivery',    code: 'DLV', nameAr: 'توصيل',           nameEn: 'Delivery' },
    { key: 'packaging',   code: 'PKG', nameAr: 'تغليف',           nameEn: 'Packaging' },
    { key: 'maintenance', code: 'MNT', nameAr: 'صيانة',           nameEn: 'Maintenance' },
    { key: 'other',       code: 'OTH', nameAr: 'أخرى',            nameEn: 'Other' },
  ],
};

// Helper: get display label given language
export function getCatLabel(cat, lang = 'ar') {
  if (!cat) return '';
  if (lang === 'en') return cat.nameEn || cat.nameAr || cat.label || cat.key;
  return cat.nameAr || cat.label || cat.key;
}

export async function getInventoryCategories() {
  const ref = doc(db, 'settings', 'inventoryCategories');
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().items?.length) return snap.data().items;
  return INVENTORY_DEFAULTS;
}

export async function setInventoryCategories(items) {
  const ref = doc(db, 'settings', 'inventoryCategories');
  return setDoc(ref, { items, updatedAt: serverTimestamp() });
}

export async function getExpenseCategories() {
  const ref = doc(db, 'settings', 'expenseCategories');
  const snap = await getDoc(ref);
  if (snap.exists() && (snap.data().fixed?.length || snap.data().variable?.length)) {
    return {
      fixed: snap.data().fixed || EXPENSE_DEFAULTS.fixed,
      variable: snap.data().variable || EXPENSE_DEFAULTS.variable,
    };
  }
  return EXPENSE_DEFAULTS;
}

export async function setExpenseCategories(items) {
  const ref = doc(db, 'settings', 'expenseCategories');
  return setDoc(ref, { ...items, updatedAt: serverTimestamp() });
}

export { INVENTORY_DEFAULTS, EXPENSE_DEFAULTS };
