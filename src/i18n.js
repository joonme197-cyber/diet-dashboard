// ===================================================
// نظام الترجمة الثنائي (عربي / English)
// ===================================================

export const translations = {
  ar: {
    // Navigation
    dashboard: 'الرئيسية',
    clients: 'العملاء',
    clientsList: 'قائمة العملاء',
    addClient: 'إضافة عميل',
    newSubscription: 'اشتراك جديد',
    subscriptions: 'الاشتراكات',
    packages: 'الباقات',
    categories: 'التصنيفات',
    meals: 'الوجبات',
    printLabels: 'طباعة الملصقات',
    menuSettings: 'إعدادات المنيو',
    clientMeals: 'وجبات العميل',
    delivery: 'التوصيل',
    reports: 'التقارير المالية',

    // Common
    add: 'إضافة',
    edit: 'تعديل',
    delete: 'حذف',
    save: 'حفظ',
    cancel: 'إلغاء',
    search: 'بحث',
    loading: 'جاري التحميل...',
    noData: 'لا توجد بيانات',
    actions: 'الإجراءات',
    status: 'الحالة',
    date: 'التاريخ',
    name: 'الاسم',
    phone: 'الهاتف',
    email: 'البريد الإلكتروني',
    address: 'العنوان',
    notes: 'ملاحظات',
    total: 'الإجمالي',
    active: 'نشط',
    inactive: 'غير نشط',

    // Client
    clientName: 'اسم العميل',
    clientCode: 'كود العميل',
    gender: 'الجنس',
    male: 'ذكر',
    female: 'أنثى',
    allergy: 'الحساسية / الموانع',
    deliveryPeriod: 'فترة التوصيل',
    governorate: 'المحافظة',
    region: 'المنطقة',
    block: 'القطعة',
    street: 'الشارع',
    alley: 'الجادة',
    building: 'المنزل',
    floor: 'الدور',
    apartment: 'الشقة',

    // Subscription
    subscription: 'الاشتراك',
    startDate: 'تاريخ البدء',
    endDate: 'تاريخ الانتهاء',
    duration: 'المدة',
    weeks: 'أسابيع',
    daysLeft: 'يوم متبقي',
    frozen: 'مجمد',
    renew: 'تجديد',
    normalBundle: 'باقة ثابتة',
    customBundle: 'باقة مرنة',
    protein: 'البروتين',
    carbs: 'الكارب',
    mealsNumber: 'عدد الوجبات',
    snacksNumber: 'عدد السناك',

    // Payment
    payment: 'الدفع',
    paymentMethod: 'طريقة الدفع',
    amount: 'المبلغ',
    paid: 'مدفوع',
    pending: 'آجل',
    cash: 'كاش',

    // Meals
    breakfast: 'الفطور',
    lunch: 'الغداء',
    dinner: 'العشاء',
    snacks: 'السناك',

    // Days
    saturday: 'السبت',
    sunday: 'الأحد',
    monday: 'الاثنين',
    tuesday: 'الثلاثاء',
    wednesday: 'الأربعاء',
    thursday: 'الخميس',
    friday: 'الجمعة',

    // Delivery
    zone: 'المنطقة',
    driver: 'السائق',
    shift: 'الشيفت',
    deliveryZones: 'مناطق التوصيل',
    drivers: 'السائقون',
    deliveryPeriods: 'فترات التوصيل',
    driverAssignment: 'توزيع السائقين',

    // Status
    statusActive: 'نشط',
    statusUpcoming: 'قادم',
    statusExpired: 'منتهي',
    statusCancelled: 'ملغي',
    statusPaused: 'مجمد',

    // Sticker
    dislikes: 'الموانع',
    deliveryNote: 'ملاحظة التوصيل',
    daysLeftLabel: 'يوم متبقي',

    // Governorates
    govCapital: 'العاصمة',
    govHawalli: 'حولي',
    govFarwaniya: 'الفروانية',
    govAhmadi: 'الأحمدي',
    govJahra: 'الجهراء',
    govMubarak: 'مبارك الكبير',
  },

  en: {
    // Navigation
    dashboard: 'Dashboard',
    clients: 'Clients',
    clientsList: 'Clients List',
    addClient: 'Add Client',
    newSubscription: 'New Subscription',
    subscriptions: 'Subscriptions',
    packages: 'Packages',
    categories: 'Categories',
    meals: 'Meals',
    printLabels: 'Print Labels',
    menuSettings: 'Menu Settings',
    clientMeals: 'Client Meals',
    delivery: 'Delivery',
    reports: 'Financial Reports',

    // Common
    add: 'Add',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    search: 'Search',
    loading: 'Loading...',
    noData: 'No data found',
    actions: 'Actions',
    status: 'Status',
    date: 'Date',
    name: 'Name',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    notes: 'Notes',
    total: 'Total',
    active: 'Active',
    inactive: 'Inactive',

    // Client
    clientName: 'Client Name',
    clientCode: 'Client Code',
    gender: 'Gender',
    male: 'Male',
    female: 'Female',
    allergy: 'Allergy / Dislikes',
    deliveryPeriod: 'Delivery Period',
    governorate: 'Governorate',
    region: 'Region',
    block: 'Block',
    street: 'Street',
    alley: 'Avenue',
    building: 'House',
    floor: 'Floor',
    apartment: 'Apartment',

    // Subscription
    subscription: 'Subscription',
    startDate: 'Start Date',
    endDate: 'End Date',
    duration: 'Duration',
    weeks: 'Weeks',
    daysLeft: 'Days Left',
    frozen: 'Frozen',
    renew: 'Renew',
    normalBundle: 'Normal Bundle',
    customBundle: 'Custom Bundle',
    protein: 'Protein',
    carbs: 'Carbs',
    mealsNumber: 'Meals Number',
    snacksNumber: 'Snacks Number',

    // Payment
    payment: 'Payment',
    paymentMethod: 'Payment Method',
    amount: 'Amount',
    paid: 'Paid',
    pending: 'Pending',
    cash: 'Cash',

    // Meals
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snacks: 'Snacks',

    // Days
    saturday: 'Saturday',
    sunday: 'Sunday',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',

    // Delivery
    zone: 'Zone',
    driver: 'Driver',
    shift: 'Shift',
    deliveryZones: 'Delivery Zones',
    drivers: 'Drivers',
    deliveryPeriods: 'Delivery Periods',
    driverAssignment: 'Driver Assignment',

    // Status
    statusActive: 'Active',
    statusUpcoming: 'Upcoming',
    statusExpired: 'Expired',
    statusCancelled: 'Cancelled',
    statusPaused: 'Paused',

    // Sticker
    dislikes: 'Dislikes',
    deliveryNote: 'Delivery Note',
    daysLeftLabel: 'Days Left',

    // Governorates
    govCapital: 'Capital',
    govHawalli: 'Hawalli',
    govFarwaniya: 'Farwaniya',
    govAhmadi: 'Ahmadi',
    govJahra: 'Jahra',
    govMubarak: 'Mubarak Al-Kabeer',
  }
};

export const t = (lang, key) => translations[lang]?.[key] || translations['en']?.[key] || key;
