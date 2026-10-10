import { useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { ArrowRight, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export default function Layout() {
  const { totalItems } = useCart();
  const { user, loading: authLoading, error: authError, retrySession } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigate(`/catalogue?q=${encodeURIComponent(query.trim())}`);
    setMenuOpen(false);
  }

  return <div className="app-shell">
    <div className="announcement"><span>LA CRÉATIVITÉ LOCALE, À PORTÉE DE CLIC</span><Link to="/catalogue">Découvrir les nouveautés <ArrowRight size={13}/></Link></div>
    <header className="site-header">
      <div className="header-main page-container">
        <button className="mobile-menu-button" aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X/> : <Menu/>}</button>
        <Link to="/" className="brand" aria-label="FATA, accueil"><img className="brand-mark" src="/fata-logo.svg" alt="FATA"/></Link>
        <form className="header-search" onSubmit={search} role="search"><Search size={18}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Un produit, une idée, une envie…" aria-label="Rechercher dans le catalogue"/><button type="submit">Rechercher</button></form>
        <div className="header-actions">
          <div className="account-access">
            <Link to="/connexion" className="account-link" aria-label="Ouvrir le menu de connexion"><UserRound size={20}/><span>{user ? user.role === "admin" ? "Administration" : user.role === "vendeur" ? "Espace vendeur" : "Espace client" : "Mon compte"}</span></Link>
            <div className="account-access-menu" aria-label="Choisir un espace de connexion">
              <Link to="/client/connexion">Connexion client</Link>
              <Link to="/vendeur/connexion">Connexion vendeur</Link>
              <Link to="/admin/connexion">Accès administrateur</Link>
            </div>
          </div>
          <Link to="/panier" className="basket-link" aria-label={`Panier, ${totalItems} article${totalItems > 1 ? "s" : ""}`}><ShoppingBag size={20}/><span>Panier</span><b>{totalItems}</b></Link>
        </div>
      </div>
      <nav className={`primary-nav ${menuOpen ? "nav-open" : ""}`} aria-label="Navigation principale">
        <div className="page-container nav-inner">
          <NavLink to="/catalogue" onClick={() => setMenuOpen(false)}>Tout le catalogue</NavLink>
          <NavLink to="/catalogue?categorie=Mode" onClick={() => setMenuOpen(false)}>Mode</NavLink>
          <NavLink to="/catalogue?categorie=Beauté" onClick={() => setMenuOpen(false)}>Beauté</NavLink>
          <NavLink to="/boutiques" onClick={() => setMenuOpen(false)}>Nos boutiques</NavLink>
          <NavLink to={user?.role === "client" ? "/espace/client" : "/client/connexion"} onClick={() => setMenuOpen(false)}>Espace client</NavLink>
          <NavLink to={user?.role === "vendeur" ? "/espace/vendeur" : "/vendeur/inscription"} className="seller-nav" onClick={() => setMenuOpen(false)}>{user?.role === "vendeur" ? "Espace vendeur" : "Vendre sur FATA"} <ArrowRight size={14}/></NavLink>
        </div>
      </nav>
    </header>
    <main>{authError && <div className="api-status-note" role="alert"><span>Connexion à FATA indisponible : {authError}</span><button type="button" onClick={() => void retrySession()} disabled={authLoading}>{authLoading ? "Vérification…" : "Réessayer"}</button></div>}<Outlet/></main>
    <footer className="site-footer">
      <div className="page-container footer-main">
        <div className="footer-brand"><Link to="/" className="brand brand-light"><img className="brand-mark" src="/fata-logo.svg" alt="FATA"/></Link><p>Le meilleur des créateurs et boutiques d'ici, réuni au même endroit.</p><span className="footer-location"><span className="status-dot"/> Une marketplace née en Côte d'Ivoire</span></div>
        <div className="footer-column"><h3>Explorer</h3><Link to="/catalogue">Tous les produits</Link><Link to="/boutiques">Nos boutiques</Link><Link to="/catalogue?sort=recent">Nouveautés</Link><Link to="/client/connexion">Espace client</Link><Link to="/vendeur/inscription">Devenir vendeur</Link></div>
        <div className="footer-column"><h3>À votre service</h3><Link to="/aide">Centre d'aide</Link><Link to="/contact">Nous contacter</Link><Link to="/informations/livraison">Livraison & retours</Link><Link to="/informations/confidentialite">Confidentialité</Link><Link to="/admin/connexion">Accès administrateur</Link></div>
        <div className="footer-note"><span className="footer-note-icon">✳</span><p>Des marques locales.<br/><strong>De belles découvertes.</strong></p></div>
      </div>
      <div className="page-container footer-bottom"><span>© 2026 FATA. Tous droits réservés.</span><span>Fait avec soin, en Côte d'Ivoire <span className="flag-dot">●</span></span><Link to="/informations/conditions">Conditions générales</Link></div>
    </footer>
    <div className="demo-note">Paiement en ligne indisponible · les demandes restent en attente</div>
  </div>;
}
