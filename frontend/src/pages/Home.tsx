import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowRight, BadgeCheck, ChevronRight, Heart, Leaf, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { ApiCategory, ApiProduct, ApiStore, apiRequest, mapApiProduct, mapApiStore } from "../data/api";
import type { Product } from "../data/products";
import ProductCard from "../components/ProductCard";

type Store = ReturnType<typeof mapApiStore>;

export default function Home() {
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [contentError, setContentError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<ApiCategory[]>("/categories"),
      apiRequest<ApiProduct[]>("/products"),
      apiRequest<ApiStore[]>("/stores"),
    ]).then(([categoryItems, productItems, storeItems]) => {
      if (!active) return;
      setCategories(categoryItems);
      setProducts(productItems.map(mapApiProduct));
      setStores(storeItems.map(mapApiStore));
      setContentError("");
    }).catch(reason => {
      if (active) setContentError(reason instanceof Error ? reason.message : "Impossible de charger la sélection.");
    });
    return () => { active = false; };
  }, []);

  return <>
    <section className="hero-section">
      <div className="page-container hero-layout">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-line"/> UNE AUTRE FAÇON DE DÉCOUVRIR</span>
          <h1>Les belles<br/>choses sont<br/><em>juste ici.</em></h1>
          <p>FATA réunit des créateurs, des marques et des boutiques qui ont quelque chose à raconter. Trouvez votre prochain coup de cœur.</p>
          <div className="hero-ctas"><Link className="button button-dark" to="/catalogue">Explorer la sélection <ArrowRight size={17}/></Link><Link className="text-link" to="/boutiques">Rencontrer nos boutiques <ChevronRight size={16}/></Link></div>
          <div className="hero-proof"><div className="avatar-stack"><span>A</span><span>M</span><span>K</span><span>+</span></div><span>Des talents d'ici,<br/><strong>à découvrir sans attendre.</strong></span></div>
        </div>
        <div className="hero-art">
          <div className="hero-art-backdrop"/>
          <div className="hero-art-main"><img src="/fata-hero.jpg" alt="Trois mannequins présentent des tenues colorées inspirées de la mode africaine"/></div>
          <div className="hero-art-small"><img src="/fata-photo.jpg" alt="Photo partagée par FATA : un homme tient une pancarte « Never stop dreaming »"/></div>
          <div className="hero-caption"><span>01 / 04</span><span>LES RENCONTRES FATA</span><ArrowDownRight size={16}/></div>
        </div>
      </div>
      <div className="hero-bottom-line"><span>MADE OF HERE</span><span>✳</span><span>MADE FOR YOU</span><span>✳</span><span>MADE WITH CARE</span></div>
    </section>

    <section className="value-strip"><div className="page-container value-items"><div><BadgeCheck/><span><strong>Des boutiques choisies</strong><small>Une sélection qui a du sens</small></span></div><div><Truck/><span><strong>Livraison suivie</strong><small>Du vendeur jusqu'à chez vous</small></span></div><div><Heart/><span><strong>Des trouvailles uniques</strong><small>Pour offrir ou se faire plaisir</small></span></div><div><Leaf/><span><strong>Un commerce plus humain</strong><small>La proximité au premier plan</small></span></div></div></section>

    <section className="home-section category-section" id="categories"><div className="page-container"><div className="section-heading"><div><span className="eyebrow">FAITES AUJOURD'HUI UNE BELLE DÉCOUVERTE</span><h2>On commence par quoi ?</h2></div><Link className="text-link" to="/catalogue">Toutes les catégories <ArrowRight size={16}/></Link></div>{contentError && <p className="form-error" role="alert">{contentError}</p>}<div className="category-cards">{categories.filter(category => !category.parentId).map((category, index) => <Link className="category-tile" to={`/catalogue?categorie=${encodeURIComponent(category.name)}`} key={category.id}><img src={category.image || "/fata-photo.jpg"} alt="" loading="lazy"/><span className="category-index">0{index + 1}</span><span className="category-name">{category.name}<ArrowRight size={17}/></span></Link>)}</div></div></section>

    <section className="home-section featured-section"><div className="page-container"><div className="section-heading"><div><span className="eyebrow">NOS COUPS DE CŒUR DU MOMENT</span><h2>La sélection FATA</h2><p>Des pièces qu'on a envie de garder, d'offrir, de partager.</p></div><Link className="text-link" to="/catalogue">Voir toute la sélection <ArrowRight size={16}/></Link></div><div className="product-grid">{products.slice(0, 4).map(product => <ProductCard key={product.id} product={product}/>)}</div></div></section>

    <section className="maker-section"><div className="page-container maker-layout"><div className="maker-photos"><img className="maker-main-photo" src="/fata-photo.jpg" alt="Photo partagée par FATA : un homme tient une pancarte « Never stop dreaming »"/><img className="maker-inset-photo" src="/fata-photo.jpg" alt="Photo partagée par FATA : un homme tient une pancarte « Never stop dreaming »"/><span className="maker-scribble">✳</span></div><div className="maker-copy"><span className="eyebrow">DERRIÈRE CHAQUE BELLE TROUVAILLE</span><h2>Il y a une<br/><em>histoire.</em></h2><p>Une idée née autour d'une table. Des mains qui façonnent, assemblent et recommencent. Une boutique qui ouvre ses portes. Sur FATA, chaque achat vous rapproche des personnes qui créent.</p><Link className="button button-outline" to="/boutiques">Faire connaissance <ArrowRight size={17}/></Link><div className="maker-signature">FATA <span>✳</span> D'ICI, AVEC VOUS</div></div></div></section>

    <section className="home-section shop-section"><div className="page-container"><div className="section-heading"><div><span className="eyebrow">LES PERSONNES QUI FONT FATA</span><h2>Faites un tour chez elles.</h2></div><Link className="text-link" to="/boutiques">Toutes les boutiques <ArrowRight size={16}/></Link></div><div className="shop-cards">{stores.slice(0, 3).map((store, i) => <Link to={`/boutique/${store.id}`} className="shop-card" key={store.id}><div className="shop-card-image"><img src={store.image} alt="" loading="lazy"/><span>0{i + 1}</span></div><div className="shop-card-info"><div><small>{store.category}</small><h3>{store.name}</h3><span>{store.city} · Côte d'Ivoire</span></div><ArrowRight size={18}/></div></Link>)}</div></div></section>

    <section className="seller-cta"><div className="page-container seller-cta-layout"><div><span className="eyebrow">VOUS AVEZ QUELQUE CHOSE À PARTAGER ?</span><h2>Votre prochaine<br/><em>belle rencontre.</em></h2></div><div><p>Vous créez, sélectionnez ou vendez des produits qui vous ressemblent ? FATA vous aide à les faire découvrir.</p><Link className="button button-dark" to="/vendeur/inscription">Ouvrir ma boutique <ArrowRight size={17}/></Link></div></div></section>
  </>;
}
