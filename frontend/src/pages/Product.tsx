import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Heart, MessageCircle, Minus, Plus, ShieldCheck, ShoppingBag, Truck } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiProduct, apiRequest, mapApiProduct } from "../data/api";
import type { Product as ProductData } from "../data/products";
import { formatPrice } from "../data/orders";
import { useCart } from "../context/CartContext";
import ProductCard from "../components/ProductCard";
import { useAuth } from "../context/AuthContext";
import { readFavoriteIds, toggleFavoriteId } from "../data/favorites";
import { trackAnalyticsEvent } from "../data/analytics";

type VerifiedReview = {
  id: string;
  rating: number;
  body: string | null;
  createdAt: string;
  reviewer: string;
  verifiedPurchase: true;
};
type EligiblePurchase = { orderItemId: string; orderId: string; orderDate: string; quantity: number };
type ReviewEligibility = { eligiblePurchases: EligiblePurchase[]; reviewedPurchaseCount: number };

export default function Product() {
  const { id } = useParams();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [reviews, setReviews] = useState<VerifiedReview[]>([]);
  const [eligiblePurchases, setEligiblePurchases] = useState<EligiblePurchase[]>([]);
  const [reviewedPurchaseCount, setReviewedPurchaseCount] = useState(0);
  const [reviewOrderItemId, setReviewOrderItemId] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewBody, setReviewBody] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");
  const [loadError, setLoadError] = useState("");
  const { user, loading: authLoading } = useAuth();
  useEffect(() => {
    let active = true;
    if (!id) return;
    setReviewError("");
    setReviewSuccess("");
    Promise.all([
      apiRequest<ApiProduct>(`/products/${encodeURIComponent(id)}`),
      apiRequest<ApiProduct[]>("/products"),
    ]).then(async ([item, allItems]) => {
      let reviewItems: VerifiedReview[] = [];
      try {
        reviewItems = await apiRequest<VerifiedReview[]>(`/products/${encodeURIComponent(id)}/reviews`);
      } catch {
        if (active) setReviewError("Les avis vérifiés ne sont pas disponibles pour le moment.");
      }
      if (!active) return;
      setProduct(mapApiProduct(item));
      trackAnalyticsEvent("PRODUCT_VIEW", item.id);
      setProducts(allItems.map(mapApiProduct));
      setReviews(reviewItems);
      setLoadError("");
    }).catch(reason => {
      if (active) setLoadError(reason instanceof Error ? reason.message : "Impossible de charger ce produit.");
    });
    return () => { active = false; };
  }, [id]);
  useEffect(() => {
    let active = true;
    setEligiblePurchases([]);
    setReviewedPurchaseCount(0);
    setReviewOrderItemId("");
    setReviewError("");
    if (!id || user?.role !== "client") return () => { active = false; };
    apiRequest<ReviewEligibility>(`/products/${encodeURIComponent(id)}/reviews/eligibility`)
      .then(result => {
        if (!active) return;
        setEligiblePurchases(result.eligiblePurchases);
        setReviewedPurchaseCount(result.reviewedPurchaseCount);
        setReviewOrderItemId(result.eligiblePurchases[0]?.orderItemId ?? "");
      })
      .catch(reason => { if (active) setReviewError(reason instanceof Error ? reason.message : "Impossible de vérifier vos achats."); });
    return () => { active = false; };
  }, [id, user?.id, user?.role]);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [favorite, setFavorite] = useState(() => readFavoriteIds().includes(id || ""));
  useEffect(() => { setFavorite(readFavoriteIds().includes(id || "")); }, [id]);
  const { addToCart } = useCart();
  const navigate = useNavigate();

  if (loadError) return <div className="empty-page" role="alert"><span className="eyebrow">OUPS, CETTE PAGE A DÉMÉNAGÉ</span><h1>Produit indisponible</h1><p>{loadError}</p><Link className="button button-dark" to="/catalogue">Retour au catalogue</Link></div>;
  if (!product) return <div className="empty-page" aria-busy="true">Chargement du produit…</div>;

  const similar = products.filter(item => item.id !== product.id && (
    item.category === product.category ||
    (product.parentCategory && item.parentCategory === product.parentCategory) ||
    item.storeId === product.storeId
  )).slice(0, 4);

  function add() {
    addToCart(product!, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 2200);
  }

  function buyNow() {
    addToCart(product!, quantity);
    navigate("/commande");
  }

  function contactSeller() {
    const destination = `/espace/client?tab=messages&product=${encodeURIComponent(product!.id)}`;
    navigate(user ? destination : `/client/connexion?return=${encodeURIComponent(destination)}`);
  }

  function toggleFavorite() {
    setFavorite(toggleFavoriteId(product!.id, favorite));
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !reviewOrderItemId) return;
    setReviewSaving(true);
    setReviewError("");
    setReviewSuccess("");
    try {
      const result = await apiRequest<VerifiedReview & { productRating: number; productReviewCount: number }>(
        `/products/${encodeURIComponent(id)}/reviews`,
        {
          method: "POST",
          body: JSON.stringify({ orderItemId: reviewOrderItemId, rating: reviewRating, body: reviewBody }),
        },
      );
      setReviews(current => [result, ...current]);
      setProduct(current => current ? { ...current, rating: result.productRating, reviews: result.productReviewCount } : current);
      setEligiblePurchases(current => current.filter(purchase => purchase.orderItemId !== reviewOrderItemId));
      setReviewedPurchaseCount(count => count + 1);
      setReviewOrderItemId(eligiblePurchases.find(purchase => purchase.orderItemId !== reviewOrderItemId)?.orderItemId ?? "");
      setReviewBody("");
      setReviewSuccess("Merci. Votre avis est publié avec la mention achat vérifié.");
    } catch (reason) {
      setReviewError(reason instanceof Error ? reason.message : "Impossible d'enregistrer cet avis.");
    } finally {
      setReviewSaving(false);
    }
  }

  return <>
    <section className="product-page"><div className="page-container"><div className="breadcrumb"><Link to="/">Accueil</Link><span>/</span><Link to="/catalogue">Catalogue</Link><span>/</span><span>{product.name}</span></div><Link className="back-to-catalog" to="/catalogue"><ArrowLeft size={15}/> Continuer mes découvertes</Link>
      <div className="product-detail-layout"><div className="product-gallery"><div className="product-main-image"><img src={product.image} alt={product.name}/><span className="gallery-label">SÉLECTION FATA</span></div><div className="product-gallery-note"><span>01 / 01</span><span>Une belle trouvaille, sélectionnée pour vous.</span></div></div>
        <div className="product-detail-copy"><div className="detail-topline"><span className="eyebrow">{product.parentCategory ? `${product.parentCategory} · ${product.category}`.toUpperCase() : product.category.toUpperCase()}</span>{product.reviews > 0 ? <span className="detail-rating">★ {product.rating.toFixed(1)} <small>({product.reviews} avis vérifiés)</small></span> : <span className="detail-rating detail-rating-empty">Pas encore d'avis vérifié</span>}</div><h1>{product.name}</h1><Link className="detail-maker" to={`/boutique/${product.storeId}`}>Imaginé par <strong>{product.seller}</strong><ArrowRight size={15}/></Link><div className="detail-price">{formatPrice(product.price)}{product.originalPrice && <del>{formatPrice(product.originalPrice)}</del>}</div><p className="detail-description">{product.description}</p>
          <div className={`detail-availability ${product.stock < 1 ? "out-of-stock" : ""}`}><span className="status-dot"/> {product.stock < 1 ? "Rupture de stock" : product.stock < 10 ? `Plus que ${product.stock} en stock` : "En stock · prêt à rejoindre votre panier"}</div>
          <div className="detail-actions"><div className="quantity-control"><button disabled={product.stock < 1 || quantity <= 1} onClick={() => setQuantity(Math.max(1, quantity - 1))} aria-label="Diminuer la quantité"><Minus size={15}/></button><span>{product.stock > 0 ? quantity : "—"}</span><button disabled={product.stock < 1 || quantity >= product.stock} onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} aria-label="Augmenter la quantité"><Plus size={15}/></button></div><button className="button button-dark add-to-basket" onClick={add} disabled={product.stock < 1}>{added ? <><Check size={17}/> Ajouté au panier</> : <><ShoppingBag size={17}/> Ajouter au panier</>}</button><button className={`detail-favorite ${favorite ? "is-favorite" : ""}`} aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"} aria-pressed={favorite} onClick={toggleFavorite}><Heart size={19} fill={favorite ? "currentColor" : "none"}/></button></div>
          <button className="button button-soft buy-now" onClick={buyNow} disabled={product.stock < 1}>Acheter maintenant <ArrowRight size={16}/></button>
          {user?.role !== "vendeur" && user?.role !== "admin" && <button className="button button-outline contact-seller-button" onClick={contactSeller}><MessageCircle size={16}/> Contacter le vendeur</button>}
          <div className="product-assurances"><div><Truck size={17}/><span><strong>Livraison par la boutique</strong><small>Modalités confirmées après l'achat</small></span></div><div><ShieldCheck size={17}/><span><strong>Achat en confiance</strong><small>Assistance FATA à chaque étape</small></span></div></div>
          <div className="seller-product-card"><div className="seller-avatar">{product.seller.slice(0, 1)}</div><div><small>VOTRE BOUTIQUE</small><strong>{product.seller}</strong><span>Boutique sélectionnée par FATA</span></div><Link to={`/boutique/${product.storeId}`} aria-label={`Découvrir ${product.seller}`}><ArrowRight size={18}/></Link></div>
        </div>
      </div>
    </div></section>
    <section className="product-reviews-section" aria-labelledby="product-reviews-title"><div className="page-container">
      <div className="product-reviews-heading"><div><span className="eyebrow">VÉRIFIÉS APRÈS ACHAT</span><h2 id="product-reviews-title">Avis des clients</h2><p>{product.reviews > 0 ? `${product.reviews} avis vérifiés · note moyenne ${product.rating.toFixed(1)} / 5` : "Aucun avis vérifié pour le moment."}</p></div></div>
      {reviewError && <p className="form-error" role="alert">{reviewError}</p>}
      {reviewSuccess && <p className="form-success" role="status">{reviewSuccess}</p>}
      {reviews.length ? <ol className="product-review-list">{reviews.map(review => <li className="product-review-card" key={review.id}>
        <div className="product-review-card-top"><strong>{review.reviewer}</strong><span className="verified-review-badge"><ShieldCheck size={13}/> Achat vérifié</span></div>
        <div className="product-review-rating"><span aria-label={`${review.rating} sur 5 étoiles`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span><time dateTime={review.createdAt}>{new Date(review.createdAt).toLocaleDateString("fr-FR")}</time></div>
        {review.body && <p>{review.body}</p>}
      </li>)}</ol> : <p className="product-reviews-empty">Les avis publiés ici sont liés à des achats dont le paiement a été confirmé.</p>}

      {user?.role === "client" && eligiblePurchases.length > 0 && <form className="product-review-form" onSubmit={submitReview}>
        <h3>Votre expérience compte</h3>
        <label>Commande<select value={reviewOrderItemId} onChange={event => setReviewOrderItemId(event.target.value)} required>{eligiblePurchases.map(purchase => <option key={purchase.orderItemId} value={purchase.orderItemId}>{new Date(purchase.orderDate).toLocaleDateString("fr-FR")} · {purchase.quantity} article(s)</option>)}</select></label>
        <fieldset className="review-rating-fieldset"><legend>Votre note</legend><div className="review-rating-options">{[1, 2, 3, 4, 5].map(value => <label key={value}><input type="radio" name="rating" value={value} aria-label={`${value} sur 5 étoiles`} checked={reviewRating === value} onChange={() => setReviewRating(value)}/><span aria-hidden="true">{value <= reviewRating ? "★" : "☆"}</span></label>)}</div></fieldset>
        <label>Votre avis <span className="review-optional">(facultatif)</span><textarea value={reviewBody} onChange={event => setReviewBody(event.target.value)} maxLength={500} rows={4} placeholder="Qu'avez-vous pensé de ce produit ?"/></label>
        <div className="product-review-form-footer"><small>{reviewBody.length}/500 · Pas de lien ni de coordonnées personnelles.</small><button className="button button-dark" type="submit" disabled={reviewSaving || !reviewOrderItemId}>{reviewSaving ? "Publication…" : "Publier mon avis"}</button></div>
      </form>}

      {user?.role === "client" && eligiblePurchases.length === 0 && !reviewError && <p className="review-gate-note">{reviewedPurchaseCount > 0 ? "Vous avez déjà laissé un avis pour vos achats payés de ce produit." : "Un avis vérifié est possible après le paiement réel d'une commande contenant ce produit. Les commandes sandbox ne sont pas admissibles."}</p>}
      {!user && !authLoading && <p className="review-gate-note"><Link to={`/client/connexion?return=${encodeURIComponent(`/produit/${product.id}`)}`}>Connectez-vous</Link> avec le compte ayant réglé la commande pour déposer un avis vérifié.</p>}
      {user && user.role !== "client" && <p className="review-gate-note">Les avis vérifiés sont réservés aux clients ayant acheté ce produit.</p>}
    </div></section>
    {similar.length > 0 && <section className="home-section similar-section"><div className="page-container"><div className="section-heading"><div><span className="eyebrow">SI VOUS AIMEZ CELUI-CI…</span><h2>Vous aimerez peut-être aussi</h2></div><Link className="text-link" to="/catalogue">Tout voir <ArrowRight size={16}/></Link></div><div className="product-grid">{similar.map(item => <ProductCard key={item.id} product={item}/>)}</div></div></section>}
  </>;
}
