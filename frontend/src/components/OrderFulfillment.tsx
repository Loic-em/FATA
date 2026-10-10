import { useEffect, useState } from "react";
import { Check, Clock3, MapPin, PackageCheck, RefreshCw, ShieldCheck, Truck } from "lucide-react";
import { apiRequest, getFulfillmentStatusLabel, type ApiFulfillment } from "../data/api";
import { formatPrice } from "../data/orders";

export function FulfillmentProgress({ initial, orderId }: { initial: ApiFulfillment; orderId: string }) {
  const [fulfillment, setFulfillment] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canConfirm = fulfillment.status === (fulfillment.deliveryType === "PICKUP" ? "READY_FOR_PICKUP" : "SHIPPED");

  useEffect(() => setFulfillment(initial), [initial]);

  async function confirmReceived() {
    setBusy(true);
    setError("");
    try {
      const updated = await apiRequest<ApiFulfillment>(`/orders/${encodeURIComponent(orderId)}/fulfillments/${encodeURIComponent(fulfillment.id)}/received`, { method: "POST" });
      setFulfillment(updated);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Confirmation de réception impossible.");
    } finally {
      setBusy(false);
    }
  }

  return <article className="fulfillment-card">
    <header className="fulfillment-heading"><span className="fulfillment-icon"><PackageCheck size={16}/></span><div><strong>{fulfillment.storeName}</strong><small>{fulfillment.deliveryType === "PICKUP" ? "Retrait en boutique" : `Livraison · ${fulfillment.city}`}</small></div><span className={`status-pill ${fulfillment.status === "DELIVERED" ? "status-approved" : "status-pending"}`}>{getFulfillmentStatusLabel(fulfillment.status, fulfillment.orderStatus)}</span></header>
    <ul className="fulfillment-items">{fulfillment.items.map(item => <li key={item.id}><span>{item.quantity} × {item.name}</span><strong>{formatPrice(item.price * item.quantity)}</strong></li>)}</ul>
    {fulfillment.orderStatus === "TEST_PAID" && <p className="simulation-order-note"><ShieldCheck size={14}/> Simulation sans argent réel : cette commande de test peut parcourir le suivi complet.</p>}
    {fulfillment.orderStatus !== "PAID" && fulfillment.orderStatus !== "TEST_PAID" ? <p className="fulfillment-pending-note"><Clock3 size={14}/> Le suivi démarre après confirmation ou simulation du paiement.</p> : <>
      {fulfillment.deliveryType === "DELIVERY" && <div className="fulfillment-destination"><MapPin size={14}/><span>{fulfillment.address}, {fulfillment.city}</span></div>}
      {fulfillment.trackingCode && <p className="fulfillment-tracking"><Truck size={14}/> Référence de suivi : <strong>{fulfillment.trackingCode}</strong></p>}
      {fulfillment.events.length > 0 && <ol className="fulfillment-timeline">{fulfillment.events.map(event => <li key={event.id}><span className="timeline-dot"/><div><strong>{getFulfillmentStatusLabel(event.status, fulfillment.orderStatus)}</strong>{event.note && <small>{event.note}</small>}<time>{new Date(event.createdAt).toLocaleString("fr-FR")}</time></div></li>)}</ol>}
      {canConfirm && <button className="button button-dark fulfillment-confirm" type="button" disabled={busy} onClick={() => void confirmReceived()}>{busy ? "Confirmation…" : fulfillment.deliveryType === "PICKUP" ? "Confirmer le retrait" : "Confirmer la réception"} <Check size={14}/></button>}
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </article>;
}

export function SellerOrders() {
  const [rows, setRows] = useState<ApiFulfillment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [tracking, setTracking] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    setError("");
    try {
      setRows(await apiRequest<ApiFulfillment[]>("/orders/seller/fulfillments"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de charger les commandes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function advance(fulfillment: ApiFulfillment, status: "PREPARING" | "READY_FOR_PICKUP" | "SHIPPED") {
    setBusyId(fulfillment.id);
    setError("");
    try {
      const updated = await apiRequest<ApiFulfillment>(`/orders/seller/fulfillments/${encodeURIComponent(fulfillment.id)}`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...(status === "SHIPPED" && tracking[fulfillment.id]?.trim() ? { trackingCode: tracking[fulfillment.id].trim() } : {}) }),
      });
      setRows(current => current.map(row => row.id === updated.id ? updated : row));
      setTracking(current => ({ ...current, [fulfillment.id]: "" }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Mise à jour de la commande impossible.");
    } finally {
      setBusyId("");
    }
  }

  return <section className="workspace-panel full-panel seller-orders-panel">
    <div className="workspace-panel-heading"><div><span className="eyebrow">PRÉPARATION ET LIVRAISON</span><h3>Commandes à traiter</h3></div><button type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={14}/> Actualiser</button></div>
    <p className="fulfillment-intro">Les commandes confirmées et les commandes simulées apparaissent ici. Chaque boutique ne voit que les articles qu'elle doit préparer ; les simulations n'ont aucune valeur financière.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <p aria-busy="true">Chargement des commandes…</p> : rows.length ? <div className="seller-fulfillment-list">{rows.map(fulfillment => {
      const busy = busyId === fulfillment.id;
      const next = fulfillment.status === "PENDING" ? "PREPARING" : fulfillment.deliveryType === "PICKUP" ? "READY_FOR_PICKUP" : "SHIPPED";
      return <article className="seller-fulfillment-card" key={fulfillment.id}>
        <header><div><span className="eyebrow">{fulfillment.orderStatus === "TEST_PAID" ? "SIMULATION · COMMANDE " : "COMMANDE "}{fulfillment.orderId}</span><h4>{fulfillment.customerName}</h4><small>{new Date(fulfillment.orderCreatedAt).toLocaleString("fr-FR")} · {fulfillment.deliveryType === "PICKUP" ? "Retrait en boutique" : "Livraison"}</small></div><span className={`status-pill ${fulfillment.status === "DELIVERED" ? "status-approved" : fulfillment.orderStatus === "TEST_PAID" ? "status-simulation" : "status-pending"}`}>{getFulfillmentStatusLabel(fulfillment.status, fulfillment.orderStatus)}</span></header>
        <ul className="fulfillment-items">{fulfillment.items.map(item => <li key={item.id}><span>{item.quantity} × {item.name}</span><strong>{formatPrice(item.price * item.quantity)}</strong></li>)}</ul>
        <div className="seller-delivery-details"><span><MapPin size={14}/> {fulfillment.address}, {fulfillment.city}</span><a href={`tel:${encodeURIComponent(fulfillment.phone)}`}>{fulfillment.phone}</a>{fulfillment.instructions && <small>Instruction client : {fulfillment.instructions}</small>}</div>
        {fulfillment.trackingCode && <p className="fulfillment-tracking"><Truck size={14}/> Suivi : <strong>{fulfillment.trackingCode}</strong></p>}
        {fulfillment.orderStatus === "TEST_PAID" && <p className="simulation-order-note"><ShieldCheck size={14}/> Commande de démonstration, sans mouvement d’argent.</p>}
        <ol className="fulfillment-timeline">{fulfillment.events.map(event => <li key={event.id}><span className="timeline-dot"/><div><strong>{getFulfillmentStatusLabel(event.status, fulfillment.orderStatus)}</strong>{event.note && <small>{event.note}</small>}<time>{new Date(event.createdAt).toLocaleString("fr-FR")}</time></div></li>)}</ol>
        {fulfillment.status === "PREPARING" && fulfillment.deliveryType === "DELIVERY" && <label className="tracking-code-field">Référence de suivi (facultative)<input value={tracking[fulfillment.id] ?? ""} onChange={event => setTracking(current => ({ ...current, [fulfillment.id]: event.target.value }))} maxLength={100} placeholder="Ex. numéro du transporteur"/></label>}
        {fulfillment.status === "PENDING" && <button className="button button-dark" type="button" disabled={busy} onClick={() => void advance(fulfillment, "PREPARING")}>{busy ? "Mise à jour…" : "Commencer la préparation"} <PackageCheck size={14}/></button>}
        {fulfillment.status === "PREPARING" && <button className="button button-dark" type="button" disabled={busy} onClick={() => void advance(fulfillment, next)}>{busy ? "Mise à jour…" : fulfillment.deliveryType === "PICKUP" ? "Commande prête au retrait" : "Marquer comme expédiée"} <Truck size={14}/></button>}
        {(fulfillment.status === "SHIPPED" || fulfillment.status === "READY_FOR_PICKUP") && <p className="fulfillment-pending-note"><Clock3 size={14}/> En attente de la confirmation du client.</p>}
        {fulfillment.status === "DELIVERED" && <p className="fulfillment-delivered"><Check size={14}/> Réception confirmée</p>}
      </article>;
    })}</div> : <div className="workspace-empty"><div className="empty-bag-icon"><Truck size={20}/></div><strong>Aucune commande à traiter.</strong><p>Les prochaines commandes payées ou simulées apparaîtront ici avec les articles de votre boutique uniquement.</p></div>}
  </section>;
}
