import { getAllSubscriptions } from './subscriptionService';
import { getExpenses, sumExpenses } from './expenseService';
import { getPurchases, getPurchaseStats } from './purchaseService';
import { getInventory, calcInventoryValue } from './inventoryService';

// ── Helpers ──

// Parse a date-ish value (Firestore Timestamp, ISO string, or Date)
function parseDate(d) {
  if (!d) return null;
  if (d.toDate) return d.toDate();
  return new Date(d);
}

// Sum payments with payment date in target month (Cash Basis Accounting)
// Falls back to subscription createdAt if payment has no date.
function sumPaymentsInMonth(subscriptions, yr, mo) {
  let total = 0;
  subscriptions.forEach(sub => {
    const subDate = parseDate(sub.createdAt);
    (sub.payments || []).forEach(p => {
      const pd = parseDate(p.date) || subDate;
      if (pd && pd.getFullYear() === yr && pd.getMonth() + 1 === mo) {
        total += Number(p.amount) || 0;
      }
    });
  });
  return total;
}

// Sum all-time payments on a list of subscriptions
function sumAllPayments(subscriptions) {
  return subscriptions.reduce((sum, sub) => {
    const paid = (sub.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
    return sum + paid;
  }, 0);
}

// Filter purchases whose document/transaction date is in target month
function filterPurchasesByMonth(purchases, yr, mo) {
  return purchases.filter(p => {
    const d = parseDate(p.date) || parseDate(p.createdAt);
    return d && d.getFullYear() === yr && d.getMonth() + 1 === mo;
  });
}

// ── Public API ──

export async function getFinanceSummary(monthYear) {
  const [subs, expenses, purchases, inventory] = await Promise.all([
    getAllSubscriptions(),
    getExpenses(monthYear),
    getPurchases(),
    getInventory(),
  ]);

  // Revenue: CASH BASIS — count payments whose date falls in target month
  let revenue = 0;
  let monthPurchases = purchases;
  if (monthYear) {
    const [yr, mo] = monthYear.split('-').map(Number);
    revenue = sumPaymentsInMonth(subs, yr, mo);
    monthPurchases = filterPurchasesByMonth(purchases, yr, mo);
  } else {
    revenue = sumAllPayments(subs);
  }

  // Purchase total (this month's purchases only)
  const purchaseTotal = monthPurchases.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0);

  // Expenses (already filtered by month if monthYear provided)
  const expenseTotal = sumExpenses(expenses);
  const fixedExpenses = sumExpenses(expenses.filter(e => e.type === 'fixed'));
  const variableExpenses = sumExpenses(expenses.filter(e => e.type === 'variable'));

  // ── Profit (estimated, NOT proper P&L) ──
  // Approximation: assumes COGS ≈ Purchases (i.e., closing stock ≈ opening stock).
  // For accurate figures, see /profit-loss page which uses opening + purchases - closing.
  const estimatedProfit = revenue - purchaseTotal - expenseTotal;
  const profitMargin = revenue > 0 ? ((estimatedProfit / revenue) * 100).toFixed(1) : 0;
  const inventoryValue = calcInventoryValue(inventory);

  // ── Active subscriptions (STOCK metric — count ALL active, not filtered by month) ──
  const activeSubs = subs.filter(s => s.status === 'active').length;
  // Subscriptions created in this month (cohort metric)
  let createdThisMonth = subs.length;
  if (monthYear) {
    const [yr, mo] = monthYear.split('-').map(Number);
    createdThisMonth = subs.filter(s => {
      const d = parseDate(s.createdAt);
      return d && d.getFullYear() === yr && d.getMonth() + 1 === mo;
    }).length;
  }

  const revenuePerSub = activeSubs > 0 ? revenue / activeSubs : 0;
  const costPerSub = activeSubs > 0 ? purchaseTotal / activeSubs : 0;
  const margin = revenuePerSub - costPerSub;
  const breakEvenSubs = margin > 0 ? Math.ceil(fixedExpenses / margin) : null;

  return {
    revenue,
    purchaseTotal,
    expenseTotal,
    fixedExpenses,
    variableExpenses,
    profit: estimatedProfit,
    profitMargin: Number(profitMargin),
    inventoryValue,
    activeSubs,
    totalSubs: createdThisMonth,
    revenuePerSub,
    breakEvenSubs,
    isEstimated: true, // flag: profit is approximate; use /profit-loss for proper P&L
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

    // Revenue: cash basis — payments dated this month
    const revenue = Number(sumPaymentsInMonth(subs, yr, mo)) || 0;

    // Cost: purchases this month + expenses this month (approx COGS + OpEx)
    const monthPurchases = filterPurchasesByMonth(purchases, yr, mo);
    const monthExpenses = expenses.filter(e => e.year === yr && e.month === mo);
    const cost = monthPurchases.reduce((s, p) => s + (Number(p.totalAmount) || 0), 0)
      + Number(sumExpenses(monthExpenses) || 0);

    // Subs created this month (for cohort metric)
    const subsCreated = subs.filter(s => {
      const sd = parseDate(s.createdAt);
      return sd && sd.getFullYear() === yr && sd.getMonth() + 1 === mo;
    }).length;

    months.push({ label, revenue, cost, profit: revenue - cost, subs: subsCreated });
  }
  return months;
}
