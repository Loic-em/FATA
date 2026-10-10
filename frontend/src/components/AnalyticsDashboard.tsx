import { useEffect, useMemo, useState } from "react";
import { Activity, Eye, Heart, ShoppingBag, Store, Wallet } from "lucide-react";
import { apiRequest } from "../data/api";
import { formatPrice } from "../data/orders";

type Period = "today" | "7d" | "30d" | "3m" | "1y";
type AnalyticsView = "overview" | "sales" | "products" | "orders" | "payments";
type SeriesPoint = {
  key: string;
  label: string;
  visits: number;
  storeViews: number;
  productViews: number;
  cartAdds: number;
  favorites: number;
  orders: number;
  revenue: number;
};
type ProductMetric = { id: string; name: string; views?: number; cartAdds?: number; favorites?: number; units?: number; revenue?: number; rating?: number; reviews?: number };
type Report = {
  period: Period;
  bucket: "day" | "month";
  totals: {
    visits: number; storeViews: number; productViews: number; cartAdds: number; favorites: number;
    orders: number; paidRevenue: number; averageRating: number; reviewCount: number;
  };
  series: SeriesPoint[];
  orderStatuses: Record<string, number>;
  paymentStatuses: Record<string, number>;
  topViewed: ProductMetric[];
  topSold: ProductMetric[];
  productPerformance: ProductMetric[];
  platform?: { usersCreatedInPeriod: number; sellers: Record<string, number>; products: number };
  filterOptions?: {
    sellers: { id: string; name: string }[];
    products: { id: string; name: string }[];
    statuses: string[];
    paymentMethods: string[];
    cities: string[];
  };
};

const periodOptions: [Period, string][] = [
  ["today", "Aujourd'hui"], ["7d", "7 jours"], ["30d", "30 jours"], ["3m", "3 mois"], ["1y", "1 an"],
];
const numberFormat = new Intl.NumberFormat("fr-FR");
const statusLabel: Record<string, string> = {
  AWAITING_PAYMENT: "En attente de paiement", TEST_PAID: "Paiement sandbox", PAID: "Payées",
  CANCELLED: "Annulées", INITIALIZING: "Initialisées", PENDING: "En attente", SUCCEEDED: "Réussies", FAILED: "Échouées",
};

