import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Minus, Plus, RefreshCw, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { formatPrice } from "../data/orders";
import { ApiError, apiRequest, mapApiProduct, type ApiProduct } from "../data/api";

export default function Cart() {
  const { items, updateQuantity, removeFromCart, refreshProducts, totalPrice } = useCart();
  const [checking, setChecking] = useState(items.length > 0);
  const [checkError, setCheckError] = useState("");
  const [catalogNotice, setCatalogNotice] = useState("");

  async function checkAvailability() {
    if (!items.length) {
      setChecking(false);
      setCheckError("");
      return;
    }
    setChecking(true);
    setCheckError("");
    try {
      const ids = items.map(item => item.id).join(",");
      const currentProducts = await apiRequest<ApiProduct[]>(`/products?ids=${encodeURIComponent(ids)}`);
      const latestById = new Map(currentProducts.map(product => [product.id, product]));
      setCatalogNotice(items.some(item => {
        const latest = latestById.get(item.id);
        return latest && latest.stock > 0 && item.quantity > latest.stock;
      }) ? "Une quantité a été ajustée au stock actuellement disponible." : "");
      refreshProducts(currentProducts.map(mapApiProduct));
    } catch (reason) {
      setCheckError(reason instanceof ApiError ? reason.message : reason instanceof Error ? reason.message : "Impossible de vérifier le stock.");
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => { void checkAvailability(); }, []);

  if (!items.length) return <section className="cart-empty"><div className="empty-bag-icon"><ShoppingBag size={29}/></div><span className="eyebrow">VOTRE PANIER FATA</span><h1>Il est prêt pour<br/><em>de belles choses.</em></h1><p>Votre panier est encore vide. Prenez le temps de découvrir nos boutiques.</p><Link className="button button-dark" to="/catalogue">Découvrir les produits <ArrowRight size={17}/></Link></section>;

  return <section className="cart-page"><div className="page-container"><div className="breadcrumb"><Link to="/">Accueil</Link><span>/</span><span>Mon panier</span></div><div className="cart-page-heading"><div><span className="eyebrow">VOUS Y ÊTES PRESQUE</span><h1>Votre panier<span className="brand-period">.</span></h1><p>{items.reduce((sum, item) => sum + item.quantity, 0)} article{items.reduce((sum, item) => sum + item.quantity, 0) > 1 ? "s" : ""} attend{items.reduce((sum, item) => sum + item.quantity, 0) > 1 ? "ent" : ""} votre feu vert.</p></div><Link className="text-link" to="/catalogue"><ArrowLeft size={16}/> Continuer mes découvertes</Link></div>
    <div className="cart-layout"><div className="cart-item-list">{items.map(item => <article className="cart-line-item" key={item.id}><Link to={`/produit/${item.id}`} className="cart-item-image"><img src={item.image} alt={item.name}/></Link><div className="cart-item-description"><span>{item.category}</span><Link to={`/produit/${item.id}`}><h2>{item.name}</h2></Link><Link to={`/boutique/${item.storeId}`} className="cart-seller">par {item.seller}</Link>{item.stock < 1 && <small className="cart-stock-warning">Rupture de stock — retirez cet article pour continuer.</small>}{item.stock > 0 && item.quantity >= item.stock && <small className="cart-stock-warning">Stock maximum atteint : {item.stock}</small>}<button className="remove-item" onClick={() => removeFromCart(item.id)}><Trash2 size={14}/> Retirer</button></div><div className="cart-item-controls"><div className="quantity-control"><button onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label={`Retirer une unité de ${item.name}`}><Minus size={13}/></button><span>{item.quantity}</span><button disabled={item.stock < 1 || item.quantity >= item.stock} onClick={() => updateQuantity(item.id, item.quantity + 1)} aria-label={`Ajouter une unité de ${item.name}`}><Plus size={13}/></button></div><strong>{formatPrice(item.price * item.quantity)}</strong></div></article>)}</div>
      <aside className="cart-summary"><span className="eyebrow">EN UN COUP D'ŒIL</span><h2>Récapitulatif</h2><div className="summary-row"><span>Sous-total</span><strong>{formatPrice(totalPrice)}</strong></div><div className="summary-row summary-muted"><span>Livraison</span><span>Calculée à l'étape suivante</span></div><div className="summary-total"><span>Total provisoire</span><strong>{formatPrice(totalPrice)}</strong></div><p className="summary-fineprint">Les frais de livraison et le montant final vous seront présentés avant validation de votre commande.</p>{checking && <p className="cart-stock-warning" role="status">Vérification du stock et des prix…</p>}{checkError && <div className="cart-stock-warning" role="alert"><p>{checkError}</p><button type="button" onClick={() => void checkAvailability()} disabled={checking}><RefreshCw size={13}/> Réessayer</button></div>}{catalogNotice && <p className="cart-stock-warning" role="status">{catalogNotice}</p>}{items.some(item => item.stock < 1) && <p className="cart-stock-warning" role="alert">Un article n’est plus disponible. Retirez-le du panier pour continuer.</p>}<Link aria-disabled={checking || Boolean(checkError) || items.some(item => item.stock < 1)} className={`button button-dark checkout-link ${checking || checkError || items.some(item => item.stock < 1) ? "is-disabled" : ""}`} to="/commande" onClick={event => { if (checking || checkError || items.some(item => item.stock < 1)) event.preventDefault(); }}>{checking ? "Vérification…" : "Continuer ma commande"} <ArrowRight size={17}/></Link><div className="summary-trust">✳ &nbsp; Vos belles découvertes vous attendent</div></aside></div>
    </div></section>;
}
