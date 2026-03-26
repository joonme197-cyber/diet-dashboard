# 🥗 Diet Plan Admin Dashboard
## نظام إدارة اشتراكات الوجبات الصحية

مشروع React + Firebase لإدارة عملاء نظام الوجبات الصحية.

---

## 📦 المتطلبات
- Node.js 18+
- مشروع Firebase (Firestore)

---

## 🚀 خطوات التشغيل

### 1. إعداد Firebase
اذهب إلى [Firebase Console](https://console.firebase.google.com/) وأنشئ مشروعاً جديداً:
1. أنشئ **Firestore Database** (ابدأ في Test Mode)
2. اذهب إلى **Project Settings > General > Your apps**
3. أضف Web App وانسخ بيانات الـ Config

### 2. تحديث إعدادات Firebase
افتح الملف `src/firebase/config.js` وعدّل البيانات:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",           // 👈 ضع مفتاحك هنا
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. تثبيت المكتبات وتشغيل المشروع

```bash
npm install
npm run dev
```

افتح المتصفح على: `http://localhost:5173`

---

## 📁 هيكل المشروع

```
src/
├── components/
│   ├── Sidebar.jsx        # القائمة الجانبية
│   └── StickerLabel.jsx   # مكون الاستيكر للطباعة
├── firebase/
│   ├── config.js          # ⚙️ إعدادات Firebase (عدّل هنا)
│   └── clientService.js   # دوال CRUD للعملاء
├── pages/
│   ├── Dashboard.jsx      # الصفحة الرئيسية
│   ├── AddClient.jsx      # إضافة عميل جديد
│   ├── ClientsList.jsx    # قائمة العملاء
│   └── LabelsPage.jsx     # صفحة طباعة الملصقات
├── styles/
│   └── main.css           # التصميم الكامل
├── App.jsx                # التوجيه والهيكل العام
└── main.jsx               # نقطة البداية
```

---

## ✨ الميزات

| الميزة | الوصف |
|--------|-------|
| 👥 إدارة العملاء | إضافة وعرض وحذف العملاء |
| 📦 Normal Bundle | باقة جاهزة مع تاريخ بدء واختيار الباقة |
| ✨ Custom Bundle | باقة مرنة مع تحديد البروتين والكارب والأيام |
| 🔥 Firebase | حفظ البيانات في Firestore في الوقت الفعلي |
| 🏷️ طباعة الاستيكر | استيكر احترافي مع كل بيانات العميل |
| 📍 بيانات العنوان | محافظة، قطعة، شارع، منزل، دور، شقة |
| 🔍 بحث | بحث بالاسم أو الهاتف أو الكود |
| 📱 متجاوب | يعمل على كل الأحجام |

---

## 🏷️ الاستيكر (Label)

الاستيكر يحتوي على:
- 🆔 كود العميل (Q#xxx)
- 👤 الاسم ورقم الهاتف
- 💪 P (بروتين) / C (كارب)
- 📍 العنوان مختصر (B/S/J/H/F/APT)
- ⚠️ الموانع الغذائية (بالأحمر)
- ⏳ الأيام المتبقية في الاشتراك
- 📅 تواريخ البدء والانتهاء

---

## 🛠️ Firestore Security Rules (مهم)

بعد الانتهاء من التطوير، عدّل Rules في Firebase Console:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /clients/{document} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 📞 الدعم الفني
المشروع مبني حسب المواصفات من ملف `مشروع_تصميم_تطبيق_وجبات_صحية.docx`
