import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowLeft, ArrowRight, Bell, Boxes, Check, CircleHelp, CreditCard, Flag, Heart, LayoutDashboard, LogOut, Mail, MessageCircle, Package, Plus, RefreshCw, Settings, ShieldCheck, ShoppingBag, Store, Wallet, X } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth, type UserRole } from "../context/AuthContext";
import { formatPrice } from "../data/orders";
import { apiRequest, getOrderStatusLabel, mapApiProduct, type ApiOrder, type ApiProduct } from "../data/api";
import type { Product } from "../data/products";
import { readFavoriteIds, toggleFavoriteId } from "../data/favorites";
import AdminCategories from "../components/AdminCategories";
import AdminManagement from "../components/AdminManagement";
import SellerManagement from "../components/SellerManagement";
import Messaging from "../components/Messaging";
import AnalyticsDashboard from "../components/AnalyticsDashboard";
import { FulfillmentProgress, SellerOrders } from "../components/OrderFulfillment";

type NavItem = { label: string; icon: typeof LayoutDashboard };
const navByRole: Record<UserRole, NavItem[]> = {
  client: [{ label: "Vue d'ensemble", icon: LayoutDashboard }, { label: "Mes commandes", icon: Package }, { label: "Messages", icon: MessageCircle }, { label: "Mes favoris", icon: Heart }, { label: "Mes adresses", icon: Store }, { label: "Paramètres", icon: Settings }],
  vendeur: [{ label: "Vue d'ensemble", icon: LayoutDashboard }, { label: "Ma boutique", icon: Store }, { label: "Mes produits", icon: Boxes }, { label: "Commandes", icon: Package }, { label: "Messages", icon: MessageCircle }, { label: "Revenus", icon: Wallet }, { label: "Paramètres", icon: Settings }],
  admin: [{ label: "Vue d'ensemble", icon: LayoutDashboard }, { label: "Catégories", icon: Boxes }, { label: "Vendeurs", icon: Store }, { label: "Produits", icon: Boxes }, { label: "Commandes", icon: Package }, { label: "Demandes contact", icon: Mail }, { label: "Signalements", icon: Flag }, { label: "Finances", icon: CreditCard }, { label: "Paramètres", icon: Settings }],
};

