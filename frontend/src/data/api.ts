import type { Product } from "./products";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiCategory = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  parentId?: string | null;
  parent?: { id: string; name: string; slug: string } | null;
};
export type ApiProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  image: string | null;
  badge: string | null;
  rating: number;
  reviews: number;
  originalPrice: number | null;
  active?: boolean;
  category: { id: string; name: string; slug: string; parent?: { id: string; name: string; slug: string } | null };
  store: { id: string; name: string; slug: string; city: string; category?: string };
};
export type ApiStore = {
  id: string;
  name: string;
  slug: string;
  category: string;
  city: string;
  description: string;
  image: string | null;
};
export type ApiFulfillment = {
  id: string;
  orderId: string;
  storeId: string;
  storeName: string;
  status: "PENDING" | "PREPARING" | "READY_FOR_PICKUP" | "SHIPPED" | "DELIVERED";
  trackingCode: string | null;
  updatedAt: string;
  orderStatus: string;
  deliveryType: "DELIVERY" | "PICKUP";
  city: string;
  address: string;
  phone: string;
  instructions: string | null;
  customerName: string;
  orderCreatedAt: string;
  items: { id: string; productId: string; name: string; price: number; quantity: number }[];
  events: { id: string; status: ApiFulfillment["status"]; note: string | null; createdAt: string }[];
};
export type ApiOrder = {
  id: string;
  status: string;
  subtotal: number;
  shipping: number;
  total: number;
  city: string;
  address?: string;
  phone?: string;
  deliveryType: "DELIVERY" | "PICKUP";
  instructions?: string | null;
  createdAt: string;
  items: { id: string; productId: string; name: string; price: number; quantity: number }[];
  fulfillments?: ApiFulfillment[];
};

export function getOrderStatusLabel(status: string): string {
  if (status === "AWAITING_PAYMENT") return "En attente de paiement";
  if (status === "TEST_PAID") return "Paiement de test confirmé";
  if (status === "PAID") return "Paiement confirmé";
  if (status === "CANCELLED") return "Commande annulée";
  return "Statut à vérifier";
}

export function getFulfillmentStatusLabel(status: ApiFulfillment["status"], orderStatus: string): string {
  if (orderStatus !== "PAID" && orderStatus !== "TEST_PAID") return "En attente du paiement";
  if (status === "PENDING") return "À préparer";
  if (status === "PREPARING") return "En préparation";
  if (status === "READY_FOR_PICKUP") return "Prête au retrait";
  if (status === "SHIPPED") return "Expédiée";
  return "Remise confirmée";
}

export function mapApiProduct(product: ApiProduct): Product {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    stock: product.stock,
    image: product.image ?? "",
    badge: product.badge ?? undefined,
    rating: product.rating,
    reviews: product.reviews,
    originalPrice: product.originalPrice ?? undefined,
    category: product.category.name,
    ...(product.category.parent ? { parentCategory: product.category.parent.name } : {}),
    seller: product.store.name,
    storeId: product.store.id,
  };
}

export function mapApiStore(store: ApiStore) {
  return { ...store, image: store.image ?? "" };
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");

  const response = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: "same-origin",
  });

  if (!response.ok) {
    let message = `La requête a échoué (${response.status}).`;
    try {
      const body = await response.json() as { message?: string | string[] };
      if (Array.isArray(body.message)) message = body.message.join(" ");
      else if (body.message) message = body.message;
    } catch {
      // Keep the HTTP status message if the server did not return JSON.
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
