import { useState, type FormEvent } from "react";
import { ArrowRight, Store } from "lucide-react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getRoleReturnPath } from "../data/authRouting";

export default function Register({ role: requestedRole }: { role?: "client" | "vendeur" }) {
  const [params] = useSearchParams();
  const location = useLocation();
  const role = requestedRole ?? (location.pathname.startsWith("/vendeur") || params.get("role") === "vendeur" ? "vendeur" : "client");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const name = String(values.get("name") || "").trim();
    const email = String(values.get("email") || "").trim();
    const storeName = String(values.get("store") || "").trim();
    const password = String(values.get("password") || "");
    setError("");
    setSubmitting(true);
    try {
      const user = await register(name, email, password, role, storeName);
      const returnTo = getRoleReturnPath(role, params.get("return"));
      navigate(returnTo ?? `/espace/${user.role}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Création du compte impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  const otherRole = role === "client" ? "vendeur" : "client";
  const sectionTitle = role === "client" ? "Créer mon compte client" : "Créer mon compte vendeur";
  return <section className="auth-page"><div className="auth-aside auth-aside-register"><span className="eyebrow">{role === "client" ? "ESPACE CLIENT FATA" : "ESPACE VENDEUR FATA"}</span><h1>{role === "client" ? <>Les belles choses<br/><em>vous attendent.</em></> : <>Votre boutique<br/><em>prend sa place.</em></>}</h1><p>{role === "client" ? "Découvrez les boutiques locales, commandez vos coups de cœur et suivez vos achats au même endroit." : "Rejoignez les créateurs et boutiques ivoiriens qui font découvrir leurs produits sur FATA."}</p><div className="auth-aside-number">FATA<span>✳</span> {role === "client" ? "CLIENT" : "VENDEUR"}</div></div><div className="auth-card"><span className="eyebrow">{role === "client" ? "INSCRIPTION CLIENT" : "INSCRIPTION VENDEUR"}</span><h2>{sectionTitle}</h2><p>Ce compte ouvre uniquement l’espace {role}. Une adresse e-mail ne peut être associée qu’à un seul rôle.</p><form onSubmit={submit}><label>Nom complet<input name="name" autoComplete="name" placeholder="Votre nom" required/></label><label>Adresse e-mail<input name="email" type="email" autoComplete="email" placeholder="vous@exemple.com" required/></label>{role === "vendeur" && <><label>Nom de votre boutique<input name="store" placeholder="Le nom que vos clients verront" required/></label><div className="seller-review-info"><Store size={16}/><span>Les nouvelles boutiques sont soumises à validation par FATA avant leur ouverture.</span></div></>}<label>Mot de passe<input name="password" type="password" autoComplete="new-password" minLength={12} placeholder="12 caractères minimum" required/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-dark full-button" type="submit" disabled={submitting}>{submitting ? "Création…" : `Créer mon compte ${role}`} <ArrowRight size={16}/></button></form><div className="auth-security-note">Votre mot de passe est haché et vérifié côté serveur.</div><div className="auth-footer">Déjà inscrit ? <Link to={`/${role}/connexion`}>Connexion {role}</Link><p className="auth-role-switch">Vous souhaitez {otherRole === "client" ? "acheter" : "vendre"} ? <Link to={`/${otherRole}/inscription`}>Créer un compte {otherRole}</Link></p><Link to="/admin/connexion">Accès administrateur</Link></div></div></section>;
}
