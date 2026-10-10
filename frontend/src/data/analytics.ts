import { apiRequest } from "./api";

export type AnalyticsEvent = "VISIT" | "STORE_VIEW" | "PRODUCT_VIEW" | "CART_ADD" | "FAVORITE_ADD";

export function trackAnalyticsEvent(eventType: AnalyticsEvent, targetId?: string) {
  const body = eventType === "STORE_VIEW"
    ? { eventType, storeId: targetId }
    : eventType === "PRODUCT_VIEW" || eventType === "CART_ADD" || eventType === "FAVORITE_ADD"
      ? { eventType, productId: targetId }
      : { eventType };
  void apiRequest<{ accepted: boolean }>("/analytics/events", {
    method: "POST",
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

export function trackPageVisit(path: string) {
  if (path.startsWith("/espace") || path.includes("/connexion") || path.includes("/inscription")) return;
  try {
    const day = new Date().toISOString().slice(0, 10);
    const key = `fata-analytics-visit:${day}:${path}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    trackAnalyticsEvent("VISIT");
  } catch {
    trackAnalyticsEvent("VISIT");
  }
}
