import { trackAnalyticsEvent } from "./analytics";

const FAVORITES_KEY = "fata-favorites";

export function readFavoriteIds(): string[] {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.some(id => typeof id !== "string")) {
      console.error("La liste des favoris FATA enregistrée est invalide.");
      return [];
    }
    return parsed;
  } catch (error) {
    console.error("Impossible de lire les favoris FATA enregistrés.", error);
    return [];
  }
}

export function toggleFavoriteId(productId: string, isFavorite: boolean): boolean {
  const favorites = new Set(readFavoriteIds());
  if (isFavorite) favorites.delete(productId);
  else {
    favorites.add(productId);
    trackAnalyticsEvent("FAVORITE_ADD", productId);
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
  return !isFavorite;
}
