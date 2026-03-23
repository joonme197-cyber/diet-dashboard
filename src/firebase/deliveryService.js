import { db } from './config';
import {
  collection, addDoc, getDocs, doc,
  deleteDoc, updateDoc, setDoc, getDoc,
  serverTimestamp, query, orderBy, where
} from 'firebase/firestore';

// المحافظات الكويتية مع مناطقها
export const KUWAIT_GOVERNORATES = {
  'العاصمة': ['الشويخ','الروضة','السرة','السالمية','الرميثية','بيان','مشرف','الرابية','كيفان','الفحيحيل','الدعية','المنصورية','الزهراء'],
  'حولي': ['حولي','السالمية','الرميثية','بيان','مشرف','الرابية','كيفان','الجابرية','النقرة','البدع','الشعب','حطين','الزهراء','الدعية','السلام'],
  'الفروانية': ['الفروانية','خيطان','الرقعي','العارضية','الأندلس','أبو فطيرة','الري','العمرية','الجليب','جليب الشيوخ','الضجيج'],
  'مبارك الكبير': ['مبارك الكبير','أبو حليفة','صباح السالم','العقيلة','المسيلة','الفنيطيس','بنيدر'],
  'الأحمدي': ['الأحمدي','الفحيحيل','الرقة','ضاحية فهد الأحمد','المنقف','أبو حليفة','الظهر','العقيلة','صباح الأحمد'],
  'الجهراء': ['الجهراء','القصر','تيماء','النسيم','الواحة','كاظمة','الوهاب','الأمغرة'],
};

// =====================
// مناطق التوصيل (Zones)
// =====================
export const getZones = async () => {
  const snap = await getDocs(query(collection(db, 'deliveryZones'), orderBy('createdAt', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addZone = async (data) => {
  return await addDoc(collection(db, 'deliveryZones'), { ...data, createdAt: serverTimestamp() });
};

export const updateZone = async (id, data) => {
  await updateDoc(doc(db, 'deliveryZones', id), data);
};

export const deleteZone = async (id) => {
  await deleteDoc(doc(db, 'deliveryZones', id));
};

// =====================
// فترات التوصيل
// =====================
export const getDeliveryPeriods = async () => {
  const snap = await getDocs(collection(db, 'deliveryPeriods'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addDeliveryPeriod = async (data) => {
  return await addDoc(collection(db, 'deliveryPeriods'), { ...data, createdAt: serverTimestamp() });
};

export const deleteDeliveryPeriod = async (id) => {
  await deleteDoc(doc(db, 'deliveryPeriods', id));
};

// =====================
// السائقون
// =====================
export const getDrivers = async () => {
  const snap = await getDocs(query(collection(db, 'drivers'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addDriver = async (data) => {
  return await addDoc(collection(db, 'drivers'), { ...data, zones: data.zones || [], createdAt: serverTimestamp() });
};

export const updateDriver = async (id, data) => {
  await updateDoc(doc(db, 'drivers', id), data);
};

export const deleteDriver = async (id) => {
  await deleteDoc(doc(db, 'drivers', id));
};
