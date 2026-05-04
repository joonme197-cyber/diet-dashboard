/* eslint-disable */
const {onRequest} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getAuth} = require("firebase-admin/auth");
const {getFirestore, FieldValue} = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();
const auth = getAuth();

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// 1. طلب كود إعادة تعيين الباسورد
exports.requestPasswordReset = onRequest({cors: true}, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({error: "Method not allowed"});
  }
  const {phone} = req.body;
  if (!phone) return res.status(400).json({error: "رقم الهاتف مطلوب"});

  try {
    const snap = await db.collection("clients")
      .where("phone", "==", phone).limit(1).get();
    if (snap.empty) {
      return res.status(404).json({error: "رقم الهاتف غير مسجل"});
    }
    const clientDoc = snap.docs[0];
    const client = clientDoc.data();

    // ولّد كود جديد في كل مرة
    const otp = generateOTP();

    // احفظ الكود في Firestore بدون وقت انتهاء — يمسح بعد الاستخدام فقط
    await db.collection("passwordResets").doc(clientDoc.id).set({
      clientId: clientDoc.id,
      clientName: client.name,
      phone,
      otp,
      used: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    // حدّث ملف العميل عشان يظهر الكود في الداش بورد
    await db.collection("clients").doc(clientDoc.id).update({
      pendingResetOTP: otp,
    });

    res.json({success: true, clientName: client.name});
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.message});
  }
});

// 2. التحقق من الكود وتغيير الباسورد
exports.resetPasswordWithOTP = onRequest({cors: true}, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({error: "Method not allowed"});
  }
  const {phone, otp, newPassword} = req.body;
  if (!phone || !otp || !newPassword) {
    return res.status(400).json({error: "جميع الحقول مطلوبة"});
  }
  if (newPassword.length < 6) {
    return res.status(400).json({error: "كلمة المرور 6 أحرف على الأقل"});
  }

  try {
    const snap = await db.collection("clients")
      .where("phone", "==", phone).limit(1).get();
    if (snap.empty) {
      return res.status(404).json({error: "رقم الهاتف غير مسجل"});
    }
    const clientDoc = snap.docs[0];
    const client = clientDoc.data();

    const resetDoc = await db.collection("passwordResets")
      .doc(clientDoc.id).get();
    if (!resetDoc.exists) {
      return res.status(400).json({error: "لا يوجد طلب إعادة تعيين"});
    }
    const resetData = resetDoc.data();

    if (resetData.otp !== otp) {
      return res.status(400).json({error: "الكود غير صحيح"});
    }
    if (resetData.used) {
      return res.status(400).json({error: "تم استخدام هذا الكود مسبقاً — اطلب كوداً جديداً"});
    }

    const loginEmail = client.loginEmail || client.email;
    if (!loginEmail) {
      return res.status(400).json({error: "لا يوجد حساب مرتبط بهذا الرقم"});
    }

    const userRecord = await auth.getUserByEmail(loginEmail);
    await auth.updateUser(userRecord.uid, {password: newPassword});

    // امسح الكود بعد الاستخدام
    await db.collection("passwordResets").doc(clientDoc.id).update({used: true});
    await db.collection("clients").doc(clientDoc.id).update({
      pendingResetOTP: null,
    });

    res.json({success: true, message: "تم تغيير كلمة المرور بنجاح"});
  } catch (err) {
    console.error(err);
    res.status(500).json({error: err.message});
  }
});

