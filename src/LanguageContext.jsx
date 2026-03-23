import { createContext, useContext, useState } from 'react';

// =============================================
// بيانات المحافظات والمناطق
// =============================================
export const REGIONS_DATA = [
  {
    key: 'capital', nameEn: 'Capital', nameAr: 'العاصمة',
    regions: [
      {nameEn:'Adailiya',nameAr:'العديلية'},{nameEn:'Northwest Sulaibikhat',nameAr:'شمال غرب الصليبيخات'},
      {nameEn:'Qairawan',nameAr:'القيروان'},{nameEn:'Jaber Al Ahmad',nameAr:'جابر الأحمد'},
      {nameEn:'Nahda',nameAr:'النهضة'},{nameEn:'Sulaibikhat and Doha',nameAr:'الصليبيخات والدوحة'},
      {nameEn:'Granada',nameAr:'غرناطة'},{nameEn:'Rai',nameAr:'الري'},
      {nameEn:'Shuwaikh',nameAr:'الشويخ'},{nameEn:'Yarmouk',nameAr:'اليرموك'},
      {nameEn:'Surra',nameAr:'السرة'},{nameEn:'Cordoba',nameAr:'قرطبة'},
      {nameEn:'Qadisiya',nameAr:'القادسية'},{nameEn:'Khalidiya',nameAr:'الخالدية'},
      {nameEn:'Rawda',nameAr:'الروضة'},{nameEn:'Shamiya',nameAr:'الشامية'},
      {nameEn:'Faiha',nameAr:'الفيحاء'},{nameEn:'Nuzha',nameAr:'النزهة'},
      {nameEn:'Abdullah Al Salem Suburb',nameAr:'ضاحية عبدالله السالم'},
      {nameEn:'Mansouriya',nameAr:'المنصورية'},{nameEn:'Kaifan',nameAr:'كيفان'},
      {nameEn:'Daiya',nameAr:'الدعية'},{nameEn:'Dasma',nameAr:'دسمان'},
      {nameEn:'Doha',nameAr:'الدوحة'},{nameEn:'Abdullah Al Salem',nameAr:'عبدالله السالم'},
      {nameEn:'Bneid Al Gar',nameAr:'بنيد القار'},{nameEn:'Mirqab',nameAr:'المرقاب'},
      {nameEn:'Sharq',nameAr:'شرق'},{nameEn:'Jibla',nameAr:'جبلة'},
      {nameEn:'Salhiya',nameAr:'الصالحية'},{nameEn:'Kuwait City',nameAr:'مدينة الكويت'},
      {nameEn:'Sulaibiya',nameAr:'الصليبية'},{nameEn:'Shuwaikh Industrial',nameAr:'شويخ الصناعي'},
    ]
  },
  {
    key: 'hawalli', nameEn: 'Hawalli', nameAr: 'حولي',
    regions: [
      {nameEn:'Hawally',nameAr:'حولي'},{nameEn:'Martyrs',nameAr:'الشهداء'},
      {nameEn:'Salam',nameAr:'السلام'},{nameEn:'Hattin',nameAr:'حطين'},
      {nameEn:'Siddiq',nameAr:'الصديق'},{nameEn:'Jabriya',nameAr:'الجابرية'},
      {nameEn:'Salwa',nameAr:'سلوى'},{nameEn:'Bayan',nameAr:'بيان'},
      {nameEn:'Mishref',nameAr:'مشرف'},{nameEn:'Rumaithiya',nameAr:'الرميثية'},
      {nameEn:'Salmiya',nameAr:'السالمية'},{nameEn:'Bidaa',nameAr:'البدع'},
      {nameEn:'Shaab',nameAr:'الشعب'},{nameEn:'Zahra',nameAr:'الزهراء'},
      {nameEn:'Nugra',nameAr:'النقرة'},{nameEn:'Rabiya',nameAr:'الرابية'},
    ]
  },
  {
    key: 'farwaniya', nameEn: 'Farwaniya', nameAr: 'الفروانية',
    regions: [
      {nameEn:'Al Dajeej',nameAr:'الدجيج'},{nameEn:'Abdullah Al Mubarak',nameAr:'عبدالله المبارك'},
      {nameEn:'Sabah Al Nasser',nameAr:'صباح الناصر'},{nameEn:'Al Rai Industrial',nameAr:'الري الصناعي'},
      {nameEn:'Al Raqqa',nameAr:'الرقعي'},{nameEn:'Khaitan',nameAr:'خيطان'},
      {nameEn:'Ardiya',nameAr:'العارضية'},{nameEn:'Andalus',nameAr:'الأندلس'},
      {nameEn:'Farwaniya',nameAr:'الفروانية'},{nameEn:'Jleeb Al Shuyoukh',nameAr:'جليب الشيوخ'},
      {nameEn:'Omariya',nameAr:'العمرية'},{nameEn:'Abu Fatira',nameAr:'أبو فطيرة'},
      {nameEn:'Fnaitees',nameAr:'الفنيطيس'},{nameEn:'Subhan',nameAr:'صبحان'},
      {nameEn:'Messila',nameAr:'المسيلة'},{nameEn:'Adan',nameAr:'عدان'},
      {nameEn:'Qurain',nameAr:'القرين'},{nameEn:'South Wista',nameAr:'جنوب وسطى'},
      {nameEn:'Sabah Al Salem',nameAr:'صباح السالم'},{nameEn:'Rigai',nameAr:'الرقعي'},
      {nameEn:'Rai',nameAr:'الري'},
    ]
  },
  {
    key: 'mubarak', nameEn: 'Mubarak Al-Kabeer', nameAr: 'مبارك الكبير',
    regions: [
      {nameEn:'Al Masayel',nameAr:'المسايل'},{nameEn:'Mubarak Al Kabeer',nameAr:'مبارك الكبير'},
      {nameEn:'Funaitees',nameAr:'الفنيطيس'},{nameEn:'Subhan',nameAr:'صبحان'},
      {nameEn:'Abu Al Hasaniya',nameAr:'أبو الحصانية'},{nameEn:'Abu Halifa',nameAr:'أبو حليفة'},
      {nameEn:'Sabah Al Salem',nameAr:'صباح السالم'},{nameEn:'Qurain',nameAr:'القرين'},
      {nameEn:'Messila',nameAr:'المسيلة'},{nameEn:'Fnaitees',nameAr:'الفنيطيس'},
      {nameEn:'West Abdullah Mubarak',nameAr:'غرب عبدالله مبارك'},
    ]
  },
  {
    key: 'ahmadi', nameEn: 'Ahmadi', nameAr: 'الأحمدي',
    regions: [
      {nameEn:'West Abdullah Mubarak',nameAr:'غرب عبدالله مبارك'},
      {nameEn:'Umm Al Hayman',nameAr:'أم الهيمان'},
      {nameEn:'Fahd Al Ahmad Suburb',nameAr:'ضاحية فهد الأحمد'},
      {nameEn:'Jaber Al Ali',nameAr:'جابر العلي'},{nameEn:'Ahmadi',nameAr:'الأحمدي'},
      {nameEn:'Abu Halifa',nameAr:'أبو حليفة'},{nameEn:'Fahaheel',nameAr:'الفحيحيل'},
      {nameEn:'Mahboula',nameAr:'المهبولة'},{nameEn:'Riqqa',nameAr:'الرقة'},
      {nameEn:'Mangaf',nameAr:'المنقف'},{nameEn:'Fintas',nameAr:'الفنطاس'},
      {nameEn:'Sabah Al Salem',nameAr:'صباح السالم'},{nameEn:'Adan',nameAr:'عدان'},
      {nameEn:'Qurain',nameAr:'القرين'},{nameEn:'Abu Fatira',nameAr:'أبو فطيرة'},
    ]
  },
  {
    key: 'jahra', nameEn: 'Jahra', nameAr: 'الجهراء',
    regions: [
      {nameEn:'Al Waha',nameAr:'الواحة'},{nameEn:'Al Subiya',nameAr:'الصبية'},
      {nameEn:'Saad Al Abdullah',nameAr:'سعد العبدالله'},
      {nameEn:'New Jahra',nameAr:'الجهراء الجديدة'},{nameEn:'Old Jahra',nameAr:'الجهراء القديمة'},
      {nameEn:'Jahra',nameAr:'الجهراء'},{nameEn:'Naeem',nameAr:'النعيم'},
      {nameEn:'Oyoun',nameAr:'العيون'},{nameEn:'Qasr',nameAr:'القصر'},
      {nameEn:'Taima',nameAr:'تيماء'},{nameEn:'Sulaibiya',nameAr:'الصليبية'},
    ]
  },
];

