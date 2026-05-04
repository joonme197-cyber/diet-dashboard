import { db } from './config';
import {
  collection, addDoc, getDocs, doc,
  deleteDoc, updateDoc, setDoc, getDoc,
  query, orderBy, serverTimestamp, where
} from 'firebase/firestore';

// ── Cache بسيط ──
const _cache = {};
const TTL = 5 * 60 * 1000;
const cached = async (key, fn) => {
  const now = Date.now();
  if (_cache[key] && now - _cache[key].ts < TTL) return _cache[key].data;
  const data = await fn();
  _cache[key] = { data, ts: now };
  return data;
};
export const clearMealCache = (key) => {
  if (key) delete _cache[key];
  else Object.keys(_cache).forEach(k => delete _cache[k]);
};

// =====================
// إدارة المنيوات (Multi-Menu)
// =====================

// جلب كل المنيوات
export const getMenus = async () => {
  return cached('menus', async () => {
    const snap = await getDocs(query(collection(db, 'menus'), orderBy('createdAt', 'asc')));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  });
};

// جلب المنيو النشط
export const getActiveMenu = async () => {
  const snap = await getDocs(query(collection(db, 'menus'), where('isActive', '==', true)));
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };
  // fallback — المنيو الافتراضي القديم
  return { id: 'default', nameAr: 'المنيو الافتراضي', nameEn: 'Default Menu', isActive: true };
};

// إضافة منيو جديد
export const addMenu = async (data) => {
  return await addDoc(collection(db, 'menus'), { ...data, createdAt: serverTimestamp() });
};

// تحديث منيو
export const updateMenu = async (id, data) => {
  await updateDoc(doc(db, 'menus', id), { ...data, updatedAt: serverTimestamp() });
};

// حذف منيو
export const deleteMenu = async (id) => {
  await deleteDoc(doc(db, 'menus', id));
};

// تفعيل منيو (وإيقاف البقية)
export const activateMenu = async (menuId) => {
  const menus = await getMenus();
  const promises = menus.map(m =>
    updateDoc(doc(db, 'menus', m.id), { isActive: m.id === menuId })
  );
  await Promise.all(promises);
};

