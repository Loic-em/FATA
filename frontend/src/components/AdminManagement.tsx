import { Fragment, useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Eye, EyeOff, Flag, Pencil, RefreshCw, Save, ShieldAlert, Trash2, X } from "lucide-react";
import { apiRequest, getFulfillmentStatusLabel, getOrderStatusLabel, type ApiOrder, type ApiProduct } from "../data/api";
import { formatPrice } from "../data/orders";
import AnalyticsDashboard from "./AnalyticsDashboard";
import AccountSettings from "./AccountSettings";
import AdminPlatformSettings from "./AdminPlatformSettings";

type AdminTab = "Vue d'ensemble" | "Vendeurs" | "Produits" | "Commandes" | "Demandes contact" | "Signalements" | "Finances" | "Paramètres";
type SellerApplication = {
  id: string;
  name: string;
  city: string;
  category: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  seller: { name: string; email: string; sellerStatus: string | null; createdAt: string } | null;
  _count: { products: number };
};
type AdminOrder = ApiOrder & { customer: { name: string; email: string } };
type AdminCategory = { id: string; name: string; active: boolean; parentId?: string | null; parent?: { id: string; name: string } | null };
type ProductDraft = { id: string; name: string; description: string; price: string; stock: string; categoryId: string; image: string };
type PaymentConfig = {
  mode: string;
  configured: boolean;
  apiKeyConfigured: boolean;
  apiSecretConfigured: boolean;
  webhookSecretConfigured: boolean;
  webhookUrlConfigured: boolean;
};
type MessageReport = {
  id: string;
  reason: string;
  status: "PENDING" | "REVIEWED" | "DISMISSED";
  resolution: string | null;
  createdAt: string;
  reporter: { name: string; email: string };
  message: { body: string; sender: { id: string; name: string } };
  conversation: {
    client: { name: string };
    seller: { name: string };
    product: { name: string };
    order: { id: string } | null;
    messages: { id: string; body: string; sender: { name: string }; createdAt: string }[];
  };
};
type ContactRequest = {
  id: string;
  name: string;
  email: string;
  subject: "GENERAL" | "SELLER" | "ORDER" | "OTHER";
  message: string;
  status: "NEW" | "IN_PROGRESS" | "CLOSED";
  createdAt: string;
};

const sellerStatusLabel: Record<SellerApplication["status"], string> = {
  PENDING: "À examiner",
  APPROVED: "Approuvée",
  REJECTED: "Refusée",
};
const contactSubjectLabel: Record<ContactRequest["subject"], string> = { GENERAL: "Question générale", SELLER: "Devenir vendeur", ORDER: "Commande", OTHER: "Autre" };
const contactStatusLabel: Record<ContactRequest["status"], string> = { NEW: "Nouveau", IN_PROGRESS: "En cours", CLOSED: "Clôturé" };

function contactMailto(request: ContactRequest) {
  return `mailto:${request.email}?subject=${encodeURIComponent(`FATA — ${contactSubjectLabel[request.subject]}`)}`;
}