// =============================================
// ترجمات النظام
// =============================================
const TRANSLATIONS = {
  ar: {
    home:'الرئيسية', clients:'العملاء', clientsList:'قائمة العملاء',
    addClient:'إضافة عميل', newSubscription:'اشتراك جديد',
    subscriptions:'الاشتراكات', packages:'الباقات', categories:'التصنيفات',
    meals:'الوجبات', labels:'طباعة الملصقات', menuSettings:'إعدادات المنيو',
    clientMeals:'وجبات العميل', delivery:'التوصيل', reports:'التقارير المالية',
    save:'حفظ', cancel:'إلغاء', delete:'حذف', edit:'تعديل',
    add:'إضافة', search:'بحث', loading:'جاري التحميل...', noData:'لا يوجد بيانات',
    actions:'الإجراءات', clientName:'الاسم الكامل', phone:'رقم الهاتف',
    email:'البريد الإلكتروني', gender:'الجنس', male:'ذكر', female:'أنثى',
    allergy:'الموانع الغذائية', deliveryPeriod:'فترة التوصيل', clientCode:'كود العميل',
    governorate:'المحافظة', region:'المنطقة', block:'القطعة',
    street:'الشارع', alley:'الجادة', building:'المنزل', floor:'الدور', apartment:'الشقة',
    bundleType:'نوع الباقة', normalBundle:'باقة ثابتة', customBundle:'باقة مرنة',
    startDate:'تاريخ البدء', endDate:'تاريخ الانتهاء', duration:'المدة',
    weeks:'أسابيع', week:'أسبوع', protein:'البروتين', carbs:'الكارب',
    mealsNumber:'عدد الوجبات', snacksNumber:'عدد السناك', paymentMethod:'طريقة الدفع',
    amount:'المبلغ', daysLeft:'يوم متبقي',
    active:'نشط', upcoming:'قادم', expired:'منتهي', cancelled:'ملغي',
    breakfast:'الفطور', lunch:'الغداء', dinner:'العشاء', snacks:'السناك',
    dislikes:'الموانع', deliveryNote:'ملاحظة التوصيل',
    totalClients:'إجمالي العملاء', activeSubscriptions:'اشتراكات نشطة',
  },
  en: {
    home:'Home', clients:'Clients', clientsList:'Clients List',
    addClient:'Add Client', newSubscription:'New Subscription',
    subscriptions:'Subscriptions', packages:'Packages', categories:'Categories',
    meals:'Meals', labels:'Print Labels', menuSettings:'Menu Settings',
    clientMeals:'Client Meals', delivery:'Delivery', reports:'Financial Reports',
    save:'Save', cancel:'Cancel', delete:'Delete', edit:'Edit',
    add:'Add', search:'Search', loading:'Loading...', noData:'No data found',
    actions:'Actions', clientName:'Full Name', phone:'Phone Number',
    email:'Email', gender:'Gender', male:'Male', female:'Female',
    allergy:'Food Restrictions', deliveryPeriod:'Delivery Period', clientCode:'Client Code',
    governorate:'Governorate', region:'Region', block:'Block',
    street:'Street', alley:'Avenue', building:'House', floor:'Floor', apartment:'Apartment',
    bundleType:'Bundle Type', normalBundle:'Normal Bundle', customBundle:'Custom Bundle',
    startDate:'Start Date', endDate:'End Date', duration:'Duration',
    weeks:'Weeks', week:'Week', protein:'Protein', carbs:'Carbs',
    mealsNumber:'Meals Number', snacksNumber:'Snacks Number', paymentMethod:'Payment Method',
    amount:'Amount', daysLeft:'Days Left',
    active:'Active', upcoming:'Upcoming', expired:'Expired', cancelled:'Cancelled',
    breakfast:'Breakfast', lunch:'Lunch', dinner:'Dinner', snacks:'Snacks',
    dislikes:'Dislikes', deliveryNote:'Delivery Note',
    totalClients:'Total Clients', activeSubscriptions:'Active Subscriptions',
  }
};

// =============================================
// Language Context
// =============================================
const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'ar');

  const toggleLang = () => {
    const newLang = lang === 'ar' ? 'en' : 'ar';
    setLang(newLang);
    localStorage.setItem('lang', newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  };

  const t = TRANSLATIONS[lang] || TRANSLATIONS.ar;

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t, isAr: lang === 'ar' }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