export default function AnalyticsDashboard({ role }: { role: "admin" | "seller" }) {
  const [period, setPeriod] = useState<Period>("30d");
  const [activeView, setActiveView] = useState<AnalyticsView>("overview");
  const [sellerId, setSellerId] = useState("");
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [city, setCity] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ period });
    if (role === "admin") {
      if (sellerId) params.set("sellerId", sellerId);
      if (status) params.set("status", status);
      if (paymentMethod) params.set("paymentMethod", paymentMethod);
      if (city) params.set("city", city);
    }
    if (productId) params.set("productId", productId);
    setLoading(true);
    setError("");
    apiRequest<Report>(`/analytics/${role}?${params.toString()}`)
      .then(result => { if (active) setReport(result); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Les statistiques sont indisponibles."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [role, period, sellerId, productId, status, paymentMethod, city]);

  const productOptions = report?.filterOptions?.products ?? [];
  const cards = useMemo(() => {
    if (!report) return [];
    const t = report.totals;
    return role === "admin" ? [
      { label: "Visites du site", value: numberFormat.format(t.visits), hint: "Pages consultées, comptées par jour", icon: Activity },
      { label: "Vues produits", value: numberFormat.format(t.productViews), hint: "Fiches produits ouvertes", icon: Eye },
      { label: "Ajouts au panier", value: numberFormat.format(t.cartAdds), hint: "Actions d'ajout", icon: ShoppingBag },
      { label: "Commandes", value: numberFormat.format(t.orders), hint: "Toutes les commandes de la période", icon: Store },
      { label: "Chiffre payé", value: formatPrice(t.paidRevenue), hint: "Commandes au statut payé réel", icon: Wallet },
      { label: "Note moyenne", value: t.reviewCount ? `${t.averageRating.toFixed(1)} / 5` : "—", hint: `${numberFormat.format(t.reviewCount)} avis cumulés`, icon: Heart },
    ] : [
      { label: "Ventes payées", value: formatPrice(t.paidRevenue), hint: "Paiements réels confirmés", icon: Wallet },
      { label: "Commandes", value: numberFormat.format(t.orders), hint: "Commandes contenant vos produits", icon: Activity },
      { label: "Visites boutique", value: numberFormat.format(t.storeViews), hint: "Visites de votre boutique", icon: Store },
      { label: "Note moyenne", value: t.reviewCount ? `${t.averageRating.toFixed(1)} / 5` : "—", hint: `${numberFormat.format(t.reviewCount)} avis sur vos produits`, icon: Heart },
    ];
  }, [report, role]);

  if (error && !report) return <section className="workspace-panel full-panel analytics-panel" aria-live="polite"><h3>Statistiques indisponibles</h3><p className="form-error">{error}</p></section>;
  if (!report) return <section className="workspace-panel full-panel analytics-panel" aria-busy="true">Chargement des statistiques…</section>;

  const activitySeries = role === "admin"
    ? [{ key: "visits" as const, label: "Visites du site", color: "#6b5685" }, { key: "storeViews" as const, label: "Visites boutique", color: "#a07dbe" }, { key: "productViews" as const, label: "Vues produits", color: "#c66f4e" }, { key: "cartAdds" as const, label: "Ajouts panier", color: "#56847a" }]
    : [{ key: "storeViews" as const, label: "Visites boutique", color: "#6b5685" }, { key: "productViews" as const, label: "Vues produits", color: "#c66f4e" }, { key: "cartAdds" as const, label: "Ajouts panier", color: "#56847a" }, { key: "favorites" as const, label: "Favoris", color: "#bd6d8a" }];

  return <div className="analytics-dashboard" aria-busy={loading}>
    <section className="workspace-panel full-panel analytics-panel">
      <div className="analytics-heading"><div><span className="eyebrow">ANALYSE DE L'ACTIVITÉ</span><h3>{role === "admin" ? "Indicateurs de la plateforme" : "Les performances de votre boutique"}</h3><p>Les données reflètent les événements et commandes enregistrés pendant la période.</p></div><label className="analytics-period">Période<select value={period} onChange={event => setPeriod(event.target.value as Period)}>{periodOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
      <div className="analytics-filters">
        {role === "admin" && <>
          <label>Boutique<select value={sellerId} onChange={event => { setSellerId(event.target.value); setProductId(""); }}><option value="">Toutes les boutiques</option>{report.filterOptions?.sellers.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label>Statut commande<select value={status} onChange={event => setStatus(event.target.value)}><option value="">Tous les statuts</option>{report.filterOptions?.statuses.map(item => <option value={item} key={item}>{statusLabel[item] ?? item}</option>)}</select></label>
          <label>Paiement<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}><option value="">Tous les moyens</option>{report.filterOptions?.paymentMethods.map(item => <option value={item} key={item}>{item}</option>)}</select></label>
          <label>Ville<select value={city} onChange={event => setCity(event.target.value)}><option value="">Toutes les villes</option>{report.filterOptions?.cities.map(item => <option value={item} key={item}>{item}</option>)}</select></label>
        </>}
        <label>Produit<select value={productId} onChange={event => setProductId(event.target.value)}><option value="">Tous les produits</option>{productOptions.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      </div>
      {role === "admin" && <p className="analytics-filter-note">Les filtres statut, moyen de paiement et ville s'appliquent aux commandes. Les interactions sont filtrées par boutique et produit.</p>}
      <div className={role === "seller" ? "analytics-stat-grid analytics-stat-grid-seller" : "analytics-stat-grid"}>{cards.map(card => <article className="analytics-stat" key={card.label}><span className="analytics-stat-icon"><card.icon size={17}/></span><span>{card.label}</span><strong>{card.value}</strong><small>{card.hint}</small></article>)}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {role === "admin" && report.platform && <div className="analytics-platform-note">Période : {numberFormat.format(report.platform.usersCreatedInPeriod)} nouveaux comptes · Catalogue : {numberFormat.format(report.platform.products)} produits · Vendeurs approuvés : {numberFormat.format(report.platform.sellers.APPROVED ?? 0)}</div>}
      <p className="analytics-caveat">Les paiements sandbox GeniusPay ne sont pas comptés comme chiffre d'affaires réel. Les compteurs commencent à la mise en service de cette version.</p>
    </section>

    <div className="analytics-tabs" role="group" aria-label="Vues des statistiques">
      {([
        ["overview", "Vue d'ensemble"], ["sales", "Ventes"], ["products", "Produits"], ["orders", "Commandes"], ["payments", "Paiements"],
      ] as [AnalyticsView, string][]).map(([view, label]) => <button key={view} type="button" className="analytics-tab" aria-pressed={activeView === view} onClick={() => setActiveView(view)}>{label}</button>)}
    </div>

    {activeView === "overview" && <section className="analytics-view" aria-label="Vue d'ensemble des statistiques">
      <ActivityFunnel role={role} totals={report.totals}/>
      <div className="analytics-chart-grid analytics-chart-grid-single"><ChartPanel title="Trafic et intérêt" description="Visites, consultations et intentions" data={report.series} lines={activitySeries} format={value => numberFormat.format(value)}/></div>
    </section>}

    {activeView === "sales" && <section className="analytics-view" aria-label="Statistiques des ventes">
      <div className="analytics-detail-grid"><div className="analytics-chart-grid analytics-chart-grid-single"><ChartPanel title="Ventes payées" description="Revenu confirmé en FCFA" data={report.series} lines={[{ key: "revenue", label: "Revenu payé", color: "#56847a" }]} format={value => formatPrice(value)}/></div>
        <section className="workspace-panel analytics-list-panel"><div className="workspace-panel-heading"><div><span className="eyebrow">VENTES</span><h3>Meilleures ventes payées</h3></div></div>{report.topSold.length ? <ol className="analytics-ranking">{report.topSold.map(item => <li key={item.id}><span>{item.name}</span><small>{numberFormat.format(item.units ?? 0)} article(s) · {formatPrice(item.revenue ?? 0)}</small></li>)}</ol> : <p className="analytics-empty">Aucune vente payée réelle enregistrée sur cette période.</p>}</section>
      </div>
    </section>}

    {activeView === "products" && <section className="analytics-view" aria-label="Statistiques des produits">
      <section className="workspace-panel analytics-list-panel analytics-product-panel"><div className="workspace-panel-heading"><div><span className="eyebrow">PRODUITS</span><h3>Performance par produit</h3><p>Top 5 consultés et top 5 vendus, avec les interactions associées.</p></div></div>{report.productPerformance.length ? <div className="analytics-product-table-scroll"><table className="analytics-product-table"><thead><tr><th scope="col">Produit</th><th scope="col">Vues</th><th scope="col">Panier</th><th scope="col">Favoris</th><th scope="col">Ventes</th><th scope="col">Chiffre payé</th><th scope="col">Note</th></tr></thead><tbody>{report.productPerformance.map(item => <tr key={item.id}><th scope="row">{item.name}</th><td>{numberFormat.format(item.views ?? 0)}</td><td>{numberFormat.format(item.cartAdds ?? 0)}</td><td>{numberFormat.format(item.favorites ?? 0)}</td><td>{numberFormat.format(item.units ?? 0)}</td><td>{formatPrice(item.revenue ?? 0)}</td><td>{item.reviews ? <>{(item.rating ?? 0).toFixed(1)} / 5 <small>{numberFormat.format(item.reviews)} avis</small></> : "—"}</td></tr>)}</tbody></table></div> : <p className="analytics-empty">Aucune interaction ou vente enregistrée sur cette période.</p>}</section>
    </section>}

    {activeView === "orders" && <section className="analytics-view" aria-label="Statistiques des commandes">
      <div className="analytics-detail-grid"><div className="analytics-chart-grid analytics-chart-grid-single"><ChartPanel title="Commandes" description="Commandes créées pendant la période" data={report.series} lines={[{ key: "orders", label: "Commandes", color: "#6b5685" }]} format={value => numberFormat.format(value)}/></div>
        <section className="workspace-panel analytics-list-panel"><div className="workspace-panel-heading"><div><span className="eyebrow">COMMANDES</span><h3>Répartition par statut</h3></div></div><StatusList rows={report.orderStatuses}/></section>
      </div>
    </section>}

    {activeView === "payments" && <section className="analytics-view" aria-label="Statistiques des paiements">
      <div className="analytics-detail-grid"><section className="workspace-panel analytics-list-panel"><div className="workspace-panel-heading"><div><span className="eyebrow">PAIEMENTS</span><h3>Tentatives de paiement</h3></div></div><StatusList rows={report.paymentStatuses}/><p className="analytics-caveat">Les paiements réussis peuvent être des paiements de test.</p></section></div>
    </section>}
  </div>;
}

function ChartPanel({ title, description, data, lines, format }: {
  title: string;
  description: string;
  data: SeriesPoint[];
  lines: { key: keyof SeriesPoint; label: string; color: string }[];
  format: (value: number) => string;
}) {
  const [selected, setSelected] = useState<{ label: string; name: string; value: number } | null>(null);
  const width = 640;
  const height = 190;
  const chartLeft = 35;
  const chartRight = width - 12;
  const chartTop = 14;
  const chartBottom = height - 27;
  const max = Math.max(1, ...data.flatMap(point => lines.map(line => Number(point[line.key]) || 0)));
  const x = (index: number) => data.length < 2 ? width / 2 : chartLeft + (index * (chartRight - chartLeft)) / (data.length - 1);
  const y = (value: number) => chartBottom - (value / max) * (chartBottom - chartTop);

  return <section className="workspace-panel analytics-chart-panel"><div className="workspace-panel-heading"><div><span className="eyebrow">TENDANCE</span><h3>{title}</h3><p>{description}</p></div></div><div className="analytics-legend">{lines.map(line => <span key={line.key}><i style={{ background: line.color }}/>{line.label}</span>)}</div><div className="analytics-chart-scroll"><svg className="analytics-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${title}, évolution sur la période`}>
    {[0, 0.5, 1].map(fraction => <line key={fraction} x1={chartLeft} x2={chartRight} y1={chartTop + fraction * (chartBottom - chartTop)} y2={chartTop + fraction * (chartBottom - chartTop)} className="analytics-gridline"/>)}
    {lines.map(line => {
      const values = data.map(point => Number(point[line.key]) || 0);
      const coordinates = values.map((value, index) => `${index ? "L" : "M"}${x(index)},${y(value)}`).join(" ");
      return <g key={line.key}><path d={coordinates} fill="none" stroke={line.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{values.map((value, index) => <circle key={`${line.key}-${data[index].key}`} cx={x(index)} cy={y(value)} r="5" fill={line.color} tabIndex={0} role="button" aria-label={`${line.label}, ${data[index].label} : ${format(value)}`} onClick={() => setSelected({ label: data[index].label, name: line.label, value })} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") setSelected({ label: data[index].label, name: line.label, value }); }}><title>{`${data[index].label} · ${line.label} : ${format(value)}`}</title></circle>)}</g>;
    })}
    {data.filter((_, index) => index === 0 || index === data.length - 1 || (data.length > 5 && index % Math.ceil(data.length / 5) === 0)).map(point => {
      const index = data.findIndex(candidate => candidate.key === point.key);
      return <text key={point.key} x={x(index)} y={height - 6} textAnchor="middle" className="analytics-axis-label">{point.label}</text>;
    })}
  </svg></div><div className="analytics-chart-selection" aria-live="polite">{selected ? <><strong>{selected.label}</strong><span>{selected.name} : {format(selected.value)}</span></> : <span>Sélectionnez un point pour afficher sa valeur.</span>}</div></section>;
}

function StatusList({ rows }: { rows: Record<string, number> }) {
  const entries = Object.entries(rows);
  return entries.length ? <ul className="analytics-status-list">{entries.map(([status, count]) => <li key={status}><span>{statusLabel[status] ?? status}</span><strong>{numberFormat.format(count)}</strong></li>)}</ul> : <p className="analytics-empty">Aucun statut à afficher pour cette période.</p>;
}

function ActivityFunnel({ role, totals }: { role: "admin" | "seller"; totals: Report["totals"] }) {
  const stages = [
    { label: role === "admin" ? "Visites du site" : "Visites boutique", value: role === "admin" ? totals.visits : totals.storeViews },
    { label: "Vues produits", value: totals.productViews },
    { label: "Ajouts au panier", value: totals.cartAdds },
    { label: "Commandes", value: totals.orders },
  ];
  const max = Math.max(1, ...stages.map(stage => stage.value));
  return <section className="analytics-funnel" aria-label="Progression des volumes d'activité"><div><span className="eyebrow">PARCOURS</span><h4>Progression des volumes</h4></div><div className="analytics-funnel-stages">{stages.map((stage, index) => {
    const previous = stages[index - 1]?.value ?? 0;
    const ratio = previous > 0 ? Math.round((stage.value / previous) * 100) : null;
    return <div className="analytics-funnel-stage" key={stage.label}><div><span>{stage.label}</span><strong>{numberFormat.format(stage.value)}</strong></div><div className="analytics-funnel-track"><i style={{ width: `${Math.max(stage.value ? 3 : 0, (stage.value / max) * 100)}%` }}/></div><small>{index === 0 ? "Volume de départ" : ratio === null ? "Pas de volume précédent" : `${ratio}% du volume précédent`}</small></div>;
  })}</div><p>Les rapports comparent des compteurs agrégés ; ils ne suivent pas le parcours d'une personne.</p></section>;
}
