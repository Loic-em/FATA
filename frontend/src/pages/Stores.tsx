import { useEffect, useMemo, useState } from "react";
import { ArrowRight, MapPin, Search, Store as StoreIcon } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { ApiProduct, ApiStore, apiRequest, mapApiProduct, mapApiStore } from "../data/api";
import type { Product } from "../data/products";
import ProductCard from "../components/ProductCard";
import { trackAnalyticsEvent } from "../data/analytics";

export function StoreDirectory() {
  const [query, setQuery] = useState("");
  const [stores, setStores] = useState<ReturnType<typeof mapApiStore>[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    apiRequest<ApiStore[]>("/stores")
      .then(items => { if (active) setStores(items.map(mapApiStore)); })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Impossible de charger les boutiques."); });
    return () => { active = false; };
  }, []);
  const filtered = useMemo(() => stores.filter(store => `${store.name} ${store.category} ${store.city}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <section className="store-directory-page"><div className="store-directory-hero"><div className="page-container"><div className="breadcrumb"><Link to="/">Accueil</Link><span>/</span><span>Nos boutiques</span></div><span className="eyebrow">DE BELLES RENCONTRES, AVANT TOUT</span><h1>Les boutiques<br/><em>ont une histoire.</em></h1><p>Rencontrez les personnes derrière les produits que vous aimez.</p><form className="catalog-search" onSubmit={event => event.preventDefault()}><Search size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Chercher une boutique ou un univers…"/></form></div></div><div className="page-container store-directory-body"><div className="section-heading"><div><span className="eyebrow">NOS BOUTIQUES PARTENAIRES</span><h2>{filtered.length} univers à explorer</h2></div></div>{error ? <div className="catalog-empty" role="alert"><h2>Boutiques indisponibles</h2><p>{error}</p></div> : filtered.length ? <div className="store-directory-grid">{filtered.map((store, index) => <Link className="directory-store-card" to={`/boutique/${store.id}`} key={store.id}><div className="directory-store-image"><img src={store.image} alt="" loading="lazy"/><span>0{index + 1}</span><div className="directory-store-badge"><StoreIcon size={16}/></div></div><div className="directory-store-content"><span className="eyebrow">{store.category}</span><h3>{store.name}</h3><p>{store.description}</p><div><span><MapPin size={14}/>{store.city}, Côte d'Ivoire</span><strong>Découvrir <ArrowRight size={14}/></strong></div></div></Link>)}</div> : <div className="catalog-empty"><span>✳</span><h2>Aucune boutique pour cette recherche</h2><p>Essayez un autre nom ou un autre univers.</p><button className="button button-outline" onClick={() => setQuery("")}>Effacer la recherche</button></div>}</div></section>;
}

export function StoreDetail() {
  const { id } = useParams();
  const [store, setStore] = useState<ReturnType<typeof mapApiStore> | null>(null);
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    if (!id) return;
    apiRequest<ApiStore & { products: ApiProduct[] }>(`/stores/${encodeURIComponent(id)}`)
      .then(result => {
        if (!active) return;
        setStore(mapApiStore(result));
        trackAnalyticsEvent("STORE_VIEW", result.id);
        setStoreProducts(result.products.map(mapApiProduct));
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Boutique introuvable."); });
    return () => { active = false; };
  }, [id]);
  if (error) return <div className="empty-page" role="alert"><span className="eyebrow">CETTE BOUTIQUE N'EST PAS DISPONIBLE</span><h1>On cherche encore.</h1><p>{error}</p><Link className="button button-dark" to="/boutiques">Voir les boutiques <ArrowRight size={16}/></Link></div>;
  if (!store) return <div className="empty-page" aria-busy="true">Chargement de la boutique…</div>;
  return <><section className="store-detail-hero"><img src={store.image} alt=""/><div className="store-detail-overlay"/><div className="page-container store-detail-content"><div className="breadcrumb breadcrumb-light"><Link to="/">Accueil</Link><span>/</span><Link to="/boutiques">Boutiques</Link><span>/</span><span>{store.name}</span></div><span className="eyebrow">{store.category.toUpperCase()} · {store.city.toUpperCase()}</span><h1>{store.name}<span>.</span></h1><p>{store.description}</p><span className="store-curation"><StoreIcon size={15}/> Une boutique mise en avant par FATA</span></div></section><section className="store-detail-about"><div className="page-container store-about-layout"><span className="eyebrow">LE MOT DE LA BOUTIQUE</span><p>{store.description} <span>Installée à {store.city}, elle vous propose une sélection à découvrir et à partager.</span></p><Link to="/boutiques" className="text-link"><ArrowRight size={15}/> Toutes les boutiques</Link></div></section><section className="home-section"><div className="page-container"><div className="section-heading"><div><span className="eyebrow">L'UNIVERS {store.name.toUpperCase()}</span><h2>Sa sélection FATA</h2></div><span className="product-count-note">{storeProducts.length} articles</span></div>{storeProducts.length ? <div className="product-grid">{storeProducts.map(product => <ProductCard key={product.id} product={product}/>)}</div> : <div className="catalog-empty"><p>Cette boutique prépare ses premières trouvailles.</p></div>}</div></section></>;
}

export default StoreDirectory;
