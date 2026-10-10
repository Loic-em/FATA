import { useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole, Sparkles, Store, UserRound } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getRoleReturnPath } from "../data/authRouting";

export function AccountAccessChoice({ action }: { action: "connexion" | "inscription" }) {
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("return");
  const destination = (role: "client" | "vendeur") => {
    const path = `/${role}/${action}`;
    const roleReturnPath = getRoleReturnPath(role, returnTo);
    return roleReturnPath ? `${path}?return=${encodeURIComponent(roleReturnPath)}` : path;
  };
  const isLogin = action === "connexion";
  return <section className="auth-page"><div className="auth-aside"><span className="eyebrow">FATA, DES ESPACES QUI VOUS RESSEMBLENT</span><h1>Par où<br/><em>commencer ?</em></h1><p>Choisissez votre espace pour accéder au bon parcours. Les comptes client, vendeur et admin restent séparés.</p><div className="auth-aside-stamp"><Sparkles size={20}/><span>Une place pour<br/>chaque projet</span></div></div><div className="auth-card"><span className="eyebrow">{isLogin ? "CHOISIR UN ESPACE" : "REJOINDRE FATA"}</span><h2>{isLogin ? "Qui êtes-vous ?" : "Comment souhaitez-vous participer ?"}</h2><p>{isLogin ? "Connectez-vous à l’espace correspondant à votre compte." : "Chaque compte donne accès à un espace dédié."}</p><div className="auth-choice-grid"><Link className="auth-choice-link" to={destination("client")}><span className="auth-choice-icon"><UserRound size={20}/></span><span><strong>{isLogin ? "Espace client" : "Créer un compte client"}</strong><small>{isLogin ? "Commandes, favoris et messages" : "Découvrir et commander"}</small></span><ArrowRight size={17}/></Link><Link className="auth-choice-link" to={destination("vendeur")}><span className="auth-choice-icon"><Store size={20}/></span><span><strong>{isLogin ? "Espace vendeur" : "Créer un compte vendeur"}</strong><small>{isLogin ? "Boutique, produits et clients" : "Présenter votre boutique"}</small></span><ArrowRight size={17}/></Link></div><div className="auth-security-note"><LockKeyhole size={14}/> Un compte par adresse e-mail et par rôle.</div><div className="auth-footer"><Link to="/admin/connexion">Accès administrateur</Link></div></div></section>;
}

export default function Login({ adminOnly = false, role = "client" }: { adminOnly?: boolean; role?: "client" | "vendeur" }) {
  const { signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnDestination = searchParams.get("return");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") || "").trim();
    const password = String(values.get("password") || "");
    setError("");
    setSubmitting(true);
    try {
      const user = await signIn(email, password);
      if (adminOnly && user.role !== "admin") {
        await signOut();
        setError("Ce compte n’a pas les droits administrateur.");
        return;
      }
      if (!adminOnly && user.role !== role) {
        await signOut();
        setError(role === "client"
          ? "Ce compte est un compte vendeur. Les rôles sont séparés : utilisez un compte client créé avec une autre adresse e-mail pour commander."
          : "Ce compte est un compte client. Connectez-vous depuis l’espace client ou créez un compte vendeur.");
        return;
      }
      const returnTo = getRoleReturnPath(role, searchParams.get("return"));
      navigate(adminOnly ? "/espace/admin" : returnTo ?? `/espace/${role}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Connexion impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  const sectionName = role === "client" ? "client" : "vendeur";
  const sectionSignupPath = role === "client" ? "/client/inscription" : "/vendeur/inscription";
  const roleReturnPath = getRoleReturnPath(role, returnDestination);
  const sectionSignup = roleReturnPath
    ? `${sectionSignupPath}?return=${encodeURIComponent(roleReturnPath)}`
    : sectionSignupPath;
  const otherRole = role === "client" ? "vendeur" : "client";
  const otherLoginUrl = role === "client" ? "/vendeur/connexion" : "/client/connexion";
  return <section className="auth-page"><div className="auth-aside"><span className="eyebrow">{adminOnly ? "ACCÈS RÉSERVÉ À L’ÉQUIPE" : role === "client" ? "ESPACE CLIENT FATA" : "ESPACE VENDEUR FATA"}</span><h1>{adminOnly ? <>Pilotage<br/><em>de FATA.</em></> : role === "client" ? <>Vos envies<br/><em>à vous.</em></> : <>Votre boutique<br/><em>sur FATA.</em></>}</h1><p>{adminOnly ? "Connectez-vous avec le compte administrateur configuré pour cette plateforme." : role === "client" ? "Retrouvez vos commandes, vos boutiques préférées et les jolies choses que vous avez repérées." : "Gérez votre boutique, vos produits, vos commandes et vos échanges avec vos clients."}</p><div className="auth-aside-stamp"><Sparkles size={20}/><span>{adminOnly ? <>Administration<br/>sécurisée</> : role === "client" ? <>Vos commandes<br/>et découvertes</> : <>Votre activité<br/>vendeur</>}</span></div></div><div className="auth-card"><span className="eyebrow">{adminOnly ? "ADMINISTRATION FATA" : `CONNEXION ${role === "client" ? "CLIENT" : "VENDEUR"}`}</span><h2>{adminOnly ? "Connexion administrateur" : `Connexion ${sectionName}`}</h2><p>{adminOnly ? "Aucun compte administrateur ne peut être créé depuis cette page." : `Connectez-vous à votre espace ${sectionName}. Les comptes client et vendeur sont séparés.`}</p><form onSubmit={submit}><label>Adresse e-mail<input type="email" name="email" autoComplete="username" placeholder="vous@exemple.com" required/></label><label>Mot de passe<input type="password" name="password" autoComplete="current-password" placeholder="Votre mot de passe" required/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-dark full-button" type="submit" disabled={submitting}>{submitting ? "Connexion…" : adminOnly ? "Ouvrir l’administration" : `Ouvrir mon espace ${sectionName}`} <ArrowRight size={16}/></button></form><div className="auth-security-note"><LockKeyhole size={14}/> Session sécurisée, mot de passe vérifié côté serveur.</div>{adminOnly ? <div className="auth-footer"><Link to="/client/connexion">Accès client</Link><span> · </span><Link to="/vendeur/connexion">Accès vendeur</Link></div> : <div className="auth-footer">{role === "client" ? "Nouveau sur FATA ?" : "Vous n’avez pas encore de boutique ?"} <Link to={sectionSignup}>{role === "client" ? "Créer un compte client" : "Créer un compte vendeur"}</Link><p className="auth-role-switch">Vous êtes {otherRole} ? <Link to={otherLoginUrl}>Accéder à l’espace {otherRole}</Link></p><Link to="/admin/connexion">Accès administrateur</Link></div>}</div></section>;
}
