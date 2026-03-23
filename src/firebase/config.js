import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCA8Rkw-uVhg2Pdr7FLJGQP1kgDSFggmyk",
  authDomain: "diet-dashborad.firebaseapp.com",
  projectId: "diet-dashborad",
  storageBucket: "diet-dashborad.firebasestorage.app",
  messagingSenderId: "267202054963",
  appId: "1:267202054963:web:b1505f7f5a109b50940c46"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;