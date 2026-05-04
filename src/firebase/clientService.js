import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  getDoc,
  query,
  orderBy
} from "firebase/firestore";
import { db } from "./config";

const CLIENTS_COLLECTION = "clients";

// Get all clients
export const getClients = async () => {
  const q = query(collection(db, CLIENTS_COLLECTION), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
};

// Get single client
export const getClientById = async (id) => {
  const ref = doc(db, CLIENTS_COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return {
    id: snap.id,
    ...snap.data(),
  };
};

// Add client
export const addClient = async (clientData) => {
  const docRef = await addDoc(collection(db, CLIENTS_COLLECTION), {
    ...clientData,
    createdAt: new Date(),
  });
  return docRef.id;
};

// Update client
export const updateClient = async (id, updatedData) => {
  const ref = doc(db, CLIENTS_COLLECTION, id);
  await updateDoc(ref, updatedData);
};

// Delete client
export const deleteClient = async (id) => {
  const ref = doc(db, CLIENTS_COLLECTION, id);
  await deleteDoc(ref);
};