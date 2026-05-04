import { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from './firebase/config';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// ─── تعريف الصلاحيات لكل دور ───
export const ROLES = {
  super_admin: {
    label: 'Super Admin',
    labelAr: 'مدير عام',
    permissions: ['*'], // كل الصلاحيات
  },
  manager: {
    label: 'Manager',
    labelAr: 'مدير',
    permissions: [
      'clients.view','clients.add','clients.edit',
      'subscriptions.view','subscriptions.add','subscriptions.edit',
      'meals.view','meals.edit',
      'labels.print',
      'reports.view',
      'delivery.view','delivery.edit',
      'menu.view','menu.edit',
      'packages.view','packages.edit',
    ],
  },
  kitchen: {
    label: 'Kitchen Staff',
    labelAr: 'موظف مطبخ',
    permissions: [
      'clients.view',
      'subscriptions.view',
      'meals.view',
      'labels.print',
      'reports.production',
      'menu.view',
    ],
  },
  delivery: {
    label: 'Delivery Staff',
    labelAr: 'موظف توصيل',
    permissions: [
      'clients.view',
      'subscriptions.view',
      'delivery.view',
      'reports.delivery',
      'labels.print',
    ],
  },
  accountant: {
    label: 'Accountant',
    labelAr: 'محاسب',
    permissions: [
      'clients.view',
      'subscriptions.view',
      'reports.view',
      'reports.financial',
    ],
  },
  viewer: {
    label: 'Viewer',
    labelAr: 'مشاهد فقط',
    permissions: [
      'clients.view',
      'subscriptions.view',
      'meals.view',
      'reports.view',
    ],
  },
};

// ─── الـ Context ───
const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser]         = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // جلب بيانات المستخدم من Firestore
        const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        const data = snap.exists() ? snap.data() : null;
        setUser(firebaseUser);
        setUserData(data);
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result;
  };

  const logout = () => signOut(auth);

  // فحص الصلاحية — يدعم custom permissions per user
  const can = (permission) => {
    if (!userData) return false;
    // Super Admin كل الصلاحيات
    if (userData.role === 'super_admin') return true;
    // لو عنده customPermissions → استخدمها بدل الـ role
    if (userData.customPermissions?.length > 0) {
      return userData.customPermissions.includes(permission) ||
             userData.customPermissions.includes('*');
    }
    // fallback للـ role الافتراضي
    const role = ROLES[userData.role];
    if (!role) return false;
    if (role.permissions.includes('*')) return true;
    return role.permissions.includes(permission);
  };

  // كل الصلاحيات الفعلية للمستخدم
  const getPermissions = () => {
    if (!userData) return [];
    if (userData.role === 'super_admin') return ['*'];
    if (userData.customPermissions?.length > 0) return userData.customPermissions;
    return ROLES[userData.role]?.permissions || [];
  };

  // هل المستخدم Super Admin؟
  const isSuperAdmin = userData?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{ user, userData, loading, login, logout, can, isSuperAdmin, getPermissions }}>
      {children}
    </AuthContext.Provider>
  );
};
