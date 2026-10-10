import { useState } from "react";
import { Heart, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import type { Product } from "../data/products";
import { useCart } from "../context/CartContext";
import { formatPrice } from "../data/orders";
import { readFavoriteIds, toggleFavoriteId } from "../data/favorites";

export default function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const [favorite, setFavorite] = useState(() => readFavoriteIds().includes(product.id));

  function toggleFavorite() {
    setFavorite(toggleFavoriteId(product.id, favorite));
  }

  return <article className="product-card">
    <div className="product-card-image">
      <Link to={`/produit/${product.id}`} tabIndex={-1} aria-hidden="true"><img src={product.image} alt="" loading="lazy"/></Link>
      {product.badge && <span className="product-badge">{product.badge}</span>}
      <button className={`favorite-button ${favorite ? "is-favorite" : ""}`} onClick={toggleFavorite} aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"} aria-pressed={favorite}><Heart size={18} fill={favorite ? "currentColor" : "none"}/></button>
      <button className="quick-add" onClick={() => addToCart(product)} aria-label={product.stock > 0 ? `Ajouter ${product.name} au panier` : `${product.name} est en rupture de stock`} disabled={product.stock < 1}><Plus size={19}/></button>
    </div>
    <div className="product-card-copy">
      <div className="product-meta"><span>{product.parentCategory ? `${product.parentCategory} · ${product.category}` : product.category}</span><span className="product-rating">{product.reviews > 0 ? `★ ${product.rating.toFixed(1)} (${product.reviews})` : "Aucun avis"}</span></div>
      <Link to={`/produit/${product.id}`} className="product-name">{product.name}</Link>
      <Link className="product-maker" to={`/boutique/${product.storeId}`}>par {product.seller}</Link>
      <div className="product-price-line"><strong>{formatPrice(product.price)}</strong>{product.originalPrice && <del>{formatPrice(product.originalPrice)}</del>}</div>
    </div>
  </article>;
}