export default function Dashboard() {
  const { role: roleParam = "client" } = useParams();
  const role: UserRole = roleParam === "vendeur" || roleParam === "admin" ? roleParam : "client";
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState(searchParams.get("tab") === "messages" ? "Messages" : "Vue d'ensemble");
  const [actionError, setActionError] = useState("");
  const [customerOrders, setCustomerOrders] = useState<ApiOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersRefresh, setOrdersRefresh] = useState(0);
  const [sellerOrdersRefresh, setSellerOrdersRefresh] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState(() => readFavoriteIds());
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState("");
  const [unreadMessages, setUnreadMessages] = useState(0);
  useEffect(() => {
    if (role !== "client") return;
    let active = true;
    setOrdersLoading(true);
    apiRequest<ApiOrder[]>("/orders/mine")
      .then(value => { if (active) setCustomerOrders(value); })
      .catch(reason => {
        if (active) setActionError(reason instanceof Error ? reason.message : "Impossible de charger vos commandes.");
      })
      .finally(() => { if (active) setOrdersLoading(false); });
    return () => { active = false; };
  }, [role, ordersRefresh]);
  useEffect(() => {
    if (role === "admin") return;
    let active = true;
    const refreshUnread = () => apiRequest<{ unreadCount: number }[]>("/conversations")
      .then(rows => { if (active) setUnreadMessages(rows.reduce((total, row) => total + row.unreadCount, 0)); })
      .catch(reason => { if (active) setActionError(reason instanceof Error ? reason.message : "Impossible de charger le compteur de messages."); });
    void refreshUnread();
    const interval = window.setInterval(() => void refreshUnread(), 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [role]);
  useEffect(() => {
    if (role !== "client" || active !== "Mes favoris") return;
    let activeRequest = true;
    setFavoritesError("");
    if (!favoriteIds.length) {
      setFavoriteProducts([]);
      setFavoritesLoading(false);
      return () => { activeRequest = false; };
    }
    setFavoritesLoading(true);
    apiRequest<ApiProduct[]>("/products")
      .then(rows => {
        if (activeRequest) setFavoriteProducts(rows.filter(row => favoriteIds.includes(row.id)).map(mapApiProduct));
      })
      .catch(reason => {
        if (activeRequest) setFavoritesError(reason instanceof Error ? reason.message : "Impossible de charger vos favoris.");
      })
      .finally(() => { if (activeRequest) setFavoritesLoading(false); });
    return () => { activeRequest = false; };
  }, [role, active, favoriteIds]);
  useEffect(() => {
    if (searchParams.get("tab") === "messages" && role !== "admin") setActive("Messages");
  }, [role, searchParams]);
  const orders = useMemo(() => customerOrders, [customerOrders]);
  const navItems = navByRole[role];
  const title = role === "client" ? "Espace client" : role === "vendeur" ? "Espace vendeur" : "Administration";
  const subtitle = role === "client" ? "Tout ce qui rend votre expérience FATA plus personnelle." : role === "vendeur" ? "Votre boutique, votre sélection, votre activité." : "Une vue d'ensemble pour prendre soin de FATA.";
  const displayName = user?.name || (role === "admin" ? "Équipe FATA" : role === "vendeur" ? "Votre boutique" : "Bonjour");

  async function exit() {
    try {
      await signOut();
      navigate("/");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Déconnexion impossible.");
    }
  }

  function removeFavorite(productId: string) {
    toggleFavoriteId(productId, true);
    setFavoriteIds(readFavoriteIds());
    setFavoriteProducts(current => current.filter(product => product.id !== productId));
  }

  return <section className={`workspace workspace-${role}`}><div className="page-container workspace-layout">
    <aside className="workspace-sidebar"><Link to="/" className="workspace-brand"><img className="brand-mark" src="/fata-logo.svg" alt="FATA"/> <span className="workspace-brand-label">{role === "admin" ? "ADMIN" : role === "vendeur" ? "VENDEUR" : "CLIENT"}</span></Link><div className="workspace-person"><div className="workspace-avatar">{displayName.slice(0, 1).toUpperCase()}</div><div className="workspace-person-copy"><strong>{displayName}</strong><small>{role === "admin" ? "Administrateur" : role === "vendeur" ? "Vendeur" : "Client FATA"}</small></div><span className="workspace-online-dot" aria-label="Session active"/></div><div className="workspace-section-heading">{title}</div><span className="workspace-nav-label">MENU {role === "admin" ? "ADMINISTRATION" : role.toUpperCase()}</span><nav aria-label={`Navigation ${title}`}>{navItems.map(item => <button type="button" key={item.label} className={active === item.label ? "active" : ""} aria-current={active === item.label ? "page" : undefined} onClick={() => { setActive(item.label); setSearchParams(item.label === "Messages" ? { tab: "messages" } : {}); }}><span className="workspace-nav-icon"><item.icon size={17}/></span><span className="workspace-nav-text">{item.label}</span>{item.label === "Mes commandes" && orders.length > 0 && <b>{orders.length}</b>}{item.label === "Messages" && unreadMessages > 0 && <b>{unreadMessages}</b>}</button>)}</nav><div className="workspace-sidebar-bottom"><Link to="/aide"><CircleHelp size={17}/> Centre d'aide</Link><button type="button" onClick={exit}><LogOut size={17}/> Quitter mon espace</button></div></aside>
    <div className="workspace-main"><header className="workspace-topbar"><div className="workspace-topbar-title"><span className="workspace-role-kicker"><span/> ESPACE {role === "admin" ? "ADMINISTRATEUR" : role.toUpperCase()}</span><h1>{title}</h1></div><div className="workspace-top-actions"><span className="workspace-avatar small-avatar">{displayName.slice(0, 1).toUpperCase()}</span><span className="workspace-top-name">{displayName}</span><NotificationCenter onOpen={notification => {
      if (role === "admin" && notification.type === "MESSAGE_REPORT") {
        setActive("Signalements");
      } else if (role !== "admin" && notification.orderId) {
        setActive(role === "vendeur" ? "Commandes" : "Mes commandes");
        if (role === "vendeur") setSellerOrdersRefresh(value => value + 1);
        else setOrdersRefresh(value => value + 1);
      } else if (role !== "admin" && notification.conversationId) {
        setActive("Messages");
        setSearchParams({ tab: "messages", conversation: notification.conversationId });
      }
    }}/></div></header><div className="workspace-content">{actionError && <p className="form-error" role="alert">{actionError}</p>}<div className="workspace-welcome"><div><span className="eyebrow">{role === "admin" ? "VOTRE PLATEFORME EN UN REGARD" : "RAVI DE VOUS RETROUVER"}</span><h2>{active === "Vue d'ensemble" ? <>Bonjour{user?.name ? ` ${user.name.split(" ")[0]}` : ""} <span>✳</span></> : active}</h2><p>{subtitle}</p></div></div>

      {active === "Vue d'ensemble" && role === "vendeur" && <AnalyticsDashboard role="seller"/>}

      {role === "vendeur" && user?.status === "en attente" && <div className="pending-review"><div><span className="pending-icon">✳</span><span><strong>Votre demande est en cours d'examen</strong><small>Nous revenons vers vous dès que votre boutique est prête à rejoindre FATA.</small></span></div><span className="status-pill status-pending">En attente</span></div>}
      {role === "vendeur" && user?.status === "refusé" && <div className="pending-review" role="status"><div><span className="pending-icon">✳</span><span><strong>Votre demande vendeur a été refusée</strong><small>Contactez l’équipe FATA si vous souhaitez obtenir plus d’informations.</small></span></div><span className="status-pill status-pending">Refusée</span></div>}

      {active === "Vue d'ensemble" && role !== "admin" && <><div className="workspace-stats">{(role === "client" ? [["Commandes", String(orders.length), "Votre historique FATA", Package], ["Favoris", String(favoriteIds.length), "Vos prochaines envies", Heart], ["Panier", "", "Reprendre vos achats", ShoppingBag], ["Assistance", "À vos côtés", "Quand vous en avez besoin", CircleHelp]] : [["Mes produits", "Gérer", "Ajouter et suivre vos références", Boxes], ["Commandes", "Après paiement", "Aucune commande n'est simulée", Package], ["Revenus", "À venir", "Suivi selon les ventes", Wallet], ["Avis clients", "À venir", "Après vos premières ventes", Heart]]).map(([label, value, hint, Icon]: any) => <div className="workspace-stat" key={label}><div className="workspace-stat-icon"><Icon size={18}/></div><span>{label}</span><strong>{label === "Panier" ? <Link to="/panier">Voir le panier <ArrowRight size={14}/></Link> : value}</strong><small>{hint}</small></div>)}</div>
        <div className="workspace-columns"><section className="workspace-panel"><div className="workspace-panel-heading"><div><span className="eyebrow">{role === "vendeur" ? "VOTRE ACTIVITÉ" : "VOTRE HISTORIQUE"}</span><h3>{role === "vendeur" ? "Commandes récentes" : "Vos dernières commandes"}</h3></div>{role === "client" && <button onClick={() => setActive("Mes commandes")}>Tout voir <ArrowRight size={14}/></button>}</div>{ordersLoading ? <p aria-busy="true">Chargement de vos commandes…</p> : orders.length ? <div className="order-list">{orders.slice(0, 3).map(order => <div className="order-row" key={order.id}><span className="order-icon"><Package size={17}/></span><div><strong>{order.id}</strong><small>{new Date(order.createdAt).toLocaleDateString("fr-FR")} · {order.items.length} article(s)</small>{role === "client" && order.items.slice(0, 3).map(item => <Link className="order-message-link" key={item.id} to={`/espace/client?tab=messages&product=${encodeURIComponent(item.productId)}&order=${encodeURIComponent(order.id)}`}>Contacter la boutique · {item.name}</Link>)}</div><span className="status-pill status-pending">{getOrderStatusLabel(order.status)}</span><strong>{formatPrice(order.total)}</strong></div>)}</div> : <div className="workspace-empty"><div className="empty-bag-icon"><ShoppingBag size={20}/></div><strong>{role === "vendeur" ? "Les commandes seront disponibles après activation des paiements." : "Tout commence avec une belle trouvaille."}</strong><p>{role === "vendeur" ? "Les demandes en attente de règlement ne sont pas encore transmises aux boutiques." : "Vos commandes apparaîtront ici lorsque vous en passerez une."}</p>{role === "client" && <Link to="/catalogue" className="text-link">Parcourir le catalogue <ArrowRight size={14}/></Link>}</div>}</section>
          <aside className="workspace-feature-card"><div className="feature-card-top"><span className="eyebrow">UN PETIT MOT DE FATA</span><span className="feature-star">✳</span></div><h3>{role === "client" ? "Une idée cadeau ?" : role === "vendeur" ? "Votre boutique, vos règles." : "Chaque détail compte."}</h3><p>{role === "client" ? "Explorez les boutiques locales et trouvez une attention qui ne ressemble qu'à vous." : role === "vendeur" ? "Racontez votre histoire, partagez vos nouveautés et faites grandir votre communauté." : "Prenez un moment pour veiller à l'expérience de chacun sur la plateforme."}</p><Link to={role === "vendeur" ? "/aide" : "/catalogue"}>{role === "vendeur" ? "Conseils vendeur" : role === "client" ? "Trouver un cadeau" : "Découvrir le catalogue"} <ArrowRight size={15}/></Link><div className="feature-card-mark">FATA<span>.</span></div></aside></div></>}

      {role === "client" && active === "Mes commandes" && <section className="workspace-panel full-panel"><div className="workspace-panel-heading"><div><span className="eyebrow">VOS ACHATS FATA</span><h3>Historique des commandes</h3></div><button type="button" onClick={() => setOrdersRefresh(value => value + 1)} disabled={ordersLoading}><RefreshCw size={14}/> Actualiser</button></div>{ordersLoading ? <p aria-busy="true">Chargement de vos commandes…</p> : orders.length ? <div className="order-list">{orders.map(order => <div className="order-row" key={order.id}><span className="order-icon"><Package size={17}/></span><div><strong>{order.id}</strong><small>{new Date(order.createdAt).toLocaleDateString("fr-FR")} · livraison à {order.city}</small>{order.items.map(item => <Link className="order-message-link" key={item.id} to={`/espace/client?tab=messages&product=${encodeURIComponent(item.productId)}&order=${encodeURIComponent(order.id)}`}>Contacter la boutique · {item.name}</Link>)}{order.fulfillments?.map(fulfillment => <FulfillmentProgress key={fulfillment.id} initial={fulfillment} orderId={order.id}/>)}</div><span className="status-pill status-pending">{getOrderStatusLabel(order.status)}</span><strong>{formatPrice(order.total)}</strong></div>)}</div> : <div className="workspace-empty"><Package size={25}/><strong>Vous n'avez pas encore de commande.</strong><p>Votre première histoire FATA commence ici.</p><Link to="/catalogue" className="button button-dark">Découvrir le catalogue <ArrowRight size={15}/></Link></div>}</section>}

      {role === "client" && active === "Mes favoris" && <section className="workspace-panel full-panel"><div className="workspace-panel-heading"><div><span className="eyebrow">VOS ENVIES DU MOMENT</span><h3>Vos favoris</h3></div></div>{favoritesError && <p className="form-error" role="alert">{favoritesError}</p>}{favoritesLoading ? <p aria-busy="true">Chargement de vos favoris…</p> : favoriteProducts.length ? <div className="product-grid">{favoriteProducts.map(product => <div className="favorite-mini" key={product.id}><img src={product.image} alt=""/><div><strong>{product.name}</strong><small>{formatPrice(product.price)}</small><Link to={`/produit/${product.id}`}>Voir le produit <ArrowRight size={13}/></Link><button type="button" onClick={() => removeFavorite(product.id)} aria-label={`Retirer ${product.name} des favoris`}><X size={13}/> Retirer</button></div></div>)}</div> : !favoritesError && <div className="workspace-empty"><Heart size={25}/><strong>Vos coups de cœur seront gardés ici.</strong><p>Appuyez sur le cœur d'un produit pour le retrouver facilement.</p><Link className="button button-dark" to="/catalogue">Trouver un coup de cœur <ArrowRight size={15}/></Link></div>}</section>}

      {role !== "admin" && active === "Messages" && <Messaging key={`${searchParams.get("product") ?? "inbox"}:${searchParams.get("order") ?? ""}:${searchParams.get("conversation") ?? ""}`} role={role} initialProductId={searchParams.get("product") ?? undefined} initialOrderId={searchParams.get("order") ?? undefined} initialConversationId={searchParams.get("conversation") ?? undefined}/>}

      {role === "client" && ["Mes adresses", "Paramètres"].includes(active) && <section className="workspace-panel full-panel"><div className="workspace-panel-heading"><div><span className="eyebrow">VOTRE COMPTE</span><h3>{active}</h3></div></div><div className="profile-detail"><div className="profile-detail-icon"><Store size={20}/></div><div><strong>{user?.name || "Votre nom"}</strong><span>{user?.email || "Connectez-vous pour personnaliser votre profil."}</span><small>Informations enregistrées dans cette démo locale.</small></div><Link className="button button-outline" to="/client/connexion">Gérer mon compte</Link></div></section>}

      {role === "vendeur" && active === "Mes produits" && <SellerManagement active="Mes produits"/>}
      {role === "vendeur" && active === "Ma boutique" && <SellerManagement active="Ma boutique"/>}
      {role === "vendeur" && active === "Revenus" && <AnalyticsDashboard role="seller"/>}
{role === "vendeur" && active === "Commandes" && <SellerOrders key={sellerOrdersRefresh}/>}
{role === "vendeur" && active === "Paramètres" && <section className="workspace-panel full-panel"><div className="workspace-panel-heading"><div><span className="eyebrow">ESPACE VENDEUR</span><h3>{active}</h3></div></div><div className="workspace-empty"><div className="empty-bag-icon"><Settings size={21}/></div><strong>Les réglages de votre boutique se trouveront ici.</strong><p>Ces fonctionnalités ne sont pas encore actives dans FATA.</p></div></section>}

      {role === "admin" && active === "Catégories" && <AdminCategories/>}
      {role === "admin" && active !== "Catégories" && <AdminManagement active={active as "Vue d'ensemble" | "Vendeurs" | "Produits" | "Commandes" | "Demandes contact" | "Signalements" | "Finances" | "Paramètres"} onNavigate={tab => setActive(tab)}/>}
      <div className="workspace-footer"><span><ShieldCheck size={14}/> FATA · Espace sécurisé</span><Link to="/">Retour à la boutique <ArrowRight size={14}/></Link></div>
    </div></div></div></section>;
}

type InboxNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  conversationId: string | null;
  orderId: string | null;
  readAt: string | null;
  createdAt: string;
};

function NotificationCenter({ onOpen }: { onOpen: (notification: InboxNotification) => void }) {
  const [notifications, setNotifications] = useState<InboxNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setNotifications(await apiRequest<InboxNotification[]>("/notifications"));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Notifications indisponibles.");
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function openNotification(notification: InboxNotification) {
    try {
      if (!notification.readAt) {
        await apiRequest(`/notifications/${encodeURIComponent(notification.id)}/read`, { method: "PATCH" });
        setNotifications(rows => rows.map(row => row.id === notification.id ? { ...row, readAt: new Date().toISOString() } : row));
      }
      setOpen(false);
      onOpen(notification);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’ouvrir cette notification.");
    }
  }

  const unread = notifications.filter(notification => !notification.readAt).length;
  return <div className="notification-center">
    <button className="notification-toggle" type="button" aria-label={`Notifications${unread ? `, ${unread} non lues` : ""}`} aria-expanded={open} onClick={() => setOpen(value => !value)}>
      <Bell size={18}/>{unread > 0 && <b>{unread}</b>}
    </button>
    {open && <div className="notification-popover">
      <div className="notification-popover-heading"><strong>Notifications</strong><button type="button" onClick={() => void load()} aria-label="Actualiser les notifications"><RefreshCw size={14}/></button></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!notifications.length && !error ? <p className="notification-empty">Aucune notification pour l’instant.</p> : notifications.slice(0, 12).map(notification => <button type="button" className={`notification-row ${notification.readAt ? "" : "notification-unread"}`} key={notification.id} onClick={() => void openNotification(notification)}><strong>{notification.title}</strong><span>{notification.body}</span><small>{new Date(notification.createdAt).toLocaleString("fr-FR")}</small></button>)}
    </div>}
  </div>;
}