// =====================
// بيانات الوجبات الكاملة (104 وجبة)
// =====================
export const MEALS_DATA = [
  { id: 'meal_001', mealTitle: 'بيتزا أجبان مشكلة', mealTitleEn: 'Mixed Cheese Pizza', mealType: 'افطار', protein: 18, carbs: 35, fats: 10, calories: 300, isActive: true },
  { id: 'meal_002', mealTitle: 'بابا غنوج', mealTitleEn: 'Baba Ghanoush Bread', mealType: 'افطار', protein: 5, carbs: 20, fats: 6, calories: 150, isActive: true },
  { id: 'meal_003', mealTitle: 'بان كيك عسل', mealTitleEn: 'Honey Pancake', mealType: 'افطار', protein: 8, carbs: 45, fats: 5, calories: 260, isActive: true },
  { id: 'meal_004', mealTitle: 'توست بيض بالأفوكادو', mealTitleEn: 'Avocado Eggs Toast', mealType: 'افطار', protein: 16, carbs: 30, fats: 12, calories: 300, isActive: true },
  { id: 'meal_005', mealTitle: 'تورتيلا بيض بالبرتقال', mealTitleEn: 'Orange Eggs Tortilla', mealType: 'افطار', protein: 14, carbs: 32, fats: 10, calories: 280, isActive: true },
  { id: 'meal_006', mealTitle: 'توست بيض بالماسترد', mealTitleEn: 'Mustard Eggs Toast', mealType: 'افطار', protein: 15, carbs: 30, fats: 8, calories: 250, isActive: true },
  { id: 'meal_007', mealTitle: 'توست بيض مورتديلا', mealTitleEn: 'Mozzarella Eggs Toast', mealType: 'افطار', protein: 18, carbs: 30, fats: 10, calories: 280, isActive: true },
  { id: 'meal_008', mealTitle: 'توست مكس أجبان', mealTitleEn: 'Spinach Eggs Samoon', mealType: 'افطار', protein: 16, carbs: 30, fats: 12, calories: 290, isActive: true },
  { id: 'meal_009', mealTitle: 'ساندوتش بيض سكراميل', mealTitleEn: 'Caramel Eggs Toast', mealType: 'افطار', protein: 18, carbs: 35, fats: 11, calories: 310, isActive: true },
  { id: 'meal_010', mealTitle: 'ساندوتش بيض شكشوكة', mealTitleEn: 'Shakshuka Eggs Samoon', mealType: 'افطار', protein: 16, carbs: 35, fats: 10, calories: 300, isActive: true },
  { id: 'meal_011', mealTitle: 'ساندوتش بيض بالطماط', mealTitleEn: 'Tomato Eggs Samoon', mealType: 'افطار', protein: 15, carbs: 35, fats: 9, calories: 280, isActive: true },
  { id: 'meal_012', mealTitle: 'توست بيض بالنقانق', mealTitleEn: 'Sausage Eggs Toast', mealType: 'افطار', protein: 20, carbs: 30, fats: 15, calories: 340, isActive: true },
  { id: 'meal_013', mealTitle: 'توست تركى مدخن', mealTitleEn: 'Smoked Turkey Toast', mealType: 'افطار', protein: 18, carbs: 30, fats: 7, calories: 260, isActive: true },
  { id: 'meal_014', mealTitle: 'فرانش توست كراميل', mealTitleEn: 'Caramel French Toast', mealType: 'افطار', protein: 10, carbs: 45, fats: 10, calories: 320, isActive: true },
  { id: 'meal_015', mealTitle: 'ساندوتش جبنة فيتا', mealTitleEn: 'Feta Cheese Samoon', mealType: 'افطار', protein: 12, carbs: 35, fats: 9, calories: 270, isActive: true },
  { id: 'meal_016', mealTitle: 'ساندويتش قشقوان توست', mealTitleEn: 'Kashkaval Toast Sandwich', mealType: 'افطار', protein: 14, carbs: 35, fats: 11, calories: 290, isActive: true },
  { id: 'meal_017', mealTitle: 'حمسة بطاطا مع خبز', mealTitleEn: 'Potato Chunk Bread', mealType: 'افطار', protein: 8, carbs: 50, fats: 8, calories: 310, isActive: true },
  { id: 'meal_018', mealTitle: 'تورتيلا حلوم بيستو صوص', mealTitleEn: 'Halloumi Pesto Tortilla', mealType: 'افطار', protein: 16, carbs: 32, fats: 12, calories: 300, isActive: true },
  { id: 'meal_019', mealTitle: 'ساندوتش حلوم بالزعتر', mealTitleEn: 'Halloumi Zatar Samoon', mealType: 'افطار', protein: 16, carbs: 35, fats: 10, calories: 290, isActive: true },
  { id: 'meal_020', mealTitle: 'حمص باللحم المفروم مع خبز', mealTitleEn: 'Hummus Meat Bread', mealType: 'افطار', protein: 22, carbs: 35, fats: 14, calories: 360, isActive: true },
  { id: 'meal_021', mealTitle: 'فول بخلطة ريتش دايت مع خبز', mealTitleEn: 'Fowl Arabic Bread', mealType: 'افطار', protein: 14, carbs: 45, fats: 6, calories: 300, isActive: true },
  { id: 'meal_022', mealTitle: 'كرواسون لبنة فراولة', mealTitleEn: 'Labneh Strawberry Croissant', mealType: 'افطار', protein: 8, carbs: 38, fats: 14, calories: 310, isActive: true },
  { id: 'meal_023', mealTitle: 'ساندوتش لبنه مع خيار', mealTitleEn: 'Labneh Cucumber Samoon', mealType: 'افطار', protein: 10, carbs: 35, fats: 5, calories: 230, isActive: true },
  { id: 'meal_024', mealTitle: 'توست جبنة بالزعتر', mealTitleEn: "Cheese and Za'atar Toast", mealType: 'افطار', protein: 11, carbs: 35, fats: 7, calories: 240, isActive: true },
  { id: 'meal_025', mealTitle: 'توست حلوم مشوي', mealTitleEn: 'Grilled Halloumi Toast', mealType: 'افطار', protein: 19, carbs: 35, fats: 9, calories: 290, isActive: true },
  { id: 'meal_026', mealTitle: 'رول تورتيلا بيض بالكريمة', mealTitleEn: 'Egg Tortilla Roll with Cream', mealType: 'افطار', protein: 17, carbs: 32, fats: 10, calories: 280, isActive: true },
  { id: 'meal_027', mealTitle: 'ساندوتش بيض بالنقانق', mealTitleEn: 'Egg and Sausage Sandwich', mealType: 'افطار', protein: 18, carbs: 35, fats: 12, calories: 320, isActive: true },
  { id: 'meal_028', mealTitle: 'ساندوتش بيض عجة', mealTitleEn: 'Egg Omelette Sandwich', mealType: 'افطار', protein: 17, carbs: 35, fats: 10, calories: 300, isActive: true },
  { id: 'meal_029', mealTitle: 'ساندوتش بيض يوناني', mealTitleEn: 'Greek Egg Sandwich', mealType: 'افطار', protein: 10, carbs: 55, fats: 3, calories: 280, isActive: true },
  { id: 'meal_030', mealTitle: 'شوفان بالحليب والعسل', mealTitleEn: 'Oatmeal with Milk and Honey', mealType: 'افطار', protein: 8, carbs: 38, fats: 14, calories: 310, isActive: true },
  { id: 'meal_031', mealTitle: 'تشيكن شيش طاووق مع عيش', mealTitleEn: 'Shish Tawook Rice', mealType: 'غداء', protein: 32, carbs: 30, fats: 6, calories: 340, isActive: true },
  { id: 'meal_032', mealTitle: 'تشيكن بيكاتا مع عيش', mealTitleEn: 'Chicken Piccata Rice', mealType: 'غداء', protein: 32, carbs: 30, fats: 8, calories: 320, isActive: true },
  { id: 'meal_033', mealTitle: 'تشيكن بريانى', mealTitleEn: 'Chicken Biryani Rice', mealType: 'غداء', protein: 32, carbs: 30, fats: 6, calories: 370, isActive: true },
  { id: 'meal_034', mealTitle: 'مانغوليان بيف مع عيش', mealTitleEn: 'Mongolian Chicken Rice', mealType: 'غداء', protein: 29, carbs: 32, fats: 13, calories: 350, isActive: true },
  { id: 'meal_035', mealTitle: 'تشيكن 65 مع عيش', mealTitleEn: 'Chicken 65 & Rice', mealType: 'غداء', protein: 32, carbs: 32, fats: 10, calories: 380, isActive: true },
  { id: 'meal_036', mealTitle: 'تشيكن كوردن بلو مع عيش', mealTitleEn: 'Chicken Cordon Bleu with Bread', mealType: 'غداء', protein: 34, carbs: 30, fats: 12, calories: 340, isActive: true },
  { id: 'meal_037', mealTitle: 'تشيكن ستيك مع عيش', mealTitleEn: 'Chicken Steak Rice', mealType: 'غداء', protein: 32, carbs: 30, fats: 8, calories: 360, isActive: true },
  { id: 'meal_038', mealTitle: 'تشيكن كاستو مع عيش', mealTitleEn: 'Chicken Katsu Rice', mealType: 'غداء', protein: 32, carbs: 32, fats: 10, calories: 330, isActive: true },
  { id: 'meal_039', mealTitle: 'تشيكن طاجن مع عيش', mealTitleEn: 'Chicken Tajine Rice', mealType: 'غداء', protein: 32, carbs: 30, fats: 7, calories: 370, isActive: true },
  { id: 'meal_040', mealTitle: 'تشيكن نجرسكو وايت صوص', mealTitleEn: 'Chicken Negresco', mealType: 'غداء', protein: 34, carbs: 35, fats: 9, calories: 310, isActive: true },
  { id: 'meal_041', mealTitle: 'روبيان مكسيكي مع عيش', mealTitleEn: 'Mexican Shrimp Rice', mealType: 'غداء', protein: 26, carbs: 30, fats: 8, calories: 310, isActive: true },
  { id: 'meal_042', mealTitle: 'مربين مع عيش', mealTitleEn: 'Murabyan Rice', mealType: 'غداء', protein: 26, carbs: 30, fats: 8, calories: 380, isActive: true },
  { id: 'meal_043', mealTitle: 'سالمون مشوى مع عيش', mealTitleEn: 'Grilled Salmon Rice', mealType: 'غداء', protein: 26, carbs: 30, fats: 16, calories: 330, isActive: true },
  { id: 'meal_044', mealTitle: 'سمك شبنت صوص مع عيش', mealTitleEn: 'Dill Fish Rice', mealType: 'غداء', protein: 26, carbs: 30, fats: 10, calories: 290, isActive: true },
  { id: 'meal_045', mealTitle: 'سمك زيت وليمون مع أرز', mealTitleEn: 'Oil Fish Rice', mealType: 'غداء', protein: 26, carbs: 28, fats: 7, calories: 310, isActive: true },
  { id: 'meal_046', mealTitle: 'سمك صوص تمر هندى مع عيش', mealTitleEn: 'Fish with Rice', mealType: 'غداء', protein: 26, carbs: 32, fats: 8, calories: 330, isActive: true },
  { id: 'meal_047', mealTitle: 'سمك بصوص الكارى مع عيش', mealTitleEn: 'Curry Fish Rice', mealType: 'غداء', protein: 26, carbs: 32, fats: 10, calories: 360, isActive: true },
  { id: 'meal_048', mealTitle: 'بيف كباب مع عيش', mealTitleEn: 'Iraqi Kebab & Rice', mealType: 'غداء', protein: 28, carbs: 30, fats: 14, calories: 350, isActive: true },
  { id: 'meal_049', mealTitle: 'لحم سبانخ مع عيش', mealTitleEn: 'Spinach Meat Rice', mealType: 'غداء', protein: 28, carbs: 30, fats: 12, calories: 360, isActive: true },
  { id: 'meal_050', mealTitle: 'لحم داوود باشا مع عيش', mealTitleEn: 'Dawood Basha Rice', mealType: 'غداء', protein: 28, carbs: 30, fats: 14, calories: 370, isActive: true },
  { id: 'meal_051', mealTitle: 'بيف ماشروم صوص مع عيش', mealTitleEn: 'Mushroom Meat & Rice', mealType: 'غداء', protein: 29, carbs: 30, fats: 14, calories: 350, isActive: true },
  { id: 'meal_052', mealTitle: 'بيف كباب بخلطة ريتش دايت مع عيش', mealTitleEn: 'Khashkhash Rice', mealType: 'غداء', protein: 28, carbs: 30, fats: 12, calories: 380, isActive: true },
  { id: 'meal_053', mealTitle: 'استراغنوف بيف مع عيش', mealTitleEn: 'Meat Stroganoff Rice', mealType: 'غداء', protein: 29, carbs: 30, fats: 15, calories: 370, isActive: true },
  { id: 'meal_054', mealTitle: 'كبسة لحم مع عيش', mealTitleEn: 'Meat Kabsa Rice', mealType: 'غداء', protein: 29, carbs: 30, fats: 14, calories: 460, isActive: true },
  { id: 'meal_055', mealTitle: 'بيف بشاميل وايت صوص', mealTitleEn: 'Beef Bechamel with White Sauce', mealType: 'عشاء', protein: 34, carbs: 50, fats: 10, calories: 360, isActive: true },
  { id: 'meal_056', mealTitle: 'فيتوتشيني تشيكن باستا', mealTitleEn: 'Chicken Fettuccine Pasta', mealType: 'عشاء', protein: 34, carbs: 32, fats: 9, calories: 440, isActive: true },
  { id: 'meal_057', mealTitle: 'تشيكن جريل ساندوتش', mealTitleEn: 'Grilled Chicken Sandwich', mealType: 'عشاء', protein: 30, carbs: 48, fats: 12, calories: 460, isActive: true },
  { id: 'meal_058', mealTitle: 'تشيكن فاهيتا مع عيش', mealTitleEn: 'Fajita Rice', mealType: 'عشاء', protein: 34, carbs: 35, fats: 8, calories: 330, isActive: true },
  { id: 'meal_059', mealTitle: 'تشيكن سويت أند ساور', mealTitleEn: 'Sweet Sour Chicken', mealType: 'عشاء', protein: 34, carbs: 50, fats: 10, calories: 340, isActive: true },
  { id: 'meal_060', mealTitle: 'تشيكن كوردن بلو مع عيش', mealTitleEn: 'Cordon Bleu Rice', mealType: 'عشاء', protein: 32, carbs: 30, fats: 6, calories: 380, isActive: true },
  { id: 'meal_061', mealTitle: 'تشيكن شيش طاووق مع عيش', mealTitleEn: 'Shish Tawook Rice', mealType: 'عشاء', protein: 32, carbs: 35, fats: 6, calories: 330, isActive: true },
  { id: 'meal_062', mealTitle: 'تشيكن تاكو ساندوتش', mealTitleEn: 'Chicken Taco Sandwich', mealType: 'عشاء', protein: 34, carbs: 30, fats: 12, calories: 440, isActive: true },
  { id: 'meal_063', mealTitle: 'بيف كاساديا مع بطاط', mealTitleEn: 'Chicken Quesadilla Sandwich', mealType: 'عشاء', protein: 32, carbs: 30, fats: 6, calories: 380, isActive: true },
  { id: 'meal_064', mealTitle: 'مسخن تشيكن رول', mealTitleEn: 'Musakhan Roll Potato', mealType: 'عشاء', protein: 32, carbs: 48, fats: 12, calories: 430, isActive: true },
  { id: 'meal_065', mealTitle: 'تشيكن برجر كوسلو', mealTitleEn: 'Chicken Coleslaw Burger', mealType: 'عشاء', protein: 28, carbs: 30, fats: 15, calories: 440, isActive: true },
  { id: 'meal_066', mealTitle: 'تشيكن برجر سادوتش', mealTitleEn: 'Chicken Burger Potato', mealType: 'عشاء', protein: 32, carbs: 45, fats: 12, calories: 440, isActive: true },
  { id: 'meal_067', mealTitle: 'دجاج محشي مع عيش', mealTitleEn: 'Stuffed Chicken Rice', mealType: 'عشاء', protein: 30, carbs: 48, fats: 12, calories: 350, isActive: true },
  { id: 'meal_068', mealTitle: 'تشيكن أفوكادو باستا', mealTitleEn: 'Avocado Chicken Pasta', mealType: 'عشاء', protein: 30, carbs: 48, fats: 12, calories: 390, isActive: true },
  { id: 'meal_069', mealTitle: 'تشيكن ليمون باستا', mealTitleEn: 'Lemon Chicken Pasta', mealType: 'عشاء', protein: 34, carbs: 30, fats: 8, calories: 360, isActive: true },
  { id: 'meal_070', mealTitle: 'بيف ستيك مع عيش', mealTitleEn: 'Meat Steak Rice', mealType: 'عشاء', protein: 34, carbs: 32, fats: 14, calories: 370, isActive: true },
  { id: 'meal_071', mealTitle: 'تشيكن بيتزا باربكيو', mealTitleEn: 'Chicken Pizza Potato', mealType: 'عشاء', protein: 34, carbs: 30, fats: 8, calories: 420, isActive: true },
  { id: 'meal_072', mealTitle: 'بيف كباب ساندوتش', mealTitleEn: 'Kebab Sandwich & Potato', mealType: 'عشاء', protein: 29, carbs: 30, fats: 14, calories: 460, isActive: true },
  { id: 'meal_073', mealTitle: 'بيف برجر سادوتش', mealTitleEn: 'Meat burger', mealType: 'عشاء', protein: 32, carbs: 45, fats: 10, calories: 470, isActive: true },
  { id: 'meal_074', mealTitle: 'بيف كباب مع عيش', mealTitleEn: 'Meat Kebab & Rice', mealType: 'عشاء', protein: 28, carbs: 48, fats: 16, calories: 360, isActive: true },
  { id: 'meal_075', mealTitle: 'كرات لحم مع عيش', mealTitleEn: 'Meatballs Rice', mealType: 'عشاء', protein: 29, carbs: 48, fats: 17, calories: 350, isActive: true },
  { id: 'meal_076', mealTitle: 'تشيكن كاساديا ساندوتش', mealTitleEn: 'Meat Quesadilla Potato', mealType: 'عشاء', protein: 28, carbs: 30, fats: 14, calories: 430, isActive: true },
  { id: 'meal_077', mealTitle: 'باستا تشيكن ماك اند تشيز', mealTitleEn: 'Chicken Pasta', mealType: 'عشاء', protein: 28, carbs: 30, fats: 12, calories: 380, isActive: true },
  { id: 'meal_078', mealTitle: 'تشيكن سبانخ باستا', mealTitleEn: 'Spinach Chicken Pasta', mealType: 'عشاء', protein: 32, carbs: 45, fats: 12, calories: 360, isActive: true },
  { id: 'meal_079', mealTitle: 'باستا تشيكن اربياتا', mealTitleEn: 'Chicken Arrabiata Pasta', mealType: 'عشاء', protein: 34, carbs: 35, fats: 10, calories: 350, isActive: true },
  { id: 'meal_080', mealTitle: 'تشيكن بستاشيو باستا', mealTitleEn: 'Pistachio Chicken Pasta', mealType: 'عشاء', protein: 34, carbs: 32, fats: 9, calories: 390, isActive: true },
  { id: 'meal_081', mealTitle: 'بيض مسلوق مع خبز عربي', mealTitleEn: 'Boiled Eggs with Arabic Bread', mealType: 'عشاء', protein: 32, carbs: 35, fats: 7, calories: 300, isActive: true },
  { id: 'meal_082', mealTitle: 'تشيكن بيتزا باربيكيو', mealTitleEn: 'Chicken BBQ Pizza', mealType: 'عشاء', protein: 28, carbs: 30, fats: 12, calories: 380, isActive: true },
  { id: 'meal_083', mealTitle: 'تشيكن جريل ساندوتش', mealTitleEn: 'Chicken Grill Sandwich', mealType: 'عشاء', protein: 32, carbs: 45, fats: 12, calories: 360, isActive: true },
  { id: 'meal_084', mealTitle: 'تشيكن سبانخ باستا', mealTitleEn: 'Chicken Spinach Pasta', mealType: 'عشاء', protein: 34, carbs: 35, fats: 10, calories: 350, isActive: true },
  { id: 'meal_085', mealTitle: 'تشيكن برجر كول سلو', mealTitleEn: 'Chicken Burger Coleslaw', mealType: 'عشاء', protein: 34, carbs: 32, fats: 9, calories: 390, isActive: true },
  { id: 'meal_086', mealTitle: 'سلطة الشيف', mealTitleEn: "Chef's Salad", mealType: 'سناك', protein: 5, carbs: 15, fats: 6, calories: 140, isActive: true },
  { id: 'meal_087', mealTitle: 'سلطة تبولة', mealTitleEn: 'Tabbouleh Salad', mealType: 'سناك', protein: 15, carbs: 10, fats: 10, calories: 200, isActive: true },
  { id: 'meal_088', mealTitle: 'سلطة جرجير', mealTitleEn: 'Rocket Salad', mealType: 'سناك', protein: 3, carbs: 15, fats: 10, calories: 160, isActive: true },
  { id: 'meal_089', mealTitle: 'سلطة حلوم بالزعتر', mealTitleEn: "Halloumi and Za'atar Salad", mealType: 'سناك', protein: 4, carbs: 10, fats: 7, calories: 120, isActive: true },
  { id: 'meal_090', mealTitle: 'سلطة خوخ', mealTitleEn: 'Peach Salad', mealType: 'سناك', protein: 12, carbs: 10, fats: 15, calories: 230, isActive: true },
  { id: 'meal_091', mealTitle: 'سلطة ذرة', mealTitleEn: 'Corn Salad', mealType: 'سناك', protein: 3, carbs: 30, fats: 2, calories: 140, isActive: true },
  { id: 'meal_092', mealTitle: 'سلطة روب بالخيار', mealTitleEn: 'Cucumber Yogurt Salad', mealType: 'سناك', protein: 5, carbs: 30, fats: 3, calories: 160, isActive: true },
  { id: 'meal_093', mealTitle: 'سلطة روسي', mealTitleEn: 'Salad Russian', mealType: 'سناك', protein: 6, carbs: 10, fats: 3, calories: 90, isActive: true },
  { id: 'meal_094', mealTitle: 'سلطة سيزر', mealTitleEn: 'Caesar Salad', mealType: 'سناك', protein: 8, carbs: 25, fats: 6, calories: 180, isActive: true },
  { id: 'meal_095', mealTitle: 'سلطة شمندر', mealTitleEn: 'Beetroot Salad', mealType: 'سناك', protein: 15, carbs: 10, fats: 14, calories: 240, isActive: true },
  { id: 'meal_096', mealTitle: 'سلطة فاصوليا حمراء', mealTitleEn: 'Red Bean Salad', mealType: 'سناك', protein: 3, carbs: 25, fats: 2, calories: 120, isActive: true },
  { id: 'meal_097', mealTitle: 'سلطة فتوش', mealTitleEn: 'Fattoush Salad', mealType: 'سناك', protein: 8, carbs: 30, fats: 3, calories: 170, isActive: true },
  { id: 'meal_098', mealTitle: 'سلطة كلو سلو', mealTitleEn: 'Cole Slaw', mealType: 'سناك', protein: 4, carbs: 25, fats: 8, calories: 180, isActive: true },
  { id: 'meal_099', mealTitle: 'سلطة ماشروم', mealTitleEn: 'Mushroom Salad', mealType: 'سناك', protein: 6, carbs: 10, fats: 8, calories: 130, isActive: true },
  { id: 'meal_100', mealTitle: 'سلطة يونانية', mealTitleEn: 'Greek Salad', mealType: 'سناك', protein: 8, carbs: 10, fats: 12, calories: 190, isActive: true },
  { id: 'meal_101', mealTitle: 'سويت', mealTitleEn: 'Sweet', mealType: 'سناك', protein: 5, carbs: 40, fats: 8, calories: 250, isActive: true },
  { id: 'meal_102', mealTitle: 'عصير', mealTitleEn: 'Juice', mealType: 'سناك', protein: 1, carbs: 35, fats: 0, calories: 140, isActive: true },
  { id: 'meal_103', mealTitle: 'فواكة', mealTitleEn: 'Fruit', mealType: 'سناك', protein: 1, carbs: 22, fats: 0, calories: 90, isActive: true },
];