// ── أوتو-سيليكت لعميل محدد بعد إلغاء التجميد ──
exports.autoSelectForClient = onRequest({cors: true}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'});
  try {
    const { clientId, date, subscriptionId } = req.body;
    if (!clientId || !date) return res.status(400).json({error: 'بيانات ناقصة'});

    // جلب الاشتراك
    const subSnap = subscriptionId
      ? await db.collection('subscriptions').doc(subscriptionId).get()
      : null;
    const activeSub = subSnap?.exists ? { id: subSnap.id, ...subSnap.data() } : null;
    if (!activeSub) return res.json({ success: false, reason: 'no subscription' });

    // التحقق إن اليوم ضمن الاشتراك
    if (date < activeSub.startDate || date > activeSub.endDate) {
      return res.json({ success: false, reason: 'date outside subscription' });
    }

    // جلب المنيو لهذا اليوم
    const start  = activeSub.startDate || date;
    const startD = new Date(start), targetD = new Date(date);
    const diff   = Math.floor((targetD - startD) / 86400000);
    const cycle  = ((diff % 28) + 28) % 28;
    const week   = Math.floor(cycle / 7) + 1;
    const DAYS   = ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
    const DAY_MAP = [1,2,3,4,5,6,0];
    const dk = `w${week}_${DAYS[DAY_MAP[targetD.getDay()]]}`;

    // جلب المنيو
    let menuSnap = await db.collection('menuSettings').doc(`default_${dk}`).get();
    if (!menuSnap.exists) menuSnap = await db.collection('menuSettings').doc(`chef_${dk}`).get();
    if (!menuSnap.exists) return res.json({ success: false, reason: 'no menu' });
    const menuMealIds = menuSnap.data()?.meals || [];
    if (!menuMealIds.length) return res.json({ success: false, reason: 'empty menu' });

    // جلب بيانات الوجبات
    const mealsSnap = await db.collection('meals').get();
    const allMeals  = mealsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const menuMeals = menuMealIds.map(id => allMeals.find(m => m.id === id)).filter(Boolean);

    // الوجبات الموجودة مسبقاً
    const existKey  = `${clientId}_${date}`;
    const existSnap = await db.collection('clientDailyMeals').doc(existKey).get();
    const existing  = existSnap.exists ? (existSnap.data()?.meals || {}) : {};

    const allowMap = {
      'افطار': activeSub.allowBreakfast !== false,
      'غداء':  activeSub.allowLunch     !== false,
      'عشاء':  activeSub.allowDinner    !== false,
      'سناك':  activeSub.allowSnacks    !== false,
    };
    const maxPerType = {
      'افطار': !allowMap['افطار'] ? 0 : (activeSub.allowedBreakfast || 0),
      'غداء':  !allowMap['غداء']  ? 0 : (activeSub.allowedLunch     || activeSub.mealsNumber || 0),
      'عشاء':  !allowMap['عشاء']  ? 0 : (activeSub.allowedDinner    || 0),
      'سناك':  !allowMap['سناك']  ? 0 : (activeSub.snacksNumber     || 0),
    };

    const mealsLimit = activeSub.mealsNumber || 999;
    let mealsBudget  = mealsLimit;
    const sections   = ['افطار','غداء','عشاء','سناك'];
    const selections = {};

    for (const sec of sections) {
      const curr  = (existing[sec] || []);
      const perMax = maxPerType[sec];
      if (!allowMap[sec] || perMax === 0) { selections[sec] = curr; continue; }
      const available = menuMeals.filter(m => m.mealType === sec);
      const existIds  = curr.map(m => m.id);
      const effectiveTarget = sec === 'سناك' ? perMax : Math.min(perMax, curr.length + mealsBudget);
      if (curr.length >= effectiveTarget) { selections[sec] = curr; continue; }
      const toAdd = available.filter(m => !existIds.includes(m.id))
        .slice(0, effectiveTarget - curr.length)
        .map(m => ({ id: m.id, title: m.mealTitle || '' }));
      if (sec !== 'سناك') mealsBudget -= toAdd.length;
      selections[sec] = [...curr, ...toAdd];
    }

    const totalBefore = Object.values(existing).reduce((s,a) => s + (a?.length||0), 0);
    const totalAfter  = Object.values(selections).reduce((s,a) => s + (a?.length||0), 0);

    if (totalAfter > totalBefore) {
      await db.collection('clientDailyMeals').doc(existKey).set({
        clientId, date, meals: selections, updatedAt: new Date(),
      }, { merge: true });
      return res.json({ success: true, added: totalAfter - totalBefore });
    }

    res.json({ success: true, reason: 'already has meals' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ── إنشاء حساب Firebase Auth للعميل ──
exports.createClientAuth = onRequest({cors: true}, async (req, res) => {
  try {
    const { clientId, phone, name } = req.body;
    if (!clientId || !phone) return res.status(400).json({error: 'بيانات ناقصة'});

    const loginEmail = `${phone}@dietkw.com`;
    const password   = phone; // كلمة المرور الافتراضية = رقم الهاتف

    let uid;
    try {
      // لو الحساب موجود — احذفه وأعيد إنشاءه
      const existing = await auth.getUserByEmail(loginEmail);
      await auth.deleteUser(existing.uid);
    } catch {}

    const userRecord = await auth.createUser({
      email: loginEmail, password, displayName: name,
    });
    uid = userRecord.uid;

    // ربط الـ uid بالعميل في Firestore
    await db.collection('clients').doc(clientId).update({
      uid, loginEmail,
    });

    res.json({ success: true, uid, loginEmail });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});
