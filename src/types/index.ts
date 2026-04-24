export interface Product {
  id: string;
  model: string;
  costUSD: number;
  salePriceTL: number;
  role: 'HERO' | 'SUPPORT' | 'WEAK';
  // Extra costs per unit (defaults)
  shippingCost: number;  // shipping cost per unit in USD
  customsCost: number;   // customs cost per unit in USD
  packagingCost: number; // packaging cost per unit in USD
}

export interface BasketItem {
  productId: string;
  quantity: number;
}

export interface OrderCosts {
  shipping: number;
  customs: number;
  inland: number;
  other: number;
}