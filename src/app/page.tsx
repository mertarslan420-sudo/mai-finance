'use client';

import React, { useState, useEffect } from 'react';
import { PRODUCTS, calculateProfitBreakdown, calculateNetProfit, formatTL, getRoleBadgeColor } from '../lib/data';
import { BasketItem, OrderCosts, Product } from '../types';

type Tab = 'products' | 'order' | 'dashboard';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [products, setProducts] = useState<Product[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mai_products');
      return saved ? JSON.parse(saved) : PRODUCTS;
    }
    return PRODUCTS;
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // Load from localStorage
  const [basket, setBasket] = useState<BasketItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mai_basket');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [costs, setCosts] = useState<OrderCosts>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mai_costs');
      return saved ? JSON.parse(saved) : { shipping: 0, customs: 0, inland: 0, other: 0 };
    }
    return { shipping: 0, customs: 0, inland: 0, other: 0 };
  });
  const [vatRate, setVatRate] = useState<number>(0);
  const [showVAT, setShowVAT] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mai_showVat');
      return saved ? JSON.parse(saved) : false;
    }
    return false;
  });

  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProduct, setNewProduct] = useState<{ model: string; role: 'HERO' | 'SUPPORT' | 'WEAK'; costUSD: number; salePriceTL: number; commissionRate: number; adsRate: number }>({ model: '', role: 'SUPPORT', costUSD: 0, salePriceTL: 0, commissionRate: 18, adsRate: 5 });

  // Persist to localStorage
  useEffect(() => { localStorage.setItem('mai_products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('mai_basket', JSON.stringify(basket)); }, [basket]);
  useEffect(() => { localStorage.setItem('mai_costs', JSON.stringify(costs)); }, [costs]);
  useEffect(() => { localStorage.setItem('mai_showVat', JSON.stringify(showVAT)); }, [showVAT]);

  // Calculate totals with VAT option
  const totals = basket.reduce((acc, item) => {
    const calc = calculateProfitBreakdown(item, costs, showVAT ? vatRate : 0);
    return {
      totalCost: acc.totalCost + calc.landedCost + (calc.extraCostPerUnit * item.quantity),
      expectedRevenue: acc.expectedRevenue + calc.revenue,
      expectedProfit: acc.expectedProfit + calc.netProfit,
      totalCommission: acc.totalCommission + calc.commission,
      totalAds: acc.totalAds + calc.adsCost,
      totalVAT: acc.totalVAT + calc.vatAmount,
    };
  }, { totalCost: 0, expectedRevenue: 0, expectedProfit: 0, totalCommission: 0, totalAds: 0, totalVAT: 0 });

  const totalUnits = basket.reduce((sum, item) => sum + item.quantity, 0);
  const avgMargin = totals.expectedRevenue > 0 ? (totals.expectedProfit / totals.expectedRevenue) * 100 : 0;

  const addToBasket = (productId: string) => {
    const qty = quantities[productId] || 0;
    if (qty <= 0) return;
    
    setBasket(prev => {
      const existing = prev.find(i => i.productId === productId);
      if (existing) {
        return prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + qty } : i);
      }
      return [...prev, { productId, quantity: qty }];
    });
  };

  const updateQuantity = (productId: string, qty: number) => {
    setBasket(prev => prev.map(i => i.productId === productId ? { ...i, quantity: Math.max(0, qty) } : i));
  };

  const removeFromBasket = (productId: string) => {
    setBasket(prev => prev.filter(i => i.productId !== productId));
  };

  const handleAddProduct = () => {
    if (!newProduct.model || newProduct.costUSD <= 0 || newProduct.salePriceTL <= 0) return;
    const id = 'p' + Date.now();
    setProducts(prev => [...prev, { ...newProduct, id, shippingCost: 0, customsCost: 0, packagingCost: 0 }]);
    setNewProduct({ model: '', role: 'SUPPORT', costUSD: 0, salePriceTL: 0, commissionRate: 18, adsRate: 5 });
    setShowProductModal(false);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-yellow-400">MAI Finance</h1>
          <p className="text-sm text-slate-400">Warsun Distributor Panel</p>
        </div>
        <div className="text-sm text-slate-400">
          Kur: 44 TL/USD | Komisyon: %18 | Reklam: %5
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-1">
        {(['dashboard', 'products', 'order'] as Tab[]).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium text-sm capitalize transition-colors ${
              activeTab === tab 
                ? 'text-yellow-600 border-b-2 border-yellow-500' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'dashboard' ? 'Dashboard' : tab === 'products' ? 'Ürünler' : 'Sipariş'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="text-sm text-slate-500 mb-1">Toplam Yatırım</div>
                <div className="text-2xl font-bold text-slate-900">{formatTL(totals.totalCost)}</div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="text-sm text-slate-500 mb-1">Beklenen Ciro</div>
                <div className="text-2xl font-bold text-blue-600">{formatTL(totals.expectedRevenue)}</div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="text-sm text-slate-500 mb-1">Net Kâr</div>
                <div className={`text-2xl font-bold ${totals.expectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatTL(totals.expectedProfit)}
                </div>
                {showVAT && totals.totalVAT > 0 && (
                  <div className="text-xs text-slate-400 mt-1">KDV: {formatTL(totals.totalVAT)}</div>
                )}
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="text-sm text-slate-500 mb-1">Ortalama Marj</div>
                <div className={`text-2xl font-bold ${avgMargin >= 20 ? 'text-green-600' : avgMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {avgMargin.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Product Margins Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h2 className="font-semibold text-slate-900">Ürün Marjları</h2>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={showVAT} onChange={e => setShowVAT(e.target.checked)} className="rounded" />
                    <span>KDV Göster</span>
                  </label>
                  {showVAT && (
                    <select value={vatRate} onChange={e => setVatRate(parseFloat(e.target.value))} className="px-2 py-1 border rounded text-sm">
                      <option value="0">0%</option>
                      <option value="0.10">10%</option>
                      <option value="0.20">20%</option>
                    </select>
                  )}
                </div>
              </div>
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ürün</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Rol</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Base Cost (TL)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Landed Cost</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Komisyon (%18)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Reklam (%5)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Net Kâr</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Marj</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {products.map(p => {
                    const item = { productId: p.id, quantity: 1 };
                    const calc = calculateProfitBreakdown(item, { shipping: 0, customs: 0, inland: 0, other: 0 }, showVAT ? vatRate : 0);
                    const netProfitToShow = showVAT ? calc.netProfit - calc.vatAmount : calc.netProfit;
                    const marginToShow = showVAT ? calc.marginAfterVAT : calc.margin;
                    
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-slate-900">{p.model}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(p.role)}`}>
                            {p.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600">{formatTL(calc.baseCost)}</td>
                        <td className="px-6 py-4 text-right text-slate-600">{formatTL(calc.landedCost)}</td>
                        <td className="px-6 py-4 text-right text-red-500">-{formatTL(calc.commission)}</td>
                        <td className="px-6 py-4 text-right text-red-500">-{formatTL(calc.adsCost)}</td>
                        <td className="px-6 py-4 text-right font-medium text-green-600">{formatTL(netProfitToShow)}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={marginToShow >= 20 ? 'text-green-600' : marginToShow >= 10 ? 'text-yellow-600' : 'text-red-600'}>
                            {marginToShow.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <>
            {showProductModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
                  <h3 className="text-lg font-semibold mb-4">Yeni Ürün Ekle</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
                      <input type="text" value={newProduct.model} onChange={e => setNewProduct({ ...newProduct, model: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Model adı" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                      <select value={newProduct.role} onChange={e => setNewProduct({ ...newProduct, role: e.target.value as 'HERO' | 'SUPPORT' | 'WEAK' })} className="w-full px-3 py-2 border border-slate-300 rounded-lg">
                        <option value="HERO">HERO</option>
                        <option value="SUPPORT">SUPPORT</option>
                        <option value="WEAK">WEAK</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Maliyet (USD)</label>
                        <input type="number" value={newProduct.costUSD || ''} onChange={e => setNewProduct({ ...newProduct, costUSD: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Satış (TL)</label>
                        <input type="number" value={newProduct.salePriceTL || ''} onChange={e => setNewProduct({ ...newProduct, salePriceTL: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Komisyon (%)</label>
                        <input type="number" value={newProduct.commissionRate} onChange={e => setNewProduct({ ...newProduct, commissionRate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Reklam (%)</label>
                        <input type="number" value={newProduct.adsRate} onChange={e => setNewProduct({ ...newProduct, adsRate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                    <button onClick={handleAddProduct} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500">Ekle</button>
                    <button onClick={() => setShowProductModal(false)} className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">İptal</button>
                  </div>
                </div>
              </div>
            )}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h2 className="font-semibold text-slate-900">Ürün Yönetimi</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowProductModal(true)}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-500"
                >
                  + Yeni Ürün
                </button>
                <span className="text-sm text-slate-500">T7 silinemez (HERO koruması)</span>
              </div>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Model</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Rol</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Maliyet (USD)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Satış (TL)</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Marj</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products.map(p => {
                  const calc = calculateNetProfit({ productId: p.id, quantity: 1 }, { shipping: 0, customs: 0, inland: 0, other: 0 });
                  
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{p.model}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(p.role)}`}>
                          {p.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600">${p.costUSD}</td>
                      <td className="px-6 py-4 text-right font-medium text-slate-900">{formatTL(p.salePriceTL)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={calc.margin >= 20 ? 'text-green-600' : calc.margin >= 10 ? 'text-yellow-600' : 'text-red-600'}>
                          {calc.margin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button className="px-3 py-1 bg-blue-600 text-white text-sm rounded mr-1">Düzenle</button>
                        {p.id !== 't7' && <button className="px-3 py-1 bg-red-100 text-red-600 text-sm rounded">Sil</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}

        {/* ORDER TAB */}
        {activeTab === 'order' && (
          <div className="grid grid-cols-3 gap-6">
            {/* Add Products */}
            <div className="col-span-2 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="font-semibold text-slate-900">Sepete Ürün Ekle</h2>
                </div>
                <div className="p-4 space-y-3">
                  {products.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(p.role)}`}>{p.role}</span>
                        <div>
                          <div className="font-medium text-slate-900">{p.model}</div>
                          <div className="text-sm text-slate-500">${p.costUSD} → {formatTL(p.salePriceTL)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          placeholder="Adet"
                          value={quantities[p.id] || ''}
                          onChange={e => setQuantities({ ...quantities, [p.id]: parseInt(e.target.value) || 0 })}
                          className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-center"
                        />
                        <button
                          onClick={() => addToBasket(p.id)}
                          className="px-4 py-2 bg-yellow-500 text-slate-900 rounded-lg font-medium hover:bg-yellow-400"
                        >
                          Ekle
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Costs */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200">
                  <h2 className="font-semibold text-slate-900">Sipariş Maliyetleri</h2>
                  <p className="text-xs text-slate-400 mt-1">Shipping and Customs are USD. İç Nakliye and Diğer are TL.</p>
                </div>
                <div className="p-4 grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Shipping (USD)</label>
                    <input type="number" value={costs.shipping} onChange={e => setCosts({ ...costs, shipping: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Customs (USD)</label>
                    <input type="number" value={costs.customs} onChange={e => setCosts({ ...costs, customs: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">İç Nakliye</label>
                    <input type="number" value={costs.inland} onChange={e => setCosts({ ...costs, inland: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Diğer</label>
                    <input type="number" value={costs.other} onChange={e => setCosts({ ...costs, other: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                  </div>
                </div>
              </div>

              {/* Basket Table */}
              {basket.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-200">
                    <h2 className="font-semibold text-slate-900">Sepet Tablosu ({basket.length} ürün)</h2>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ürün</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Adet</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Base Cost</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Landed Cost</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Satış</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Toplam Maliyet</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Beklenen Ciro</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Net Kâr</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">
                            <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {basket.map(item => {
                          const product = products.find(p => p.id === item.productId);
                          if (!product) return null;
                          const calc = calculateProfitBreakdown(item, costs, showVAT ? vatRate : 0);
                          const netProfitToShow = showVAT ? calc.netProfit - calc.vatAmount : calc.netProfit;
                          const totalCost = calc.landedCost + (calc.extraCostPerUnit * item.quantity);
                          
                          return (
                            <tr key={item.productId} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <div className="font-medium text-slate-900">{product.model}</div>
                                <div className="text-xs text-slate-400">${product.costUSD}/unit</div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={e => updateQuantity(item.productId, parseInt(e.target.value) || 0)}
                                  className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm"
                                />
                              </td>
                              <td className="px-4 py-3 text-right text-slate-600">{formatTL(calc.baseCost)}</td>
                              <td className="px-4 py-3 text-right text-slate-600">{formatTL(calc.landedCost)}</td>
                              <td className="px-4 py-3 text-right font-medium text-slate-900">{formatTL(product.salePriceTL)}</td>
                              <td className="px-4 py-3 text-right text-red-500">-{formatTL(totalCost)}</td>
                              <td className="px-4 py-3 text-right font-medium text-blue-600">{formatTL(calc.revenue)}</td>
                              <td className={`px-4 py-3 text-right font-bold ${netProfitToShow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatTL(netProfitToShow)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <button 
                                  onClick={() => removeFromBasket(item.productId)}
                                  className="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Calculation Panel */}
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white sticky top-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Canlı Hesaplama</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowVAT(false); setVatRate(0); }}
                    className={`px-3 py-1 rounded text-sm ${!showVAT ? 'bg-yellow-500 text-slate-900' : 'bg-slate-700 text-slate-300'}`}
                  >
                    KDV Hariç
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowVAT(true); setVatRate(0.20); }}
                    className={`px-3 py-1 rounded text-sm ${showVAT ? 'bg-yellow-500 text-slate-900' : 'bg-slate-700 text-slate-300'}`}
                  >
                    KDV Dahil
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="pb-4 border-b border-slate-700">
                  <div className="text-sm text-slate-400">Toplam Ünite</div>
                  <div className="text-2xl font-bold">{totalUnits}</div>
                </div>
                <div className="pb-4 border-b border-slate-700">
                  <div className="text-sm text-slate-400">Beklenen Ciro</div>
                  <div className="text-xl font-semibold">{formatTL(totals.expectedRevenue)}</div>
                </div>
                <div className="pb-4 border-b border-slate-700">
                  <div className="text-sm text-slate-400">Toplam Komisyon</div>
                  <div className="text-red-400">-{formatTL(totals.totalCommission)}</div>
                </div>
                <div className="pb-4 border-b border-slate-700">
                  <div className="text-sm text-slate-400">Toplam Reklam</div>
                  <div className="text-red-400">-{formatTL(totals.totalAds)}</div>
                </div>
                <div className="pb-4 border-b border-slate-700">
                  <div className="text-sm text-slate-400">Toplam Maliyet</div>
                  <div className="text-xl font-semibold">{formatTL(totals.totalCost)}</div>
                </div>
                {showVAT && totals.totalVAT > 0 && (
                  <div className="pb-4 border-b border-slate-700">
                    <div className="text-sm text-slate-400">KDV Tutarı</div>
                    <div className="text-red-400">-{formatTL(totals.totalVAT)}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm text-slate-400">Net Kâr</div>
                  <div className={`text-3xl font-bold ${totals.expectedProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatTL(totals.expectedProfit)}
                  </div>
                  <div className="mt-1 text-sm">
                    <span className={avgMargin >= 20 ? 'text-green-400' : avgMargin >= 10 ? 'text-yellow-400' : 'text-red-400'}>
                      Marj: {avgMargin.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}