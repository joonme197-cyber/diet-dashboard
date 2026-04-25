import { db } from './config';
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, where, writeBatch
} from 'firebase/firestore';

const COL = 'expenses';

export const EXPENSE_CATEGORIES = {
  fixed: [
    { key: 'rent',       label: 'إيجار' },
    { key: 'salaries',   label: 'رواتب' },
    { key: 'utilities',  label: 'كهرباء وماء' },
    { key: 'insurance',  label: 'تأمين' },
  ],
  variable: [
    { key: 'marketing',  label: 'إعلانات وتسويق' },
    { key: 'delivery',   label: 'توصيل' },
    { key: 'packaging',  label: 'تغليف' },
    { key: 'maintenance',label: 'صيانة' },
    { key: 'other',      label: 'أخرى' },
  ],
};

export async function getExpenses(monthYear) {
  let q;
  if (monthYear) {
    const [year, month] = monthYear.split('-');
    q = query(
      collection(db, COL),
      where('year', '==', Number(year)),
      where('month', '==', Number(month)),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(collection(db, COL), orderBy('createdAt', 'desc'));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addExpense(data) {
  const date = new Date(data.date);
  return addDoc(collection(db, COL), {
    ...data,
    amount: Number(data.amount),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    createdAt: serverTimestamp(),
  });
}

export async function updateExpense(id, data) {
  const date = new Date(data.date);
  return updateDoc(doc(db, COL, id), {
    ...data,
    amount: Number(data.amount),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  });
}

export async function deleteExpense(id) {
  return deleteDoc(doc(db, COL, id));
}

export async function bulkAddExpenses(rows) {
  const batch = writeBatch(db);
  let count = 0;
  rows.forEach(row => {
    const dateStr = row['التاريخ'] || row.date || new Date().toISOString().slice(0, 10);
    const date = new Date(dateStr);
    const ref = doc(collection(db, COL));
    batch.set(ref, {
      type: row['النوع'] === 'متغير' || row.type === 'variable' ? 'variable' : 'fixed',
      category: row['الفئة'] || row.category || 'other',
      amount: Number(row['المبلغ'] || row.amount || 0),
      date: dateStr,
      description: row['الوصف'] || row.description || '',
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      createdAt: serverTimestamp(),
    });
    count++;
  });
  await batch.commit();
  return count;
}

export function sumExpenses(expenses) {
  return expenses.reduce((s, e) => s + (e.amount || 0), 0);
}

export function groupExpensesByCategory(expenses) {
  return expenses.reduce((acc, e) => {
    const key = e.category || 'other';
    acc[key] = (acc[key] || 0) + (e.amount || 0);
    return acc;
  }, {});
}
