import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowDownWideNarrow, Search, SlidersHorizontal, X } from "lucide-react";
import { ApiCategory, ApiProduct, apiRequest, mapApiProduct } from "../data/api";
import type { Product } from "../data/products";
import ProductCard from "../components/ProductCard";

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [category, setCategory] = useState(params.get("categorie") || "Toutes");
  const [maxPrice, setMaxPrice] = useState("all");
  const [minRating, setMinRating] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState(params.get("sort") || "popular");
  const [mobileFilters, setMobileFilters] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<ApiProduct[]>("/products"),
      apiRequest<ApiCategory[]>("/categories"),
    ]).then(([items, categoryItems]) => {
      if (!active) return;
      setProducts(items.map(mapApiProduct));
      setCategories(categoryItems);
      setLoadError("");
    }).catch(reason => {
      if (active) setLoadError(reason instanceof Error ? reason.message : "Impossible de charger le catalogue.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setQuery(params.get("q") || "");
    setCategory(params.get("categorie") || "Toutes");
    setSort(params.get("sort") || "popular");
  }, [params]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    const result = products.filter(product => {
      const matchesQuery = !needle || `${product.name} ${product.category} ${product.parentCategory ?? ""} ${product.seller} ${product.description}`.toLocaleLowerCase("fr").includes(needle);
      const matchesCategory = category === "Toutes" || product.category === category || product.parentCategory === category;
      const matchesPrice = maxPrice === "all" || product.price <= Number(maxPrice);
      const matchesRating = !minRating || product.rating >= 4.7;
      const matchesStock = !availableOnly || product.stock > 0;
      return matchesQuery && matchesCategory && matchesPrice && matchesRating && matchesStock;
    });
    if (sort === "price-up") return result.sort((a, b) => a.price - b.price);
    if (sort === "price-down") return result.sort((a, b) => b.price - a.price);
    if (sort === "rating") return result.sort((a, b) => b.rating - a.rating);
    if (sort === "recent") return result.reverse();
    return result;
  }, [products, query, category, maxPrice, minRating, availableOnly, sort]);

  function chooseCategory(value: string) {
    setCategory(value);
    const next = new URLSearchParams(params);
    if (value === "Toutes") next.delete("categorie"); else next.set("categorie", value);
    setParams(next, { replace: true });
  }

  function clearFilters() {
    setQuery(""); setCategory("Toutes"); setMaxPrice("all"); setMinRating(false); setAvailableOnly(false);
    setParams({}, { replace: true });
  }

  const categoryOptions = categories
    .filter(item => !item.parentId)
    .flatMap(parent => [parent, ...categories.filter(item => item.parentId === parent.id)]);

  const filters = <>
    <div className="filter-group"><h3>Catégories</h3><button className={`filter-option ${category === "Toutes" ? "selected" : ""}`} onClick={() => chooseCategory("Toutes")}>Toutes les catégories <span>{products.length}</span></button>{categoryOptions.map(item => <button key={item.id} className={`filter-option ${item.parentId ? "filter-option-child" : ""} ${category === item.name ? "selected" : ""}`} onClick={() => chooseCategory(item.name)}>{item.parentId && <span aria-hidden="true">↳ </span>}{item.name}<span>{products.filter(product => product.category === item.name || (!item.parentId && product.parentCategory === item.name)).length}</span></button>)}</div>
    <div className="filter-group"><h3>Budget maximum</h3><select value={maxPrice} onChange={event => setMaxPrice(event.target.value)} aria-label="Budget maximum"><option value="all">Tous les prix</option><option value="15000">Moins de 15 000 FCFA</option><option value="25000">Moins de 25 000 FCFA</option><option value="40000">Moins de 40 000 FCFA</option></select></div>
    <div className="filter-group filter-toggles"><label><input type="checkbox" checked={minRating} onChange={event => setMinRating(event.target.checked)}/><span>Très bien notés <small>4,7 ★ et plus</small></span></label><label><input type="checkbox" checked={availableOnly} onChange={event => setAvailableOnly(event.target.checked)}/><span>En stock <small>Disponibles maintenant</small></span></label></div>
  </>;

  return <section className="catalog-page"><div className="catalog-intro"><div className="page-container"><div className="breadcrumb"><Link to="/">Accueil</Link><span>/</span><span>Le catalogue</span></div><span className="eyebrow">VOTRE PROCHAINE TROUVAILLE EST PEUT-ÊTRE ICI</span><h1>Le catalogue <em>FATA.</em></h1><p>Des pièces choisies avec attention, proposées par des boutiques qui ont une histoire.</p><form className="catalog-search" onSubmit={event => event.preventDefault()}><Search size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Que cherchez-vous aujourd'hui ?" aria-label="Rechercher un produit"/>{query && <button type="button" onClick={() => setQuery("")} aria-label="Effacer la recherche"><X size={17}/></button>}</form></div></div>
    <div className="page-container catalog-body">
      <aside className="catalog-filters">{filters}<button className="clear-filter" onClick={clearFilters}>Effacer tous les filtres</button></aside>
      {mobileFilters && <div className="filter-drawer-backdrop" onClick={() => setMobileFilters(false)}><aside className="filter-drawer" onClick={event => event.stopPropagation()}><div className="drawer-heading"><h2>Filtres</h2><button onClick={() => setMobileFilters(false)} aria-label="Fermer"><X/></button></div>{filters}<button className="button button-dark" onClick={() => setMobileFilters(false)}>Voir {filtered.length} résultat{filtered.length > 1 ? "s" : ""}</button></aside></div>}
      <div className="catalog-results"><div className="catalog-toolbar"><div><strong>{filtered.length}</strong> article{filtered.length > 1 ? "s" : ""}{query && <span> pour « {query} »</span>}</div><div className="catalog-sort"><button className="mobile-filter-button" onClick={() => setMobileFilters(true)}><SlidersHorizontal size={16}/> Filtres</button><label><ArrowDownWideNarrow size={16}/><span>Trier par</span><select value={sort} onChange={event => setSort(event.target.value)} aria-label="Trier les résultats"><option value="popular">Notre sélection</option><option value="recent">Nouveautés</option><option value="price-up">Prix croissant</option><option value="price-down">Prix décroissant</option><option value="rating">Mieux notés</option></select></label></div></div>
        {loading ? <div className="catalog-empty" aria-busy="true"><p>Chargement du catalogue…</p></div> : loadError ? <div className="catalog-empty" role="alert"><h2>Catalogue indisponible</h2><p>{loadError}</p><button className="button button-outline" onClick={() => window.location.reload()}>Réessayer</button></div> : filtered.length ? <div className="product-grid">{filtered.map(product => <ProductCard key={product.id} product={product}/>)}</div> : <div className="catalog-empty"><span>✳</span><h2>Pas encore de trouvailles</h2><p>Essayez un autre mot ou retirez quelques filtres pour élargir votre recherche.</p><button className="button button-outline" onClick={clearFilters}>Effacer les filtres</button></div>}
      </div>
    </div>
  </section>;
}
