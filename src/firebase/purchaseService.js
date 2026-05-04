import { db } from './config';
import {
  collection, addDoc, getDocs, doc, updateDoc, deleteDoc,
  serverTimestamp, query, orderBy, writeBatch
} from 'firebase/firestore';
import { adjustStock } from './inventoryService';
import { updateSupplierBalance } from './supplierService';

const COL = 'purchases';

export async function getPurchases() {
  const snap = await getDocs(query(collection(db, COL), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addPurchase(data) {
  const totalAmount = data.items.reduce((s, i) => s + (i.quantity * i.unitCost), 0);
  const paidAmount = Number(data.paidAmount) || 0;
  const paymentStatus = paidAmount >= totalAmount ? 'paid'
    : paidAmount > 0 ? 'partial' : 'pending';

  const ref = await addDoc(collection(db, COL), {
    ...data,
    totalAmount,
    paidAmount,
    paymentStatus,
    createdAt: serverTimestamp(),
  });

  for (const item of data.items) {
    if (item.ingredientId) await adjustStock(item.ingredientId, Number(item.quantity));
  }
  if (data.supplierId) {
    await updateSupplierBalance(data.supplierId, totalAmount - paidAmount);
  }
  return ref;
}

export async function updatePurchasePayment(id, paidAmount, supplierId, totalAmount) {
  const snap = await getDocs(collection(db, COL));
  const pur = snap.docs.find(d => d.id === id);
  if (!pur) return;
  const prev = pur.data();
  const newPaid = Number(paidAmount);
  const paymentStatus = newPaid >= totalAmount ? 'paid'
    : newPaid > 0 ? 'partial' : 'pending';
  await updateDoc(doc(db, COL, id), { paidAmount: newPaid, paymentStatus });
  if (supplierId) {
    const delta = (prev.paidAmount || 0) - newPaid;
    await updateSupplierBalance(supplierId, delta);
  }
}

export async function deletePurchase(id) {
  return deleteDoc(doc(db, COL, id));
}

// Bulk import purchases — one row = one purchase with one item
// suppliers: array of {id, name} for matching by name
// inventory: array of {id, name} for matching ingredient by name
export async function bulkAddPurchases(rows, suppliers = [], inventory = []) {
  const batch = writeBatch(db);
  let count = 0;
  rows.forEach(row => {
    const supName = row['المورد'] || row.supplier || '';
    const ingName = row['المكون'] || row.ingredient || '';
    const sup = suppliers.find(s => s.name === supName);
    const ing = inventory.find(i => i.name === ingName);
    const quantity = Number(row['الكمية'] || row.quantity || 0);
    const unitCost = Number(row['سعر الوحدة'] || row.unitCost || 0);
    const totalAmount = quantity * unitCost;
    const paidAmount = Number(row['المبلغ المدفوع'] || row.paidAmount || 0);
    const paymentStatus = paidAmount >= totalAmount ? 'paid'
      : paidAmount > 0 ? 'partial' : 'pending';
    const ref = doc(collection(db, COL));
    batch.set(ref, {
      supplierId: sup?.id || '',
      supplierName: supName,
      date: row['التاريخ'] || row.date || new Date().toISOString().slice(0,10),
      items: [{
        ingredientId: ing?.id || '',
        name: ingName,
        quantity, unitCost,
      }],
      totalAmount, paidAmount, paymentStatus,
      notes: row['ملاحظات'] || row.notes || '',
      createdAt: serverTimestamp(),
    });
    count++;
  });
  await batch.commit();
  return count;
}

export function getPurchaseStats(purchases) {
  const total = purchases.reduce((s, p) => s + (p.totalAmount || 0), 0);
  const paid  = purchases.reduce((s, p) => s + (p.paidAmount  || 0), 0);
  return { total, paid, pending: total - paid };
}
