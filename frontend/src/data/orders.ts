import type { CartItem } from "../context/CartContext";

export type DemoOrder = {
  id: string;
  createdAt: string;
  status: string;
  total: number;
  items: CartItem[];
  customerName: string;
  city: string;
};

const storageKey = "fata-demo-orders";

export function getOrders(): DemoOrder[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "[]") as DemoOrder[];
  } catch {
    return [];
  }
}

export function saveOrder(order: DemoOrder) {
  localStorage.setItem(storageKey, JSON.stringify([order, ...getOrders()]));
}

export function formatPrice(value: number) {
  return `${value.toLocaleString("fr-FR")} FCFA`;
}
