'use client';

import React, { useState, useEffect } from 'react';
import { PRODUCTS, calculateProfitBreakdown, calculateNetProfit, formatTL, getRoleBadgeColor } from '../lib/data';
import { BasketItem, OrderCosts, Product } from '../types';
import * as XLSX from 'xlsx';

type Tab = 'products' | 'order' | 'dashboard' | 'stok' | 'orders';
type Channel = 'amazon' | 'trendyol' | 'bayi' | 'custom';
type Role = 'admin' | 'investor';

const CHANNEL_RATES = {
  amazon: { commission: 0.18, label: 'Amazon', ads: 0.05 },
  trendyol: { commission: 0.15, label: 'Trendyol', ads: 0.03 },
  bayi: { commission: 0.25, label: 'Bayi', ads: 0 },
  custom: { commission: 0.18, label: 'Custom', ads: 0.05 }
};

export default function Home() {
  // Login state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('mai_role') !== null;
    }
    return false;
  });
  const [userRole, setUserRole] = useState<Role>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('mai_role');
      return (saved as Role) || 'investor';
    }
    return 'investor';
  });
  const [loginError, setLoginError] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (role: Role) => {
    if (role === 'admin' && password !== 'admin123') {
      setLoginError('Yanlış şifre');
      return;
    }
    if (role === 'investor' && password !== 'investor123') {
      setLoginError('Yanlış şifre');
      return;
    }
    setUserRole(role);
    setIsLoggedIn(true);
    sessionStorage.setItem('mai_role', role);
    setLoginError('');
    setPassword('');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole('investor');
    sessionStorage.removeItem('mai_role');
  };

  const requireAdmin = (action: string = 'Bu işlem') => {
    if (!isAdmin) {
      alert(`${action} için yetkiniz yok`);
      return false;
    }
    return true;
  };

  const isAdmin = userRole === 'admin';
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [channel, setChannel] = useState<Channel>('amazon');
  const [customCommission, setCustomCommission] = useState(18);
  const [products, setProducts] = useState<Product[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mai_products');
      return saved ? JSON.parse(saved) : PRODUCTS;
    }
    return PRODUCTS;
  });

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
  const [newProduct, setNewProduct] = useState<{ model: string; role: string; costUSD: number; salePriceTL: number; commissionRate: number; adsRate: number }>({ model: '', role: '', costUSD: 0, salePriceTL: 0, commissionRate: 18, adsRate: 5 });
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);
  const [simulationPrices, setSimulationPrices] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mai_simulationPrices');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });

  useEffect(() => { localStorage.setItem('mai_simulationPrices', JSON.stringify(simulationPrices)); }, [simulationPrices]);

  // Inventory state
  const [inventory, setInventory] = useState<Record<string, { incoming: number; sold: number }>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mai_inventory');
      return saved ? JSON.parse(saved) : {};
    }
    return {};
  });
  const [pendingStockOrder, setPendingStockOrder] = useState<{ items: BasketItem[]; costs: OrderCosts } | null>(null);

  useEffect(() => { localStorage.setItem('mai_inventory', JSON.stringify(inventory)); }, [inventory]);

  // Saved orders state
  const [savedOrders, setSavedOrders] = useState<Array<{
    id: string;
    timestamp: string;
    items: BasketItem[];
    costs: OrderCosts;
    channel: string;
    showVAT: boolean;
    vatRate: number;
    totalUnits: number;
    totalCost: number;
    expectedRevenue: number;
    netProfit: number;
    margin: number;
    products: Product[];
  }>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mai_saved_orders');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  useEffect(() => { localStorage.setItem('mai_saved_orders', JSON.stringify(savedOrders)); }, [savedOrders]);

  // Get simulation price or fallback to product sale price
  const getSimPrice = (productId: string, salePriceTL: number) => {
    return simulationPrices[productId] ?? salePriceTL;
  };

  // Get current channel commission rate
  const getChannelCommission = () => channel === 'custom' ? customCommission / 100 : CHANNEL_RATES[channel].commission;
  const getChannelAds = () => channel === 'custom' ? 0.05 : CHANNEL_RATES[channel].ads;
  const getChannelLabel = () => channel === 'custom' ? `Custom (${customCommission}%)` : CHANNEL_RATES[channel].label;

  // Persist to localStorage
  useEffect(() => { localStorage.setItem('mai_products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('mai_basket', JSON.stringify(basket)); }, [basket]);
  useEffect(() => { localStorage.setItem('mai_costs', JSON.stringify(costs)); }, [costs]);
  useEffect(() => { localStorage.setItem('mai_showVat', JSON.stringify(showVAT)); }, [showVAT]);

  // Calculate totals with VAT option using simulation prices
  const totals = basket.reduce((acc, item) => {
    const product = products.find(p => p.id === item.productId);
    const simPrice = getSimPrice(item.productId, product?.salePriceTL || 0);
    const calc = calculateProfitBreakdown(item, costs, showVAT ? vatRate : 0, products, getChannelCommission(), getChannelAds());
    const simPriceExclVAT = showVAT && vatRate > 0 ? simPrice / (1 + vatRate) : simPrice;
    const simRevenue = simPriceExclVAT * item.quantity;
    const simCommission = simRevenue * getChannelCommission();
    const simAds = simRevenue * getChannelAds();
    const simProfit = simRevenue - simCommission - simAds - calc.totalCost;
    const vatCollected = showVAT && vatRate > 0 ? (simPrice - simPriceExclVAT) * item.quantity : 0;
    return {
      totalCost: acc.totalCost + calc.landedCost + (calc.extraCostPerUnit * item.quantity),
      expectedRevenue: acc.expectedRevenue + simRevenue,
      expectedProfit: acc.expectedProfit + simProfit,
      totalCommission: acc.totalCommission + simCommission,
      totalAds: acc.totalAds + simAds,
      totalVAT: acc.totalVAT + vatCollected,
    };
  }, { totalCost: 0, expectedRevenue: 0, expectedProfit: 0, totalCommission: 0, totalAds: 0, totalVAT: 0 });

  const totalUnits = basket.reduce((sum, item) => sum + item.quantity, 0);
  const avgMargin = totals.expectedRevenue > 0 ? (totals.expectedProfit / totals.expectedRevenue) * 100 : 0;

  const addToBasket = (productId: string) => {
    if (!requireAdmin('Sepete ürün ekleme')) return;
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
    if (!requireAdmin('Sepetten ürün çıkarma')) return;
    setBasket(prev => prev.filter(i => i.productId !== productId));
  };

  const confirmStockOrder = () => {
    if (!requireAdmin('Stok aktarma')) return;
    if (basket.length === 0) return;
    // Add basket quantities to incoming stock
    setInventory(prev => {
      const next = { ...prev };
      basket.forEach(item => {
        const existing = next[item.productId] || { incoming: 0, sold: 0 };
        next[item.productId] = { ...existing, incoming: existing.incoming + item.quantity };
      });
      return next;
    });
    // Keep basket items but show confirmation
    setPendingStockOrder({ items: [...basket], costs: { ...costs } });
    // Clear basket after stock confirmation
    setBasket([]);
  };

  const saveOrder = () => {
    if (!requireAdmin('Sipariş kaydetme')) return;
    if (basket.length === 0) return;
    const order = {
      id: 'ord_' + Date.now(),
      timestamp: new Date().toISOString(),
      items: [...basket],
      costs: { ...costs },
      channel: channel,
      showVAT,
      vatRate,
      totalUnits,
      totalCost: totals.totalCost,
      expectedRevenue: totals.expectedRevenue,
      netProfit: totals.expectedProfit,
      margin: avgMargin,
      products: [...products]
    };
    setSavedOrders(prev => [order, ...prev]);
  };

  const restoreOrder = (orderId: string) => {
    if (!requireAdmin('Sipariş geri yükleme')) return;
    const order = savedOrders.find(o => o.id === orderId);
    if (!order) return;
    if (!window.confirm('Mevcut sepet değiştirilecek. Devam etmek istiyor musunuz?')) return;
    setBasket(order.items);
    setCosts(order.costs);
    setChannel(order.channel as Channel);
    setShowVAT(order.showVAT);
    setVatRate(order.vatRate);
    setActiveTab('order');
  };

  const deleteOrder = (orderId: string) => {
    if (!requireAdmin('Sipariş silme')) return;
    if (!window.confirm('Sipariş silinecek. Emin misiniz?')) return;
    setSavedOrders(prev => prev.filter(o => o.id !== orderId));
  };

  // Purchase decision helper
  const [budget, setBudget] = useState<number>(0);
  const calculatePurchase = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product || budget <= 0) return null;
    const calc = calculateProfitBreakdown({ productId, quantity: 1 }, { shipping: 0, customs: 0, inland: 0, other: 0 }, 0, products, getChannelCommission(), getChannelAds());
    const landedCost = calc.landedCostPerUnit;
    if (landedCost <= 0) return null;
    const maxUnits = Math.floor(budget / landedCost);
    const totalProfit = maxUnits * calc.netProfit;
    const roi = (totalProfit / (maxUnits * landedCost)) * 100;
    return { maxUnits, totalProfit, roi };
  };

  const handleCSVExport = () => {
    const rows: string[] = [];
    
    // Products section
    rows.push('PRODUCTS');
    rows.push('Model,Role,Cost USD,Sale TL,Break-even');
    products.forEach(p => {
      const landed = p.costUSD * 44 * 1.057;
      const breakEven = landed / (1 - 0.18 - 0.05);
      rows.push(`${p.model},${p.role},${p.costUSD},${p.salePriceTL},${breakEven.toFixed(2)}`);
    });
    
    // Basket section
    rows.push('');
    rows.push('BASKET');
    rows.push('Product,Quantity,Sale Price,Simulation Price,Revenue,Net Profit');
    basket.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      const simPrice = getSimPrice(item.productId, product?.salePriceTL || 0);
      const calc = calculateProfitBreakdown(item, costs, 0, products, getChannelCommission(), getChannelAds());
      const simRevenue = simPrice * item.quantity;
      const simCommission = simRevenue * getChannelCommission();
      const simAds = simRevenue * getChannelAds();
      const simProfit = simRevenue - simCommission - simAds - calc.totalCost;
      const vatCollected = showVAT && vatRate > 0 ? (simPrice - (showVAT && vatRate > 0 ? simPrice / (1 + vatRate) : simPrice)) * item.quantity : 0;
    rows.push(`${product?.model || item.productId},${item.quantity},${product?.salePriceTL || 0},${simPrice},${simRevenue.toFixed(2)},${simProfit.toFixed(2)},${vatCollected.toFixed(2)}`);
    });
    
    // Order costs section
    rows.push('');
    rows.push('ORDER COSTS');
    rows.push(`Shipping USD,${costs.shipping}`);
    rows.push(`Customs USD,${costs.customs}`);
    rows.push(`Inland TL,${costs.inland}`);
    rows.push(`Other TL,${costs.other}`);
    rows.push(`KDV Mode,${showVAT ? ' Dahil' : 'Hariç'}`);
    
    // Summary
    rows.push('');
    rows.push('SUMMARY');
    rows.push(`Channel,${getChannelLabel()}`);
    rows.push(`Total Cost,${totals.totalCost}`);
    rows.push(`Expected Revenue,${totals.expectedRevenue}`);
    rows.push(`Net Profit,${totals.expectedProfit}`);
    rows.push(`Avg Margin %,${avgMargin.toFixed(1)}`);
    
    // Inventory section
    rows.push('');
    rows.push('INVENTORY');
    rows.push('Product,Incoming,Sold,Remaining,Stock Value,Realized Revenue,Realized Profit');
    products.forEach(p => {
      const inv = inventory[p.id] || { incoming: 0, sold: 0 };
      const remaining = inv.incoming - inv.sold;
      const calc = calculateProfitBreakdown({ productId: p.id, quantity: 1 }, { shipping: 0, customs: 0, inland: 0, other: 0 }, 0, products, getChannelCommission(), getChannelAds());
      const stockValue = remaining * calc.landedCost;
      const realizedRevenue = inv.sold * p.salePriceTL;
      const realizedProfit = inv.sold * (p.salePriceTL - (p.salePriceTL * getChannelCommission()) - (p.salePriceTL * getChannelAds()) - calc.landedCost);
      rows.push(`${p.model},${inv.incoming},${inv.sold},${remaining},${stockValue.toFixed(2)},${realizedRevenue.toFixed(2)},${realizedProfit.toFixed(2)}`);
    });

    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mai-export-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExcelExport = () => {
    // Sheet 1: Basket Detail
    const basketData = basket.map(item => {
      const product = products.find(p => p.id === item.productId);
      if (!product) return null;
      const simPrice = getSimPrice(item.productId, product.salePriceTL);
      const calc = calculateProfitBreakdown({ ...item }, costs, 0, products, getChannelCommission(), getChannelAds());
      const simPriceExclVAT = showVAT && vatRate > 0 ? simPrice / (1 + vatRate) : simPrice;
      const simRevenue = simPriceExclVAT * item.quantity;
      const simCommission = simRevenue * getChannelCommission();
      const simAds = simRevenue * getChannelAds();
      const simProfit = simRevenue - simCommission - simAds - calc.totalCost;
      const simMargin = simRevenue > 0 ? (simProfit / simRevenue) * 100 : 0;
      const simBreakEven = calc.landedCostPerUnit / (1 - getChannelCommission() - getChannelAds());
      const isLoss = simPriceExclVAT < simBreakEven;
      return {
        'Ürün': product.model,
        'Rol': product.role,
        'Adet': item.quantity,
        'Base Cost': calc.baseCost.toFixed(2),
        'Landed Cost': calc.landedCost.toFixed(2),
        'Satış Fiyatı': product.salePriceTL,
        'Simülasyon Fiyatı': simPrice,
        'Toplam Maliyet': calc.totalCost.toFixed(2),
        'Beklenen Ciro': simRevenue.toFixed(2),
        'Net Kâr': simProfit.toFixed(2),
        'Marj %': simMargin.toFixed(1),
        'Break-even': simBreakEven.toFixed(2),
        'Durum': isLoss ? 'ZARAR' : ''
      };
    }).filter(Boolean);

    // Sheet 2: Summary
    const summaryData = [
      { 'Metrik': 'Toplam Ünite', 'Değer': totalUnits },
      { 'Metrik': 'Toplam Maliyet', 'Değer': totals.totalCost.toFixed(2) },
      { 'Metrik': 'Beklenen Ciro', 'Değer': totals.expectedRevenue.toFixed(2) },
      { 'Metrik': 'Net Kâr', 'Değer': totals.expectedProfit.toFixed(2) },
      { 'Metrik': 'Marj %', 'Değer': avgMargin.toFixed(1) },
      { 'Metrik': 'Kanal', 'Değer': getChannelLabel() },
      { 'Metrik': 'KDV Modu', 'Değer': showVAT ? 'KDV Dahil' : 'KDV Hariç' },
      { 'Metrik': 'Toplam Komisyon', 'Değer': totals.totalCommission.toFixed(2) },
      { 'Metrik': 'Toplam Reklam', 'Değer': totals.totalAds.toFixed(2) },
      { 'Metrik': 'KDV Tutarı', 'Değer': totals.totalVAT.toFixed(2) }
    ];

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(basketData);
    const ws2 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Sepet');
    XLSX.utils.book_append_sheet(wb, ws2, 'Özet');
    XLSX.writeFile(wb, 'mai_finance_basket_export.xlsx');
  };

  const handleAddProduct = () => {
    if (!requireAdmin('Ürün ekleme')) return;
    if (!newProduct.model || newProduct.costUSD <= 0 || newProduct.salePriceTL <= 0) return;
    const id = 'p' + Date.now();
    setProducts(prev => [...prev, { ...newProduct, id, shippingCost: 0, customsCost: 0, packagingCost: 0 }]);
    setNewProduct({ model: '', role: '', costUSD: 0, salePriceTL: 0, commissionRate: 18, adsRate: 5 });
    setShowProductModal(false);
  };

  const handleEditProduct = (product: Product) => {
    if (!requireAdmin('Ürün düzenleme')) return;
    setEditingProduct(product);
  };

  const handleSaveEdit = () => {
    if (!requireAdmin('Ürün kaydetme')) return;
    if (!editingProduct) return;
    setProducts(prev => prev.map(p => p.id === editingProduct.id ? editingProduct : p));
    setEditingProduct(null);
  };

  const handleDeleteProduct = (productId: string) => {
    if (!requireAdmin('Ürün silme')) return;
    if (productId === 't7') return;
    setProducts(prev => prev.filter(p => p.id !== productId));
    setDeleteConfirm(null);
  };

  const applySimulationPrice = (productId: string) => {
    if (!requireAdmin('Fiyat uygulama')) return;
    const simPrice = simulationPrices[productId];
    if (simPrice === undefined) return;
    if (!window.confirm('Simülasyon fiyatı ürün fiyatına uygulanacak. Emin misiniz?')) return;
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, salePriceTL: simPrice } : p));
  };

  const resetSimulationPrice = (productId: string) => {
    setSimulationPrices(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const clearBasket = () => {
    if (!requireAdmin('Sepet temizleme')) return;
    setBasket([]);
    setSimulationPrices({});
    setResetConfirm(null);
  };

  const clearInventory = () => {
    if (!requireAdmin('Envanter temizleme')) return;
    setInventory({});
    setResetConfirm(null);
  };

  const resetAllData = () => {
    if (!requireAdmin('Veri sıfırlama')) return;
    setProducts(PRODUCTS);
    setBasket([]);
    setCosts({ shipping: 0, customs: 0, inland: 0, other: 0 });
    setInventory({});
    setChannel('amazon');
    setSimulationPrices({});
    setShowVAT(false);
    setVatRate(0);
    setPendingStockOrder(null);
    setResetConfirm(null);
  };

  // Backup & Restore
  const handleBackup = () => {
    const backup = {
      products,
      basket,
      costs,
      inventory,
      channel,
      simulationPrices,
      showVAT,
      vatRate,
      timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mai-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!requireAdmin('Yedek yükleme')) return;
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm('Mevcut veriler yedeğinizle değiştirilecek. Devam etmek istiyor musunuz?')) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.products) setProducts(data.products);
        if (data.basket) setBasket(data.basket);
        if (data.costs) setCosts(data.costs);
        if (data.inventory) setInventory(data.inventory);
        if (data.channel) setChannel(data.channel);
        if (data.simulationPrices) setSimulationPrices(data.simulationPrices);
        if (typeof data.showVAT === 'boolean') setShowVAT(data.showVAT);
        if (typeof data.vatRate === 'number') setVatRate(data.vatRate);
      } catch {
        alert('Geçersiz yedek dosyası');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 w-96">
          <h1 className="text-2xl font-bold text-center text-yellow-500 mb-1">MAI Finance</h1>
          <p className="text-center text-slate-400 text-sm mb-6">Distributor Finance & Profitability Panel</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setLoginError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin('admin')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="Şifreyi girin"
              />
            </div>
            {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
            <button
              onClick={() => handleLogin('admin')}
              className="w-full px-4 py-2 bg-yellow-500 text-slate-900 rounded-lg font-medium hover:bg-yellow-400"
            >
              Admin Girişi
            </button>
            <button
              onClick={() => handleLogin('investor')}
              className="w-full px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300"
            >
              Yatırımcı Girişi
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-yellow-400">MAI Finance</h1>
          <p className="text-sm text-slate-400">Warsun Distributor Panel</p>
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-2 py-1 rounded text-xs font-medium ${isAdmin ? 'bg-yellow-500 text-slate-900' : 'bg-slate-600 text-white'}`}>
            {isAdmin ? 'Admin' : 'Yatırımcı'}
          </span>
          <button onClick={handleLogout} className="text-sm text-slate-400 hover:text-white">Çıkış</button>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-6 flex gap-1">
        {(['dashboard', 'products', 'order', 'stok', 'orders'] as Tab[]).map(tab => (
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
            {tab === 'dashboard' ? 'Dashboard' : tab === 'products' ? 'Ürünler' : tab === 'order' ? 'Sipariş' : tab === 'stok' ? 'Stok' : 'Geçmiş'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Channel Selector + Reset */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium text-slate-700">Kanal:</span>
              <div className="flex gap-2">
                {(['amazon', 'trendyol', 'bayi', 'custom'] as Channel[]).map(ch => (
                  <button
                    key={ch}
                    onClick={() => setChannel(ch)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${channel === ch ? 'bg-yellow-500 text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {CHANNEL_RATES[ch].label}
                  </button>
                ))}
              </div>
              {channel === 'custom' && (
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-sm text-slate-500">Komisyon:</span>
                  <input
                    type="number"
                    value={customCommission}
                    onChange={e => setCustomCommission(parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 border border-slate-300 rounded text-sm"
                  />
                  <span className="text-sm text-slate-500">%</span>
                </div>
              )}
              <span className="text-sm text-slate-400 ml-auto">Komisyon: {Math.round(getChannelCommission() * 100)}% | Reklam: {Math.round(getChannelAds() * 100)}%</span>
              <div className="flex items-center gap-2 border-l border-slate-300 pl-4">
                {resetConfirm === 'basket' ? (
                  <>
                    <span className="text-sm text-red-600">Sepeti temizle?</span>
                    <button onClick={clearBasket} className="px-3 py-1 bg-red-600 text-white text-sm rounded">Evet</button>
                    <button onClick={() => setResetConfirm(null)} className="px-3 py-1 bg-slate-200 text-slate-700 text-sm rounded">İptal</button>
                  </>
                ) : resetConfirm === 'inventory' ? (
                  <>
                    <span className="text-sm text-red-600">Envanteri temizle?</span>
                    <button onClick={clearInventory} className="px-3 py-1 bg-red-600 text-white text-sm rounded">Evet</button>
                    <button onClick={() => setResetConfirm(null)} className="px-3 py-1 bg-slate-200 text-slate-700 text-sm rounded">İptal</button>
                  </>
                ) : resetConfirm === 'all' ? (
                  <>
                    <span className="text-sm text-red-600">Tüm verileri sıfırla?</span>
                    <button onClick={resetAllData} className="px-3 py-1 bg-red-600 text-white text-sm rounded">Evet</button>
                    <button onClick={() => setResetConfirm(null)} className="px-3 py-1 bg-slate-200 text-slate-700 text-sm rounded">İptal</button>
                  </>
                ) : (
                  <>
                    <button onClick={handleBackup} className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-500">Yedek Al</button>
                    {isAdmin && (
                      <label className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-500 cursor-pointer">
                        Yedekten Yükle
                        <input type="file" accept=".json" onChange={handleRestore} className="hidden" />
                      </label>
                    )}
                    {isAdmin && <button onClick={() => setResetConfirm('basket')} className="px-3 py-1 bg-slate-200 text-slate-600 text-sm rounded hover:bg-slate-300">Sepeti Temizle</button>}
                    {isAdmin && <button onClick={() => setResetConfirm('inventory')} className="px-3 py-1 bg-slate-200 text-slate-600 text-sm rounded hover:bg-slate-300">Envanteri Temizle</button>}
                    {isAdmin && <button onClick={() => setResetConfirm('all')} className="px-3 py-1 bg-red-100 text-red-600 text-sm rounded hover:bg-red-200">Tüm Verileri Sıfırla</button>}
                  </>
                )}
              </div>
            </div>

            {/* Summary Cards */}
            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${basket.length === 0 ? 'opacity-50' : ''}`}>
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

            {/* Empty Basket Message */}
            {basket.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
                <p className="text-slate-500">Sepet boş. Sipariş oluşturmak için ürün ekleyin.</p>
              </div>
            )}

            {/* SKU Performance Analysis */}
            {basket.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                <h2 className="font-semibold text-slate-900 mb-4">SKU Performans Analizi</h2>
                <div className="space-y-3">
                  {(() => {
                    const productStats = basket.map(item => {
                      const product = products.find(p => p.id === item.productId);
                      const simPrice = getSimPrice(item.productId, product?.salePriceTL || 0);
                      const calc = calculateProfitBreakdown(item, costs, 0, products, getChannelCommission(), getChannelAds());
                      const simRevenue = simPrice * item.quantity;
                      const simCommission = simRevenue * getChannelCommission();
                      const simAds = simRevenue * getChannelAds();
                      const simProfit = simRevenue - simCommission - simAds - calc.totalCost;
                      const simMargin = simRevenue > 0 ? (simProfit / simRevenue) * 100 : 0;
                      return {
                        product,
                        profit: simProfit,
                        revenue: simRevenue,
                        margin: simMargin,
                        quantity: item.quantity,
                        hasSimulation: simulationPrices[item.productId] !== undefined
                      };
                    }).filter(s => s.product);

                    if (productStats.length === 0) return null;

                    const totalProfit = productStats.reduce((sum, s) => sum + s.profit, 0);
                    const totalRevenue = productStats.reduce((sum, s) => sum + s.revenue, 0);

                    const sortedByProfit = [...productStats].sort((a, b) => b.profit - a.profit);
                    const sortedByMargin = [...productStats].sort((a, b) => a.margin - b.margin);

                    const topProfit = sortedByProfit[0];
                    const bottomProfit = sortedByProfit[sortedByProfit.length - 1];
                    const lowestMargin = sortedByMargin[0];

                    return (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                            <div className="text-sm text-green-600 mb-1">En Yüksek Kâr</div>
                            <div className="font-semibold text-green-800">{topProfit.product?.model}</div>
                            <div className="text-sm text-green-600">{formatTL(topProfit.profit)} ({((topProfit.profit / totalProfit) * 100).toFixed(1)}%)</div>
                          </div>
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <div className="text-sm text-blue-600 mb-1">En Yüksek Ciro</div>
                            <div className="font-semibold text-blue-800">{[...productStats].sort((a, b) => b.revenue - a.revenue)[0].product?.model}</div>
                            <div className="text-sm text-blue-600">{formatTL([...productStats].sort((a, b) => b.revenue - a.revenue)[0].revenue)}</div>
                          </div>
                          <div className={`rounded-lg p-4 border ${lowestMargin.margin < 0 ? 'bg-red-50 border-red-200' : lowestMargin.margin < 10 ? 'bg-yellow-50 border-yellow-200' : 'bg-slate-50 border-slate-200'}`}>
                            <div className={`text-sm mb-1 ${lowestMargin.margin < 0 ? 'text-red-600' : 'text-yellow-600'}`}>Risk Ürünü</div>
                            <div className={`font-semibold ${lowestMargin.margin < 0 ? 'text-red-800' : 'text-yellow-800'}`}>{lowestMargin.product?.model}</div>
                            <div className={`text-sm ${lowestMargin.margin < 0 ? 'text-red-600' : 'text-yellow-600'}`}>Marj: {lowestMargin.margin.toFixed(1)}%</div>
                          </div>
                        </div>
                        <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                          <p className="text-sm text-slate-700">
                            <span className="font-medium">Toplam Kâr:</span> {formatTL(totalProfit)} ({basket.length} ürün)
                          </p>
                          <p className="text-sm text-slate-700 mt-1">
                            <span className="font-medium text-green-700">Top performans:</span> {topProfit.product?.model} ürünü {((topProfit.profit / totalProfit) * 100).toFixed(0)}% kâr katkısı sağlıyor
                          </p>
                          {lowestMargin.margin < 0 && (
                            <p className="text-sm text-red-600 mt-1">
                              ⚠️ <span className="font-medium">{lowestMargin.product?.model}</span> zararda. Fiyat veya maliyet gözden geçirilmeli.
                            </p>
                          )}
                          {lowestMargin.margin >= 0 && lowestMargin.margin < 10 && (
                            <p className="text-sm text-yellow-600 mt-1">
                              ⚠️ <span className="font-medium">{lowestMargin.product?.model}</span> düşük marj. Performans izlenmeli.
                            </p>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Product Margins Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                <h2 className="font-semibold text-slate-900">Ürün Marjları</h2>
                <div className="flex items-center gap-4">
                  <button onClick={handleCSVExport} className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-500">CSV Export</button>
                  <button onClick={handleExcelExport} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500">Excel İndir</button>
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
                    const calc = calculateProfitBreakdown(item, { shipping: 0, customs: 0, inland: 0, other: 0 }, showVAT ? vatRate : 0, products, getChannelCommission(), getChannelAds());
                    
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
                        <td className="px-6 py-4 text-right font-medium text-green-600">{formatTL(calc.netProfit)}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={calc.margin >= 20 ? 'text-green-600' : calc.margin >= 10 ? 'text-yellow-600' : 'text-red-600'}>
                            {calc.margin.toFixed(1)}%
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

        {/* STOK TAB */}
        {activeTab === 'stok' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">Stok Takibi</h2>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ürün</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Gelen</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Satılan</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Stok</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Maliyet</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Stok Değeri</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Ciro</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Kâr</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {products.map(p => {
                  const inv = inventory[p.id] || { incoming: 0, sold: 0 };
                  const remaining = inv.incoming - inv.sold;
                  const calc = calculateProfitBreakdown({ productId: p.id, quantity: 1 }, { shipping: 0, customs: 0, inland: 0, other: 0 }, 0, products, getChannelCommission(), getChannelAds());
                  const landedPerUnit = calc.landedCost;
                  const stockValue = remaining * landedPerUnit;
                  const realizedRevenue = inv.sold * p.salePriceTL;
                  const realizedProfit = inv.sold * (p.salePriceTL - (p.salePriceTL * getChannelCommission()) - (p.salePriceTL * getChannelAds()) - landedPerUnit);
                  
                  return (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">{p.model}</td>
                      <td className="px-6 py-4 text-center text-green-600">{inv.incoming}</td>
                      <td className="px-6 py-4 text-center">
                        <input
                          type="number"
                          min="0"
                          value={inv.sold}
                          onChange={e => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setInventory(prev => ({ ...prev, [p.id]: { incoming: inv.incoming, sold: val } }));
                          }}
                          className="w-16 px-2 py-1 border border-slate-300 rounded text-center text-sm"
                        />
                      </td>
                      <td className={`px-6 py-4 text-center font-bold ${remaining <= 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {remaining}
                      </td>
                      <td className="px-6 py-4 text-right text-slate-600">{formatTL(landedPerUnit)}</td>
                      <td className={`px-6 py-4 text-right font-medium ${stockValue > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{formatTL(stockValue)}</td>
                      <td className="px-6 py-4 text-right text-green-600">{formatTL(realizedRevenue)}</td>
                      <td className={`px-6 py-4 text-right font-bold ${realizedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatTL(realizedProfit)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">Sipariş Geçmişi</h2>
            </div>
            {savedOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-500">Kayıtlı sipariş bulunamadı.</div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tarih</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Ünite</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Maliyet</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Ciro</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Kâr</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Marj</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Kanal</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {savedOrders.map(order => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {new Date(order.timestamp).toLocaleString('tr-TR')}
                      </td>
                      <td className="px-6 py-4 text-center">{order.totalUnits}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{formatTL(order.totalCost)}</td>
                      <td className="px-6 py-4 text-right text-blue-600">{formatTL(order.expectedRevenue)}</td>
                      <td className={`px-6 py-4 text-right font-bold ${order.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatTL(order.netProfit)}</td>
                      <td className={`px-6 py-4 text-right ${order.margin >= 20 ? 'text-green-600' : order.margin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>{order.margin.toFixed(1)}%</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs">{order.channel}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isAdmin && (
                          <button
                            onClick={() => restoreOrder(order.id)}
                            className="px-3 py-1 bg-blue-600 text-white text-sm rounded mr-1 hover:bg-blue-500"
                          >
                            Geri Yükle
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => deleteOrder(order.id)}
                            className="px-3 py-1 bg-red-100 text-red-600 text-sm rounded hover:bg-red-200"
                          >
                            Sil
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <>
            {editingProduct && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-xl p-6 w-96 shadow-xl">
                  <h3 className="text-lg font-semibold mb-4">Ürün Düzenle</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
                      <input type="text" value={editingProduct.model} onChange={e => setEditingProduct({ ...editingProduct, model: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Rol</label>
                      <input type="text" value={editingProduct.role} onChange={e => setEditingProduct({ ...editingProduct, role: e.target.value.toUpperCase() })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Maliyet (USD)</label>
                        <input type="number" value={editingProduct.costUSD || ''} onChange={e => setEditingProduct({ ...editingProduct, costUSD: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Satış (TL)</label>
                        <input type="number" value={editingProduct.salePriceTL || ''} onChange={e => setEditingProduct({ ...editingProduct, salePriceTL: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                    <button onClick={handleSaveEdit} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500">Kaydet</button>
                    <button onClick={() => setEditingProduct(null)} className="flex-1 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">İptal</button>
                  </div>
                </div>
              </div>
            )}
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
                      <input
                        type="text"
                        value={newProduct.role}
                        onChange={e => setNewProduct({ ...newProduct, role: e.target.value.toUpperCase() })}
                        placeholder="HERO, SUPPORT, TEST, ENTRY..."
                        list="role-suggestions"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      />
                      <datalist id="role-suggestions">
                        <option value="HERO"/>
                        <option value="SUPPORT"/>
                        <option value="TEST"/>
                        <option value="ENTRY"/>
                        <option value="WEAK"/>
                        <option value="CORE"/>
                        <option value="DROP"/>
                      </datalist>
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
                    <button onClick={handleAddProduct} disabled={!isAdmin} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-50">Ekle</button>
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
                  onClick={() => isAdmin && setShowProductModal(true)}
                  disabled={!isAdmin}
                  className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
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
                        {isAdmin && (
                          <button onClick={() => handleEditProduct(p)} className="px-3 py-1 bg-blue-600 text-white text-sm rounded mr-1">Düzenle</button>
                        )}
                        {isAdmin && (
                          p.id !== 't7' && (
                            deleteConfirm === p.id ? (
                              <>
                                <button onClick={() => handleDeleteProduct(p.id)} className="px-3 py-1 bg-red-600 text-white text-sm rounded mr-1">Sil</button>
                                <button onClick={() => setDeleteConfirm(null)} className="px-3 py-1 bg-slate-200 text-slate-700 text-sm rounded">İptal</button>
                              </>
                            ) : (
                              <button onClick={() => setDeleteConfirm(p.id)} className="px-3 py-1 bg-red-100 text-red-600 text-sm rounded">Sil</button>
                            )
                          )
                        )}
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add Products */}
            <div className="col-span-2 space-y-4">
              {/* Purchase Decision Helper */}
              {budget > 0 && (
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                  <h3 className="font-semibold text-green-800 mb-3">Kaç Adet Almalısın?</h3>
                  <div className="mb-3">
                    <label className="text-sm text-green-700">Bütçe (TL): </label>
                    <input
                      type="number"
                      value={budget || ''}
                      onChange={e => setBudget(parseFloat(e.target.value) || 0)}
                      className="w-32 px-2 py-1 border border-green-300 rounded text-sm ml-2"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    {products.slice(0, 4).map(p => {
                      const result = calculatePurchase(p.id);
                      if (!result) return null;
                      return (
                        <div key={p.id} className="text-sm bg-white/70 rounded p-2">
                          <span className="font-medium text-green-800">{p.model}: </span>
                          <span className="text-green-700">
                            {budget.toLocaleString('tr-TR')} TL bütçeyle <strong>{result.maxUnits}</strong> adet alırsan ~<strong>{formatTL(result.totalProfit)}</strong> kâr edersin (ROI: %{result.roi.toFixed(0)})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
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
                          onChange={e => isAdmin && setQuantities({ ...quantities, [p.id]: parseInt(e.target.value) || 0 })}
                          disabled={!isAdmin}
                          className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-center disabled:opacity-50"
                        />
                        <button
                          onClick={() => isAdmin && addToBasket(p.id)}
                          disabled={!isAdmin}
                          className="px-4 py-2 bg-yellow-500 text-slate-900 rounded-lg font-medium hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
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
                <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Shipping (USD)</label>
                    <input type="number" value={costs.shipping} onChange={e => isAdmin && setCosts({ ...costs, shipping: parseFloat(e.target.value) || 0 })} disabled={!isAdmin} className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Customs (USD)</label>
                    <input type="number" value={costs.customs} onChange={e => isAdmin && setCosts({ ...costs, customs: parseFloat(e.target.value) || 0 })} disabled={!isAdmin} className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">İç Nakliye</label>
                    <input type="number" value={costs.inland} onChange={e => isAdmin && setCosts({ ...costs, inland: parseFloat(e.target.value) || 0 })} disabled={!isAdmin} className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Diğer</label>
                    <input type="number" value={costs.other} onChange={e => isAdmin && setCosts({ ...costs, other: parseFloat(e.target.value) || 0 })} disabled={!isAdmin} className="w-full px-3 py-2 border border-slate-300 rounded-lg disabled:opacity-50" />
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
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Simülasyon</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Satış</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Toplam Maliyet</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Break-even</th>
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
                          const simPrice = getSimPrice(item.productId, product.salePriceTL);
                          const calc = calculateProfitBreakdown({ ...item }, costs, 0, products, getChannelCommission(), getChannelAds());
                          // If VAT included, extract net price for calculations
                          const simPriceExclVAT = showVAT && vatRate > 0 ? simPrice / (1 + vatRate) : simPrice;
                          const simRevenue = simPriceExclVAT * item.quantity;
                          const simCommission = simRevenue * getChannelCommission();
                          const simAds = simRevenue * getChannelAds();
                          const simProfit = simRevenue - simCommission - simAds - calc.totalCost;
                          const simMargin = simRevenue > 0 ? (simProfit / simRevenue) * 100 : 0;
                          const simBreakEven = calc.landedCostPerUnit / (1 - getChannelCommission() - getChannelAds());
                          const isSimLoss = simPriceExclVAT < simBreakEven;
                          
                          return (
                            <tr key={item.productId} className={isSimLoss ? 'bg-red-50' : 'hover:bg-slate-50'}>
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
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <span className="text-xs text-blue-500 font-medium">Sim:</span>
                                  <input
                                    type="number"
                                    value={simPrice}
                                    onChange={e => setSimulationPrices(prev => ({ ...prev, [item.productId]: parseFloat(e.target.value) || 0 }))}
                                    className="w-20 px-2 py-1 border border-blue-300 rounded text-sm text-right bg-blue-50"
                                    style={{ backgroundColor: '#eff6ff' }}
                                  />
                                </div>
                              {isAdmin && simulationPrices[item.productId] !== undefined && (
                                  <button
                                    onClick={() => applySimulationPrice(item.productId)}
                                    className="mt-1 w-full px-1 py-0.5 bg-green-100 text-green-600 text-xs rounded hover:bg-green-200 block"
                                  >
                                    ✓ Fiyata Uygula
                                  </button>
                                )}
                              </td>
                              <td className={`px-4 py-3 text-right font-medium ${isSimLoss ? 'text-red-600 line-through' : 'text-slate-900'}`}>
                                {formatTL(product.salePriceTL)}
                              </td>
                              <td className="px-4 py-3 text-right text-red-500">-{formatTL(calc.totalCost)}</td>
                              <td className={`px-4 py-3 text-right ${isSimLoss ? 'text-red-600 font-bold' : 'text-slate-600'}`}>
                                {formatTL(simBreakEven)}
                                {isSimLoss && <span className="ml-1 text-xs text-red-500">ZARAR</span>}
                              </td>
                              <td className={`px-4 py-3 text-right font-medium ${isSimLoss ? 'text-red-600' : 'text-blue-600'}`}>{formatTL(simRevenue)}</td>
                              <td className={`px-4 py-3 text-right font-bold ${simProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatTL(simProfit)}
                                <div className={`text-xs ${simMargin >= 20 ? 'text-green-500' : simMargin >= 10 ? 'text-yellow-500' : 'text-red-500'}`}>
                                  %{simMargin.toFixed(1)}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {isAdmin && (
                                  <button 
                                    onClick={() => removeFromBasket(item.productId)}
                                    className="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm"
                                  >
                                    ✕
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center">
                    {isAdmin && (
                      <button
                        onClick={confirmStockOrder}
                        disabled={basket.length === 0}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50"
                      >
                        Siparişi Stoka Aktar
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={saveOrder}
                        disabled={basket.length === 0}
                        className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-500 disabled:opacity-50"
                      >
                        Siparişi Kaydet
                      </button>
                    )}
                    {pendingStockOrder && (
                      <span className="text-sm text-green-600">✓ {pendingStockOrder.items.length} ürün stoka aktarıldı</span>
                    )}
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