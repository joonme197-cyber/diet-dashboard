import { getAllSubscriptions } from './subscriptionService';
import { getExpenses, sumExpenses } from './expenseService';
import { getPurchases, getPurchaseStats } from './purchaseService';
import { getInventory, calcInventoryValue } from './inventoryService';

function calcRevenue(subscriptions) {
  return subscriptions.reduce((sum, sub) => {
    const paid = (sub.payments || []).reduce((s, p) => s + (p.amount || 0), 0);
    return sum + paid;
  }, 0);
}

export async function getFinanceSummary(monthYear) {
  const [subs, expenses, purchases, inventory] = await Promise.all([
    getAllSubscriptions(),
    getExpenses(monthYear),
    getPurchases(),
    getInventory(),
  ]);

  let filteredSubs = subs;
  if (monthYear) {
    const [yr, mo] = monthYear.split('-').map(Number);
    filteredSubs = subs.filter(s => {
      const d = s.createdAt?.toDate?.() || new Date(s.createdAt);
      return d.getFullYear() === yr && d.getMonth() + 1 === mo;
    });
  }

  const revenue = calcRevenue(filteredSubs);
  const { total: purchaseTotal } = getPurchaseStats(purchases);
  const expenseTotal = sumExpenses(expenses);
  const profit = revenue - purchaseTotal - expenseTotal;
  const profitMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
  const inventoryValue = calcInventoryValue(inventory);

  const fixedExpenses = sumExpenses(expenses.filter(e => e.type === 'fixed'));
  const variableExpenses = sumExpenses(expenses.filter(e => e.type === 'variable'));
  const activeSubs = filteredSubs.filter(s => s.status === 'active').length;
  const revenuePerSub = activeSubs > 0 ? revenue / activeSubs : 0;
  const costPerSub = activeSubs > 0 ? purchaseTotal / activeSubs : 0;
  const margin = revenuePerSub - costPerSub;
  const breakEvenSubs = margin > 0 ? Math.ceil(fixedExpenses / margin) : null;

  return {
    revenue, purchaseTotal, expenseTotal, fixedExpenses, variableExpenses,
    profit, profitMargin: Number(profitMargin), inventoryValue,
    activeSubs, totalSubs: filteredSubs.length, revenuePerSub, breakEvenSubs,
  };
}

export async function getMonthlyTrend() {
  const [subs, expenses, purchases] = await Promise.all([
    getAllSubscriptions(), getExpenses(), getPurchases(),
  ]);

  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = d.getFullYear();
    const mo = d.getMonth() + 1;
    const label = d.toLocaleDateString('ar-KW', { month: 'short', year: '2-digit' });

    const monthSubs = subs.filter(s => {
      const sd = s.createdAt?.toDate?.() || new Date(s.createdAt);
      return sd.getFullYear() === yr && sd.getMonth() + 1 === mo;
    });
    const monthExpenses = expenses.filter(e => e.year === yr && e.month === mo);
    const monthPurchases = purchases.filter(p => {
      const pd = p.createdAt?.toDate?.() || new Date(p.createdAt);
      return pd.getFullYear() === yr && pd.getMonth() + 1 === mo;
    });

    const revenue = calcRevenue(monthSubs);
    const cost = monthPurchases.reduce((s, p) => s + (p.totalAmount || 0), 0)
      + sumExpenses(monthExpenses);
    months.push({ label, revenue, cost, profit: revenue - cost, subs: monthSubs.length });
  }
  return months;
}
