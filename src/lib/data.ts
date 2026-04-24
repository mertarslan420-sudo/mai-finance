import { Product, BasketItem, OrderCosts } from '../types';

export const DEFAULT_EXCHANGE_RATE = 44;
export const COMMISSION_RATE = 0.18; // Amazon %18
export const ADS_RATE = 0.05; // %5

export const PRODUCTS: Product[] = [
  { id: 't7', model: 'T7', costUSD: 3.9, salePriceTL: 849, role: 'HERO', shippingCost: 0.5, customsCost: 1.2, packagingCost: 0.3 },
  { id: 't9', model: 'T9', costUSD: 8.0, salePriceTL: 1699, role: 'SUPPORT', shippingCost: 0.7, customsCost: 1.5, packagingCost: 0.4 },
  { id: 'minix1', model: 'MINIX1', costUSD: 3.5, salePriceTL: 549, role: 'SUPPORT', shippingCost: 0.3, customsCost: 0.8, packagingCost: 0.2 },
  { id: 'dc08', model: 'DC08', costUSD: 4.0, salePriceTL: 699, role: 'SUPPORT', shippingCost: 0.4, customsCost: 1.0, packagingCost: 0.3 },
  { id: 'md9', model: 'MD9', costUSD: 6.9, salePriceTL: 1199, role: 'WEAK', shippingCost: 0.6, customsCost: 1.3, packagingCost: 0.35 },
  { id: 'eb05', model: 'EB05', costUSD: 7.0, salePriceTL: 1299, role: 'WEAK', shippingCost: 0.6, customsCost: 1.3, packagingCost: 0.35 },
];

export function getProduct(id: string, productList: Product[] = PRODUCTS): Product | undefined {
  return productList.find(p => p.id === id);
}

export interface ProfitBreakdown {
  revenue: number;
  baseCost: number;
  landedCost: number;
  landedCostPerUnit: number;
  extraCostPerUnit: number;
  totalCost: number;
  commission: number;
  adsCost: number;
  netProfit: number;
  margin: number;
  marginAfterVAT: number;
  vatAmount: number;
}

export function calculateProfitBreakdown(item: BasketItem, costs: OrderCosts, vatRate: number = 0, productList?: Product[], commissionRate: number = COMMISSION_RATE, adsRate: number = ADS_RATE): ProfitBreakdown {
  const product = getProduct(item.productId, productList);
  if (!product) {
    return { revenue: 0, baseCost: 0, landedCost: 0, landedCostPerUnit: 0, extraCostPerUnit: 0, totalCost: 0, commission: 0, adsCost: 0, netProfit: 0, margin: 0, marginAfterVAT: 0, vatAmount: 0 };
  }

  const { quantity } = item;
  const salePriceInclVAT = product.salePriceTL;

  // If VAT is included in sale price, extract net sale price
  const salePriceExclVAT = vatRate > 0 ? salePriceInclVAT / (1 + vatRate) : salePriceInclVAT;
  const vatPerUnit = vatRate > 0 ? salePriceInclVAT - salePriceExclVAT : 0;
  const totalVatAmount = vatPerUnit * quantity;

  // Revenue (net of VAT)
  const revenue = salePriceExclVAT * quantity;

  // Base cost (USD cost converted to TL)
  const baseCost = product.costUSD * DEFAULT_EXCHANGE_RATE;

  // Landed cost per unit (base + all per-unit import costs)
  const landedCostPerUnit = baseCost
    + ((product.shippingCost || 0) * DEFAULT_EXCHANGE_RATE)
    + ((product.customsCost || 0) * DEFAULT_EXCHANGE_RATE)
    + ((product.packagingCost || 0) * DEFAULT_EXCHANGE_RATE);

  // Order-level costs distributed per unit
  const orderLevelPerUnit = quantity > 0
    ? (costs.shipping + costs.customs + costs.inland + costs.other) / quantity
    : 0;

  // Total cost = (landedCostPerUnit * qty) + (orderLevelPerUnit * qty)
  const totalCost = (landedCostPerUnit * quantity) + (orderLevelPerUnit * quantity);

  // Commissions and ads (on net sale price)
  const commission = revenue * commissionRate;
  const adsCost = revenue * adsRate;

  // Net profit (after VAT removal, commission, ads, and costs)
  const netProfit = revenue - commission - adsCost - totalCost;

  // Margin
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  // VAT amount is what we collected but don't keep (passed to tax authority)
  const marginAfterVAT = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  return {
    revenue,
    baseCost: baseCost * quantity,
    landedCost: landedCostPerUnit * quantity,
    landedCostPerUnit,
    extraCostPerUnit: orderLevelPerUnit,
    totalCost,
    commission,
    adsCost,
    netProfit,
    margin,
    marginAfterVAT,
    vatAmount: totalVatAmount
  };
}

export function calculateNetProfit(item: BasketItem, costs: OrderCosts): {
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  landedCostPerUnit: number;
} {
  const breakdown = calculateProfitBreakdown(item, costs);
  return {
    revenue: breakdown.revenue,
    cost: breakdown.totalCost,
    profit: breakdown.netProfit,
    margin: breakdown.margin,
    landedCostPerUnit: breakdown.landedCostPerUnit
  };
}

export function formatTL(amount: number): string {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
}

export function getRoleBadgeColor(role: string): string {
  switch (role) {
    case 'HERO': return 'bg-yellow-100 text-yellow-800';
    case 'SUPPORT': return 'bg-blue-100 text-blue-800';
    case 'WEAK': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}