export default function AdminManagement({ active, onNavigate }: { active: AdminTab; onNavigate: (tab: AdminTab) => void }) {
  const [sellers, setSellers] = useState<SellerApplication[]>([]);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [contactRequests, setContactRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (active === "Vendeurs") {
        setSellers(await apiRequest<SellerApplication[]>("/stores/admin/sellers"));
      } else if (active === "Produits") {
        const [productRows, categoryRows] = await Promise.all([
          apiRequest<ApiProduct[]>("/products/admin/all"),
          apiRequest<AdminCategory[]>("/categories/admin/all"),
        ]);
        setProducts(productRows);
        setCategories(categoryRows);
      } else if (active === "Commandes") {
        setOrders(await apiRequest<AdminOrder[]>("/orders/admin/all"));
      } else if (active === "Finances") {
        setPaymentConfig(await apiRequest<PaymentConfig>("/payments/geniuspay/admin/config"));
      } else if (active === "Signalements") {
        setReports(await apiRequest<MessageReport[]>("/admin/message-reports"));
      } else if (active === "Demandes contact") {
        setContactRequests(await apiRequest<ContactRequest[]>("/admin/contact-requests"));
      } else if (active === "Vue d'ensemble") {
        const [sellerRows, productRows, orderRows, config] = await Promise.all([
          apiRequest<SellerApplication[]>("/stores/admin/sellers"),
          apiRequest<ApiProduct[]>("/products/admin/all"),
          apiRequest<AdminOrder[]>("/orders/admin/all"),
          apiRequest<PaymentConfig>("/payments/geniuspay/admin/config"),
        ]);
        setSellers(sellerRows);
        setProducts(productRows);
        setOrders(orderRows);
        setPaymentConfig(config);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chargement de l'administration impossible.");
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => { void load(); }, [load]);

  async function reviewSeller(seller: SellerApplication, status: "APPROVED" | "REJECTED") {
    setBusyId(seller.id);
    setError("");
    try {
      await apiRequest(`/stores/admin/sellers/${encodeURIComponent(seller.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de modifier cette demande.");
    } finally {
      setBusyId("");
    }
  }

  async function toggleProduct(product: ApiProduct & { active?: boolean }) {
    setBusyId(product.id);
    setError("");
    try {
      await apiRequest(`/products/admin/${encodeURIComponent(product.id)}/active`, {
        method: "PATCH",
        body: JSON.stringify({ active: !product.active }),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de modifier ce produit.");
    } finally {
      setBusyId("");
    }
  }

  function editProduct(product: ApiProduct & { active?: boolean }) {
    setError("");
    setProductDraft({
      id: product.id,
      name: product.name,
      description: product.description,
      price: String(product.price),
      stock: String(product.stock),
      categoryId: product.category.id,
      image: product.image ?? "",
    });
  }

  async function updateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productDraft) return;
    setBusyId(productDraft.id);
    setError("");
    try {
      await apiRequest(`/products/admin/${encodeURIComponent(productDraft.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: productDraft.name.trim(),
          description: productDraft.description.trim(),
          price: Number(productDraft.price),
          stock: Number(productDraft.stock),
          categoryId: productDraft.categoryId,
          image: productDraft.image.trim() || null,
        }),
      });
      setProductDraft(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Modification du produit impossible.");
    } finally {
      setBusyId("");
    }
  }

  async function deleteProduct(product: ApiProduct) {
    if (!window.confirm(`Supprimer définitivement « ${product.name} » ? Les produits liés à des commandes ou conversations ne pourront pas être supprimés ; vous pourrez alors les masquer.`)) return;
    setBusyId(product.id);
    setError("");
    try {
      await apiRequest(`/products/admin/${encodeURIComponent(product.id)}`, { method: "DELETE" });
      if (productDraft?.id === product.id) setProductDraft(null);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Suppression du produit impossible.");
    } finally {
      setBusyId("");
    }
  }

  async function reviewReport(
    reportId: string,
    status: "REVIEWED" | "DISMISSED",
    action: "NONE" | "CLOSE_CONVERSATION" | "SUSPEND_MESSAGE_SENDER",
    resolution = "",
  ) {
    setBusyId(reportId);
    setError("");
    try {
      await apiRequest(`/admin/message-reports/${encodeURIComponent(reportId)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, action, resolution }),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de traiter ce signalement.");
    } finally {
      setBusyId("");
    }
  }

  async function updateContactRequest(request: ContactRequest, status: ContactRequest["status"]) {
    setBusyId(request.id);
    setError("");
    try {
      await apiRequest(`/admin/contact-requests/${encodeURIComponent(request.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de mettre à jour cette demande.");
    } finally {
      setBusyId("");
    }
  }

  const pendingSellers = sellers.filter(seller => seller.status === "PENDING");
  const sections = active === "Vue d'ensemble" ? (
    <>
      <AnalyticsDashboard role="admin"/>
      <div className="workspace-stats">
        {[
          { label: "Demandes vendeurs", value: String(pendingSellers.length), hint: "À examiner", tab: "Vendeurs" as const },
          { label: "Produits", value: String(products.length), hint: `${products.filter(product => product.active).length} visibles`, tab: "Produits" as const },
          { label: "Commandes", value: String(orders.length), hint: "Demandes enregistrées", tab: "Commandes" as const },
          { label: "Paiements", value: paymentConfig?.configured ? "Mode test prêt" : "À configurer", hint: "Aucun encaissement réel", tab: "Finances" as const },
        ].map(item => <button className="workspace-stat admin-stat-button" key={item.label} onClick={() => onNavigate(item.tab)}><span>{item.label}</span><strong>{item.value}</strong><small>{item.hint}</small></button>)}
      </div>
      <section className="workspace-panel full-panel">
        <div className="workspace-panel-heading"><div><span className="eyebrow">À TRAITER EN PRIORITÉ</span><h3>Demandes vendeurs</h3></div><button onClick={() => onNavigate("Vendeurs")}>Toutes les demandes <RefreshCw size={14}/></button></div>
        {pendingSellers.length ? <div className="admin-requests">{pendingSellers.slice(0, 5).map(seller => <SellerRow key={seller.id} seller={seller} busy={busyId === seller.id} onReview={status => void reviewSeller(seller, status)}/>)}</div> : <div className="workspace-empty"><Check size={22}/><strong>Aucune demande en attente.</strong></div>}
      </section>
      <section className="workspace-panel full-panel">
        <div className="workspace-panel-heading"><div><span className="eyebrow">ACTIVITÉ RÉCENTE</span><h3>Dernières commandes</h3></div><button onClick={() => onNavigate("Commandes")}>Toutes les commandes</button></div>
        {orders.slice(0, 5).length ? <div className="order-list">{orders.slice(0, 5).map(order => <AdminOrderRow key={order.id} order={order}/>)}</div> : <div className="workspace-empty"><strong>Aucune commande enregistrée pour l’instant.</strong></div>}
      </section>
    </>
  ) : active === "Vendeurs" ? (
    <section className="workspace-panel full-panel">
      <PanelHeading eyebrow="CANDIDATURES BOUTIQUES" title="Gestion des vendeurs"/>
      {sellers.length ? <div className="admin-requests">{sellers.map(seller => <SellerRow key={seller.id} seller={seller} busy={busyId === seller.id} onReview={status => void reviewSeller(seller, status)}/>)}</div> : !loading && <EmptyMessage>Pas encore de vendeur inscrit.</EmptyMessage>}
    </section>
  ) : active === "Produits" ? (
    <section className="workspace-panel full-panel">
      <PanelHeading eyebrow="MODÉRATION DU CATALOGUE" title="Produits et demandes de publication"/>
      {products.length ? <div className="seller-product-list">{products.map(product => <Fragment key={product.id}>
        <div className="seller-product-row admin-managed-row">
          <div className="seller-product-thumb">{product.image && <img src={product.image} alt=""/>}</div>
          <div><strong>{product.name}</strong><small>{product.store.name} · {product.category.parent ? `${product.category.parent.name} · ` : ""}{product.category.name}</small></div>
          <span className={`status-pill ${product.active ? "status-approved" : "status-pending"}`}>{product.active ? "Visible" : "À valider / masqué"}</span>
          <strong>{formatPrice(product.price)}</strong>
          <button type="button" disabled={busyId === product.id} onClick={() => void toggleProduct(product)} aria-label={product.active ? `Masquer ${product.name}` : `Publier ${product.name}`}>{product.active ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
          <button type="button" disabled={busyId === product.id} onClick={() => editProduct(product)} aria-label={`Modifier ${product.name}`}><Pencil size={16}/></button>
          <button type="button" className="admin-delete-button" disabled={busyId === product.id} onClick={() => void deleteProduct(product)} aria-label={`Supprimer ${product.name}`}><Trash2 size={16}/></button>
        </div>
        {productDraft?.id === product.id && <form className="draft-product-form admin-inline-edit admin-product-edit" onSubmit={updateProduct}>
          <label>Nom<input value={productDraft.name} onChange={event => setProductDraft({ ...productDraft, name: event.target.value })} required minLength={2} maxLength={120}/></label>
          <label>Description<textarea value={productDraft.description} onChange={event => setProductDraft({ ...productDraft, description: event.target.value })} required minLength={10} maxLength={2000} rows={3}/></label>
          <label>Prix (FCFA)<input type="number" value={productDraft.price} onChange={event => setProductDraft({ ...productDraft, price: event.target.value })} required min={1} max={100000000} step={1}/></label>
          <label>Stock<input type="number" value={productDraft.stock} onChange={event => setProductDraft({ ...productDraft, stock: event.target.value })} required min={0} max={1000000} step={1}/></label>
          <label>Catégorie<select value={productDraft.categoryId} onChange={event => setProductDraft({ ...productDraft, categoryId: event.target.value })} required>{categories.filter(category => category.active || category.id === productDraft.categoryId).map(category => <option key={category.id} value={category.id}>{category.parent ? `${category.parent.name} — ${category.name}` : category.name}{category.active ? "" : " (inactive — catégorie conservée)"}</option>)}</select></label>
          <label>Image (URL, facultative)<input value={productDraft.image} onChange={event => setProductDraft({ ...productDraft, image: event.target.value })} maxLength={500}/></label>
          <div className="admin-edit-actions"><button className="button button-dark" type="submit" disabled={busyId === product.id}>{busyId === product.id ? "Enregistrement…" : "Enregistrer"} <Save size={14}/></button><button className="button button-outline" type="button" onClick={() => setProductDraft(null)} disabled={busyId === product.id}>Annuler <X size={14}/></button></div>
        </form>}
      </Fragment>)}</div> : !loading && <EmptyMessage>Aucun produit à modérer.</EmptyMessage>}
    </section>
  ) : active === "Commandes" ? (
    <section className="workspace-panel full-panel">
      <PanelHeading eyebrow="SUIVI DES DEMANDES" title="Toutes les commandes"/>
      {orders.length ? <div className="order-list">{orders.map(order => <AdminOrderRow key={order.id} order={order}/>)}</div> : !loading && <EmptyMessage>Aucune commande enregistrée.</EmptyMessage>}
    </section>
  ) : active === "Signalements" ? (
    <section className="workspace-panel full-panel">
      <PanelHeading eyebrow="SÉCURITÉ ET CONFIANCE" title="Signalements de messages"/>
      {reports.length ? <div className="message-report-list">{reports.map(report => <MessageReportRow key={report.id} report={report} busy={busyId === report.id} onReview={(status, action, resolution) => void reviewReport(report.id, status, action, resolution)}/>)}</div> : !loading && <EmptyMessage>Aucun signalement de message.</EmptyMessage>}
    </section>
  ) : active === "Demandes contact" ? (
    <section className="workspace-panel full-panel">
      <PanelHeading eyebrow="ASSISTANCE FATA" title="Demandes reçues via le formulaire"/>
      {contactRequests.length ? <div className="contact-request-list">{contactRequests.map(request => <article className="contact-request-row" key={request.id}>
        <header className="contact-request-header"><div><strong>{request.name}</strong><a href={contactMailto(request)}>{request.email}</a></div><span className={`status-pill ${request.status === "CLOSED" ? "status-approved" : "status-pending"}`}>{contactStatusLabel[request.status]}</span></header>
        <small>{contactSubjectLabel[request.subject]} · {new Date(request.createdAt).toLocaleString("fr-FR")}</small>
        <p className="contact-request-message">{request.message}</p>
        <div className="contact-request-actions"><a className="button button-outline" href={contactMailto(request)}>Répondre par e-mail</a>{request.status === "NEW" && <button type="button" disabled={busyId === request.id} onClick={() => void updateContactRequest(request, "IN_PROGRESS")}>Prendre en charge</button>}{request.status !== "CLOSED" && <button type="button" disabled={busyId === request.id} onClick={() => void updateContactRequest(request, "CLOSED")}>Clôturer</button>}</div>
      </article>)}</div> : !loading && <EmptyMessage>Aucune demande de contact reçue.</EmptyMessage>}
    </section>
  ) : active === "Finances" ? (
    <section className="workspace-panel full-panel">
      <PanelHeading eyebrow="CONFIGURATION DU PRESTATAIRE" title="Paiements GeniusPay"/>
      {paymentConfig ? <>
        <div className={`payment-config-banner ${paymentConfig.configured ? "payment-config-ready" : ""}`}>
          <ShieldAlert size={21}/>
          <div>
            <strong>{paymentConfig.configured ? "Sandbox GeniusPay configuré" : "Le paiement GeniusPay n’est pas encore configuré"}</strong>
            <p>{paymentConfig.configured ? "Les paiements sont isolés en sandbox. Aucun paiement réel ne peut être déclenché par cette application." : "Le paiement reste désactivé tant que les clés sandbox et le webhook ne sont pas renseignés côté API."}</p>
          </div>
        </div>
        <div className="payment-config-checks">
          <ConfigCheck label="GENIUSPAY_MODE=sandbox" ready={paymentConfig.mode === "sandbox"}/>
          <ConfigCheck label="GENIUSPAY_API_KEY" ready={paymentConfig.apiKeyConfigured}/>
          <ConfigCheck label="GENIUSPAY_API_SECRET" ready={paymentConfig.apiSecretConfigured}/>
          <ConfigCheck label="GENIUSPAY_WEBHOOK_SECRET" ready={paymentConfig.webhookSecretConfigured}/>
          <ConfigCheck label="GENIUSPAY_WEBHOOK_URL HTTPS" ready={paymentConfig.webhookUrlConfigured}/>
        </div>
        <p className="payment-config-help">Renseignez les clés sandbox dans <code>backend/.env</code>, puis configurez l’URL HTTPS du webhook dans GeniusPay et redémarrez l’API. Gardez les clés secrètes uniquement côté serveur.</p>
        <p className="payment-config-help">Le checkout hébergé GeniusPay reste sandbox et n’encaisse rien. Pour tester préparation et livraison sans argent, utilise la simulation interne dans une commande client.</p>
      </> : !loading && <EmptyMessage>Impossible de lire la configuration de paiement.</EmptyMessage>}
    </section>
  ) : (
    <>
      <AccountSettings section="profile"/>
      <AccountSettings section="security"/>
      <AdminPlatformSettings onNavigate={onNavigate}/>
    </>
  );

  return <div className="admin-management">
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && <p className="loading-state" aria-busy="true"><span className="loading-spinner"/> Chargement des données de l’administration…</p>}
    {sections}
  </div>;
}

function PanelHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="workspace-panel-heading"><div><span className="eyebrow">{eyebrow}</span><h3>{title}</h3></div></div>;
}

function SellerRow({ seller, busy, onReview }: { seller: SellerApplication; busy: boolean; onReview: (status: "APPROVED" | "REJECTED") => void }) {
  return <div className="admin-request"><div className="seller-avatar">{seller.name.slice(0, 1).toUpperCase()}</div><div><strong>{seller.name}</strong><small>{seller.seller?.name ?? "Vendeur"} · {seller.seller?.email ?? "E-mail indisponible"} · {seller.city}</small><small>Inscrite le {new Date(seller.createdAt).toLocaleDateString("fr-FR")} · {seller._count.products} produit(s)</small></div><span className={`status-pill ${seller.status === "APPROVED" ? "status-approved" : "status-pending"}`}>{sellerStatusLabel[seller.status]}</span>{seller.status === "PENDING" ? <><button disabled={busy} onClick={() => onReview("APPROVED")} aria-label={`Approuver ${seller.name}`}><Check size={16}/> Approuver</button><button disabled={busy} onClick={() => onReview("REJECTED")} aria-label={`Refuser ${seller.name}`}><X size={16}/> Refuser</button></> : <button disabled={busy} onClick={() => onReview(seller.status === "APPROVED" ? "REJECTED" : "APPROVED")}>{seller.status === "APPROVED" ? "Suspendre" : "Réactiver"}</button>}</div>;
}

function AdminOrderRow({ order }: { order: AdminOrder }) {
  return <article className="admin-order-card">
    <div className="order-row admin-order-row">
      <span className="order-icon"><span aria-hidden="true">#</span></span>
      <div><strong>{order.id}</strong><small>{order.customer.name} · {order.customer.email}</small><small>{new Date(order.createdAt).toLocaleString("fr-FR")} · {order.phone || "Téléphone absent"}</small></div>
      <span className="status-pill status-pending">{getOrderStatusLabel(order.status)}</span>
      <strong>{formatPrice(order.total)}</strong>
    </div>
    <details className="admin-order-details">
      <summary>Voir les articles et la livraison</summary>
      <div className="admin-order-detail-grid">
        <span>Mode de réception</span><strong>{order.deliveryType === "PICKUP" ? "Retrait chez le vendeur" : "Livraison"}</strong>
        <span>Ville</span><strong>{order.city}</strong>
        <span>Adresse</span><strong>{order.address || "Non renseignée"}</strong>
        <span>Sous-total · livraison</span><strong>{formatPrice(order.subtotal)} · {formatPrice(order.shipping)}</strong>
        {order.instructions && <><span>Instructions</span><strong>{order.instructions}</strong></>}
      </div>
      <ul className="admin-order-items">{order.items.map(item => <li key={item.id}><span>{item.quantity} × {item.name}</span><strong>{formatPrice(item.price * item.quantity)}</strong></li>)}</ul>
      {!!order.fulfillments?.length && <div className="admin-fulfillment-summary"><strong>Préparation par boutique</strong>{order.fulfillments.map(fulfillment => <div key={fulfillment.id}><span>{fulfillment.storeName}</span><span>{getFulfillmentStatusLabel(fulfillment.status, fulfillment.orderStatus)}{fulfillment.trackingCode ? ` · ${fulfillment.trackingCode}` : ""}</span></div>)}</div>}
    </details>
  </article>;
}

function EmptyMessage({ children }: { children: string }) {
  return <div className="workspace-empty"><strong>{children}</strong></div>;
}

function ConfigCheck({ label, ready }: { label: string; ready: boolean }) {
  return <div className="payment-config-check"><span className={`status-pill ${ready ? "status-approved" : "status-pending"}`}>{ready ? "Prêt" : "Manquant"}</span><strong>{label}</strong></div>;
}

function MessageReportRow({ report, busy, onReview }: {
  report: MessageReport;
  busy: boolean;
  onReview: (status: "REVIEWED" | "DISMISSED", action: "NONE" | "CLOSE_CONVERSATION" | "SUSPEND_MESSAGE_SENDER", resolution: string) => void;
}) {
  return <article className="message-report-card">
    <header><Flag size={17}/><div><strong>{report.reason.split(":")[0].replaceAll("_", " ")}</strong><small>Signalé par {report.reporter.name} · {new Date(report.createdAt).toLocaleString("fr-FR")}</small></div><span className={`status-pill ${report.status === "PENDING" ? "status-pending" : "status-approved"}`}>{report.status === "PENDING" ? "À examiner" : report.status === "REVIEWED" ? "Traité" : "Classé"}</span></header>
    <p className="message-report-detail">{report.reason.slice(report.reason.indexOf(":") + 1).trim()}</p>
    <blockquote><strong>{report.message.sender.name} :</strong> {report.message.body}</blockquote>
    <small className="message-report-context">{report.conversation.client.name} ↔ {report.conversation.seller.name} · {report.conversation.product.name}{report.conversation.order && ` · Commande ${report.conversation.order.id}`}</small>
    {report.conversation.messages.length > 1 && <details><summary>Contexte récent ({report.conversation.messages.length} messages)</summary><ul>{[...report.conversation.messages].reverse().map(message => <li key={message.id}><strong>{message.sender.name} :</strong> {message.body}</li>)}</ul></details>}
    {report.status === "PENDING" && <form className="message-report-actions" onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      onReview("REVIEWED", String(data.get("action")) as "NONE" | "CLOSE_CONVERSATION" | "SUSPEND_MESSAGE_SENDER", String(data.get("resolution") ?? ""));
    }}>
      <select name="action" defaultValue="NONE" aria-label="Mesure de modération">
        <option value="NONE">Traiter sans suspension</option>
        <option value="CLOSE_CONVERSATION">Suspendre cette conversation</option>
        <option value="SUSPEND_MESSAGE_SENDER">Suspendre la messagerie de l’auteur</option>
      </select>
      <input name="resolution" maxLength={500} placeholder="Note de modération (facultative)"/>
      <button className="button button-dark" type="submit" disabled={busy}>{busy ? "Traitement…" : "Traiter"}</button>
      <button className="button button-outline" type="button" disabled={busy} onClick={() => onReview("DISMISSED", "NONE", "Signalement examiné et classé sans mesure.")}>Classer sans suite</button>
    </form>}
    {report.resolution && <p className="form-success">{report.resolution}</p>}
  </article>;
}