// رفع الوجبات لـ Firebase دفعة واحدة
export const uploadMealsToFirebase = async () => {
  let count = 0;
  for (const meal of MEALS_DATA) {
    await setDoc(doc(db, 'meals', meal.id), meal);
    count++;
  }
  return count;
};

// جلب كل الوجبات
export const getMeals = async () => {
  const snap = await getDocs(collection(db, 'meals'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

// جلب وجبات حسب النوع
export const getMealsByType = (meals, type) =>
  meals.filter(m => m.mealType === type && m.isActive);

// =====================
// المنيو اليومي
// =====================
const DAYS = ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
export const CYCLE_DAYS = [];
for (let w = 1; w <= 4; w++) {
  for (const d of DAYS) {
    CYCLE_DAYS.push({ label: `${d} ${w}`, week: w, day: d, key: `w${w}_${d}` });
  }
}

// حفظ منيو يوم معين
export const saveMenuDay = async (menuType, dayKey, meals, menuId = 'default') => {
  const docId = `${menuId}_${menuType}_${dayKey}`;
  await setDoc(doc(db, 'menuSettings', docId), {
    menuId, menuType, dayKey, meals, updatedAt: serverTimestamp()
  });
  // امسح الـ cache عشان يتحدث
  clearMealCache(`fullmenu_${menuId}_${menuType}`);
  clearMealCache(`menu_${menuId}_${menuType}_${dayKey}`);
};

// جلب منيو يوم معين
export const getMenuDay = async (menuType, dayKey, menuId = 'default') => {
  // أول نجرب بالـ menuId الجديد
  const snap = await getDoc(doc(db, 'menuSettings', `${menuId}_${menuType}_${dayKey}`));
  if (snap.exists()) return snap.data();
  // fallback للـ format القديم (backward compat)
  const oldSnap = await getDoc(doc(db, 'menuSettings', `${menuType}_${dayKey}`));
  return oldSnap.exists() ? oldSnap.data() : null;
};

// جلب كل منيو (default أو chef) لمنيو معين
export const getFullMenu = async (menuType, menuId = 'default') => {
  return cached(`fullmenu_${menuId}_${menuType}`, async () => {
    const snap = await getDocs(collection(db, 'menuSettings'));
    const result = {};
    snap.docs.forEach(d => {
      const data = d.data();
      const matchNew = data.menuId === menuId && data.menuType === menuType;
      const matchOld = !data.menuId && menuId === 'default' && data.menuType === menuType;
      if (matchNew || matchOld) result[data.dayKey] = data.meals;
    });
    return result;
  });
};

// =====================
// اختيارات العميل اليومية
// =====================

// حفظ اختيارات عميل ليوم معين
export const saveClientDailyMeals = async (clientId, date, meals) => {
  // date = 'YYYY-MM-DD'
  const key = `${clientId}_${date}`;
  await setDoc(doc(db, 'clientDailyMeals', key), {
    clientId, date, meals, updatedAt: serverTimestamp()
  });
};

// جلب اختيارات عميل ليوم معين
export const getClientDailyMeals = async (clientId, date) => {
  const key = `${clientId}_${date}`;
  const snap = await getDoc(doc(db, 'clientDailyMeals', key));
  return snap.exists() ? snap.data().meals : null;
};

// جلب كل اختيارات عميل
export const getClientAllMeals = async (clientId) => {
  const snap = await getDocs(collection(db, 'clientDailyMeals'));
  return snap.docs
    .filter(d => d.data().clientId === clientId)
    .map(d => d.data());
};

// =====================
// استيراد المنيو من Excel
// =====================
export const importMenuFromExcel = async (file, menuType, menuId = 'default', allMeals = []) => {
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  // تخطي الهيدر
  const dataRows = rows.slice(1).filter(r => r && r.length > 0);

  const DAYS = ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
  const MEAL_TYPES_ORDER = ['افطار','غداء','عشاء','سناك'];

  // بناء خريطة الوجبات بالاسم → id
  const mealMap = {};
  allMeals.forEach(m => {
    if (m.mealTitle) mealMap[m.mealTitle.trim()] = m.id;
    if (m.mealTitleEn) mealMap[m.mealTitleEn.trim().toLowerCase()] = m.id;
  });

  let savedDays = 0;
  let skippedMeals = [];

  for (const row of dataRows) {
    const weekText = String(row[0] || '').trim();
    const dayText  = String(row[1] || '').trim();

    // استخراج رقم الأسبوع
    const weekMatch = weekText.match(/(\d+)/);
    const weekNum = weekMatch ? parseInt(weekMatch[1]) : null;
    if (!weekNum || weekNum < 1 || weekNum > 4) continue;

    // التحقق من اليوم
    const dayIdx = DAYS.indexOf(dayText);
    if (dayIdx === -1) continue;

    const dayKey = `w${weekNum}_${dayText}`;
    const mealIds = [];

    // كل نوع وجبة له 3 أعمدة (col 2,3,4 = فطور1,فطور2,فطور3 ... إلخ)
    for (let typeIdx = 0; typeIdx < MEAL_TYPES_ORDER.length; typeIdx++) {
      for (let slot = 0; slot < 3; slot++) {
        const colIdx = 2 + typeIdx * 3 + slot;
        const cellVal = String(row[colIdx] || '').trim();
        if (!cellVal) continue;

        // بحث عن الوجبة بالاسم
        const mealId = mealMap[cellVal] || mealMap[cellVal.toLowerCase()];
        if (mealId) {
          if (!mealIds.includes(mealId)) mealIds.push(mealId);
        } else {
          skippedMeals.push({ day: dayKey, meal: cellVal });
        }
      }
    }

    if (mealIds.length > 0) {
      await saveMenuDay(menuType, dayKey, mealIds, menuId);
      savedDays++;
    }
  }

  // تنظيف الكاش
  clearMealCache(`fullmenu_${menuId}_${menuType}`);

  return { savedDays, skippedMeals };
};

// تحميل سامبل المنيو مع الوجبات الحالية
export const generateMenuSampleExcel = async (allMeals = []) => {
  const XLSX = await import('xlsx');

  const DAYS = ['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
  const MEAL_TYPES = ['افطار','غداء','عشاء','سناك'];
  const MEAL_ICONS = { افطار:'🍳', غداء:'🍛', عشاء:'🌙', سناك:'🥗' };

  // الشيت الرئيسي
  const headers = ['الأسبوع', 'اليوم'];
  MEAL_TYPES.forEach(mt => {
    headers.push(`${MEAL_ICONS[mt]} ${mt} 1`);
    headers.push(`${MEAL_ICONS[mt]} ${mt} 2`);
    headers.push(`${MEAL_ICONS[mt]} ${mt} 3`);
  });

  const templateData = [headers];
  for (let w = 1; w <= 4; w++) {
    for (const d of DAYS) {
      const row = [`الأسبوع ${w}`, d];
      for (let i = 0; i < 12; i++) row.push('');
      templateData.push(row);
    }
  }

  // شيت قائمة الوجبات
  const mealsListData = [MEAL_TYPES.map(mt => `${MEAL_ICONS[mt]} ${mt}`)];
  const byType = {};
  MEAL_TYPES.forEach(mt => byType[mt] = []);
  allMeals.forEach(m => {
    if (byType[m.mealType]) byType[m.mealType].push(m.mealTitle);
  });
  const maxLen = Math.max(...Object.values(byType).map(a => a.length), 1);
  for (let i = 0; i < maxLen; i++) {
    mealsListData.push(MEAL_TYPES.map(mt => byType[mt][i] || ''));
  }

  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet(templateData);
  const ws2 = XLSX.utils.aoa_to_sheet(mealsListData);

  // عرض الأعمدة
  ws1['!cols'] = [{ wch:12 }, { wch:12 }, ...Array(12).fill({ wch:28 })];
  ws2['!cols'] = Array(4).fill({ wch:35 });

  XLSX.utils.book_append_sheet(wb, ws1, 'Menu Template');
  XLSX.utils.book_append_sheet(wb, ws2, 'قائمة الوجبات');

  const buffer = XLSX.write(wb, { bookType:'xlsx', type:'array' });
  const blob = new Blob([buffer], { type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  // تحميل تلقائي
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'menu_sample.xlsx';
  a.click();
  URL.revokeObjectURL(url);
};

