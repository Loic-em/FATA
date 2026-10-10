import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Smartphone, Store } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { ApiError, apiRequest, type ApiOrder } from "../data/api";
import { formatPrice } from "../data/orders";

export default function Checkout() {
  const { user, loading: authLoading } = useAuth();
  const { items, totalPrice, clearCart } = useCart();
  const navigate = useNavigate();
  const [city, setCity] = useState("Abidjan");
  const [delivery, setDelivery] = useState("standard");
  const [deliveryFees, setDeliveryFees] = useState({ deliveryFeeAbidjan: 2000, deliveryFeeGrandBassam: 1000, deliveryFeeOther: 3500 });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const shipping = delivery === "pickup" ? 0 : city === "Abidjan" ? deliveryFees.deliveryFeeAbidjan : city === "Grand-Bassam" ? deliveryFees.deliveryFeeGrandBassam : deliveryFees.deliveryFeeOther;

  useEffect(() => {
    if (user?.defaultCity) setCity(user.defaultCity);
  }, [user?.defaultCity]);

  useEffect(() => {
    let active = true;
    apiRequest<typeof deliveryFees & { pickupFee: number; currency: string }>("/settings/public")
      .then(settings => { if (active) setDeliveryFees(settings); })
      .catch(() => { /* The API validates and applies its own configured fee. */ });
    return () => { active = false; };
  }, []);

  if (!items.length) return <section className="checkout-empty"><span className="eyebrow">COMMANDE FATA</span><h1>Votre panier attend<br/><em>quelque chose de beau.</em></h1><Link className="button button-dark" to="/catalogue">Revenir au catalogue <ArrowRight size={17}/></Link></section>;

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    setSubmitting(true);
    try {
      const order = await apiRequest<ApiOrder>("/orders", {
        method: "POST",
        body: JSON.stringify({
          phone: String(form.get("phone") || "").trim(),
          address: delivery === "pickup" ? "Retrait chez le vendeur" : String(form.get("address") || "").trim(),
          city,
          deliveryType: delivery === "pickup" ? "PICKUP" : "DELIVERY",
          instructions: String(form.get("instructions") || "").trim(),
          items: items.map(item => ({ productId: item.id, quantity: item.quantity })),
        }),
      });
      clearCart();
      navigate(`/confirmation/${encodeURIComponent(order.id)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d'enregistrer la commande.");
      if (reason instanceof ApiError && reason.status === 401) {
        setError("Connectez-vous pour enregistrer votre demande de commande.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="checkout-page"><div className="page-container"><div className="breadcrumb"><Link to="/">Accueil</Link><span>/</span><Link to="/panier">Panier</Link><span>/</span><span>Livraison</span></div><div className="checkout-heading"><span className="eyebrow">DERNIÈRE ÉTAPE</span><h1>On vous l'apporte ?</h1><p>Renseignez les informations de livraison avant de confirmer.</p><div className="checkout-steps"><span className="done"><Check size={14}/> Panier</span><i/><span className="current">02 &nbsp; Livraison</span><i/><span>03 &nbsp; Confirmation</span></div></div>
    {authLoading ? <div className="checkout-card" aria-busy="true">Vérification de votre session…</div> : !user ? <div className="checkout-card" role="status"><h2>Connectez-vous comme client pour commander</h2><p>L’espace client et l’espace vendeur utilisent des comptes séparés. Votre panier sera conservé pendant la connexion.</p><Link className="button button-dark" to="/client/connexion?return=%2Fcommande">Connexion client <ArrowRight size={16}/></Link><p className="auth-role-switch">Pas encore de compte client ? <Link to="/client/inscription?return=%2Fcommande">Créer un compte client</Link></p></div> : user.role !== "client" ? <div className="checkout-card" role="status"><h2>Cette commande est réservée à l’espace client</h2><p>Vous êtes connecté{user.role === "vendeur" ? " à l’espace vendeur" : " à l’administration"}. Pour commander, utilisez un compte client avec une adresse e-mail différente de celle de votre compte vendeur.</p><Link className="button button-dark" to="/client/connexion?return=%2Fcommande">Se connecter comme client <ArrowRight size={16}/></Link><p className="auth-role-switch">Vous n’avez pas de compte client ? <Link to="/client/inscription?return=%2Fcommande">Créer un compte client avec une autre adresse e-mail</Link></p><Link className="text-link" to={`/espace/${user.role}`}>Retourner à mon espace {user.role}</Link></div> : <form className="checkout-layout" onSubmit={submitOrder}><div className="checkout-fields"><section className="checkout-card"><div className="checkout-card-title"><span>01</span><div><h2>Qui reçoit la commande ?</h2><p>Les informations utiles pour vous joindre.</p></div></div><div className="form-grid"><label>Nom complet<input name="name" required readOnly value={user.name} /></label><label>Téléphone<input name="phone" required type="tel" defaultValue={user.phone ?? ""} placeholder="07 00 00 00 00"/></label><label className="wide-field">Adresse de livraison<input name="address" required={delivery !== "pickup"} defaultValue={user.defaultAddress ?? ""} placeholder="Quartier, rue, repère…"/></label><label>Ville / commune<select name="city" value={city} onChange={event => setCity(event.target.value)}><option>Abidjan</option><option>Grand-Bassam</option><option>Yamoussoukro</option><option>Bouaké</option><option>Autre ville</option>{user.defaultCity && !["Abidjan", "Grand-Bassam", "Yamoussoukro", "Bouaké", "Autre ville"].includes(user.defaultCity) && <option>{user.defaultCity}</option>}</select></label><label>Précisions (facultatif)<input name="instructions" placeholder="Bâtiment, indications…"/></label></div></section>
      <section className="checkout-card"><div className="checkout-card-title"><span>02</span><div><h2>Comment souhaitez-vous recevoir ?</h2><p>Choisissez l'option la plus simple pour vous.</p></div></div><div className="choice-list"><label className={`choice-card ${delivery === "standard" ? "choice-selected" : ""}`}><input type="radio" name="delivery" value="standard" checked={delivery === "standard"} onChange={() => setDelivery("standard")}/><span className="choice-icon"><Smartphone size={18}/></span><span className="choice-copy"><strong>Livraison à l'adresse indiquée</strong><small>Organisée par la boutique · délai à convenir après commande</small></span><b>{formatPrice(shipping)}</b></label><label className={`choice-card ${delivery === "pickup" ? "choice-selected" : ""}`}><input type="radio" name="delivery" value="pickup" checked={delivery === "pickup"} onChange={() => setDelivery("pickup")}/><span className="choice-icon"><Store size={18}/></span><span className="choice-copy"><strong>Retrait chez le vendeur</strong><small>À convenir avec la boutique après commande</small></span><b>Offert</b></label></div></section>
      <section className="checkout-card"><div className="checkout-card-title"><span>03</span><div><h2>Paiement</h2><p>Le checkout hébergé GeniusPay permettra de choisir le moyen de paiement.</p></div></div><p>Cette étape enregistre une demande non payée. Aucun montant ne sera débité et la boutique ne reçoit pas encore de notification.</p></section>
      </div><aside className="checkout-summary"><span className="eyebrow">VOTRE SÉLECTION</span><h2>Récapitulatif</h2><div className="checkout-products">{items.map(item => <div key={item.id} className="checkout-product"><img src={item.image} alt=""/><span><strong>{item.name}</strong><small>Qté : {item.quantity}</small></span><b>{formatPrice(item.price * item.quantity)}</b></div>)}</div><div className="summary-row"><span>Sous-total</span><strong>{formatPrice(totalPrice)}</strong></div><div className="summary-row"><span>Livraison</span><strong>{delivery === "pickup" ? "Offerte" : formatPrice(shipping)}</strong></div><div className="summary-total"><span>Total estimatif</span><strong>{formatPrice(totalPrice + shipping)}</strong></div><p className="demo-payment-note">Demande enregistrée en attente de paiement. Aucun débit ne sera effectué.</p>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-dark checkout-submit" type="submit" disabled={submitting}>{submitting ? "Enregistrement…" : "Enregistrer ma demande"} <ArrowRight size={17}/></button><Link className="checkout-return" to="/panier"><ArrowLeft size={14}/> Retour au panier</Link></aside></form>}
    </div></section>;
}
