import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import Layout from "./components/Layout";
import Cart from "./pages/Cart";
import Catalog from "./pages/Catalog";
import Checkout from "./pages/Checkout";
import Confirmation from "./pages/Confirmation";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import { ContactPage, HelpPage, LegalPage } from "./pages/Info";
import Login, { AccountAccessChoice } from "./pages/Login";
import Product from "./pages/Product";
import Register from "./pages/Register";
import { StoreDetail, StoreDirectory } from "./pages/Stores";
import { useAuth } from "./context/AuthContext";
import { trackPageVisit } from "./data/analytics";

function ProtectedSpace() {
  const { role: requestedRole = "client" } = useParams();
  const location = useLocation();
  const { user, loading } = useAuth();
  if (loading) return <section className="empty-page" aria-busy="true">Chargement de votre espace…</section>;
  if (!user) {
    const loginPath = requestedRole === "admin" ? "/admin/connexion" : requestedRole === "vendeur" ? "/vendeur/connexion" : "/client/connexion";
    const returnTo = `${location.pathname}${location.search}`;
    return <Navigate to={`${loginPath}?return=${encodeURIComponent(returnTo)}`} replace/>;
  }
  if (requestedRole !== user.role) return <Navigate to={`/espace/${user.role}`} replace/>;
  return <Dashboard/>;
}

export default function App() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    trackPageVisit(location.pathname);
  }, [location.pathname]);

  return <Routes><Route element={<Layout/>}>
    <Route path="/" element={<Home/>}/>
    <Route path="/catalogue" element={<Catalog/>}/>
    <Route path="/produit/:id" element={<Product/>}/>
    <Route path="/boutiques" element={<StoreDirectory/>}/>
    <Route path="/boutique/:id" element={<StoreDetail/>}/>
    <Route path="/panier" element={<Cart/>}/>
    <Route path="/commande" element={<Checkout/>}/>
    <Route path="/confirmation/:id" element={<Confirmation/>}/>
    <Route path="/connexion" element={<AccountAccessChoice action="connexion"/>}/>
    <Route path="/client/connexion" element={<Login role="client"/>}/>
    <Route path="/vendeur/connexion" element={<Login role="vendeur"/>}/>
    <Route path="/admin/connexion" element={<Login adminOnly/>}/>
    <Route path="/inscription" element={<AccountAccessChoice action="inscription"/>}/>
    <Route path="/client/inscription" element={<Register role="client"/>}/>
    <Route path="/vendeur/inscription" element={<Register role="vendeur"/>}/>
    <Route path="/espace/:role" element={<ProtectedSpace/>}/>
    <Route path="/aide" element={<HelpPage/>}/>
    <Route path="/contact" element={<ContactPage/>}/>
    <Route path="/informations/:slug" element={<LegalPage/>}/>
    <Route path="*" element={<Navigate to="/" replace/>}/>
  </Route></Routes>;
}
