import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Product } from "../data/products";
import { trackAnalyticsEvent } from "../data/analytics";

export type CartItem = Product & { quantity: number };
type CartContextType = {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  refreshProducts: (products: Product[]) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
};

const CartContext = createContext<CartContextType | null>(null);
const storageKey = "fata-cart-v1";

function readCart(): CartItem[] {
  try {
    const value = localStorage.getItem(storageKey);
    return value ? JSON.parse(value) as CartItem[] : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(readCart);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items]);

  const refreshProducts = useCallback((products: Product[]) => {
    const currentProducts = new Map(products.map(product => [product.id, product]));
    setItems(current => current.map(item => {
      const latest = currentProducts.get(item.id);
      return latest
        ? { ...item, ...latest, quantity: latest.stock > 0 ? Math.min(item.quantity, latest.stock) : item.quantity }
        : { ...item, stock: 0 };
    }));
  }, []);

  const value = useMemo<CartContextType>(() => ({
    items,
    addToCart: (product, quantity = 1) => {
      if (product.stock < 1 || quantity < 1) return;
      trackAnalyticsEvent("CART_ADD", product.id);
      setItems(current => {
      const existing = current.find(item => item.id === product.id);
      return existing
        ? current.map(item => item.id === product.id
          ? { ...item, ...product, quantity: Math.min(item.quantity + quantity, product.stock) }
          : item)
        : [...current, { ...product, quantity: Math.min(quantity, product.stock) }];
      });
    },
    removeFromCart: id => setItems(current => current.filter(item => item.id !== id)),
    refreshProducts,
    updateQuantity: (id, quantity) => setItems(current => quantity < 1
      ? current.filter(item => item.id !== id)
      : current.flatMap(item => {
        if (item.id !== id) return [item];
        if (item.stock < 1) return [];
        return [{ ...item, quantity: Math.min(quantity, item.stock) }];
      })),
    clearCart: () => setItems([]),
    totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    totalPrice: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  }), [items, refreshProducts]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart doit être utilisé dans CartProvider");
  return context;
}
