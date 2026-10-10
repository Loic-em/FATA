export type AccountRole = "client" | "vendeur";

export function getRoleReturnPath(role: AccountRole, returnTo: string | null): string | null {
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) return null;
  if (role === "client" && (/^\/commande(?:[/?#]|$)/.test(returnTo) || /^\/confirmation(?:\/|[?#]|$)/.test(returnTo) || /^\/espace\/client(?:\/|[?#]|$)/.test(returnTo))) return returnTo;
  if (role === "vendeur" && /^\/espace\/vendeur(?:\/|[?#]|$)/.test(returnTo)) return returnTo;
  return null;
}
