import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Save, X } from "lucide-react";
import { ApiError, apiRequest, type ApiCategory, type ApiProduct } from "../data/api";
import { formatPrice } from "../data/orders";

type SellerTab = "Ma boutique" | "Mes produits";
type ProductDraft = { id: string; name: string; description: string; price: string; stock: string; categoryId: string; image: string };
type SellerStore = {
  id: string;
  name: string;
  description: string;
  city: string;
  category: string;
  image: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  _count: { products: number };
};

const storeStatus: Record<SellerStore["status"], string> = {
  PENDING: "En attente d’approbation",
  APPROVED: "Boutique approuvée",
  REJECTED: "Demande refusée",
};

export default function SellerManagement({ active }: { active: SellerTab }) {
  const [store, setStore] = useState<SellerStore | null>(null);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [storeSaving, setStoreSaving] = useState(false);
  const [productDraft, setProductDraft] = useState<ProductDraft | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStore(await apiRequest<SellerStore>("/stores/mine"));
      if (active === "Mes produits") {
        const [productRows, categoryRows] = await Promise.all([
          apiRequest<ApiProduct[]>("/products/mine"),
          apiRequest<ApiCategory[]>("/categories"),
        ]);
        setProducts(productRows);
        setCategories(categoryRows);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chargement de l’espace vendeur impossible.");
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => { void load(); }, [load]);

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiRequest<ApiProduct>("/products", {
        method: "POST",
        body: JSON.stringify({
          name: String(form.get("name") || "").trim(),
          description: String(form.get("description") || "").trim(),
          price: Number(form.get("price")),
          stock: Number(form.get("stock")),
          categoryId: String(form.get("categoryId") || ""),
          image: String(form.get("image") || "").trim(),
        }),
      });
      formElement.reset();
      setSuccess("Produit soumis à la modération FATA. Il sera visible après validation.");
      await load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : reason instanceof Error ? reason.message : "Impossible d’enregistrer le produit.");
    } finally {
      setSaving(false);
    }
  }

  function editProduct(product: ApiProduct) {
    setError("");
    setSuccess("");
    setProductDraft({
      id: product.id,
      name: product.name,
      description: product.description,
      price: String(product.price),
      stock: String(product.stock),
      categoryId: product.category.id,
      image: product.image ?? "",
    });
  }

  async function updateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!productDraft) return;
    setBusyId(productDraft.id);
    setError("");
    setSuccess("");
    try {
      await apiRequest(`/products/mine/${encodeURIComponent(productDraft.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: productDraft.name.trim(),
          description: productDraft.description.trim(),
          price: Number(productDraft.price),
          stock: Number(productDraft.stock),
          categoryId: productDraft.categoryId,
          image: productDraft.image.trim() || null,
        }),
      });
      setProductDraft(null);
      setSuccess("Produit modifié et renvoyé à la modération FATA. Il restera masqué jusqu’à sa validation.");
      await load();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : reason instanceof Error ? reason.message : "Modification du produit impossible.");
    } finally {
      setBusyId("");
    }
  }

  async function updateStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStoreSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await apiRequest<SellerStore>("/stores/mine", {
        method: "PATCH",
        body: JSON.stringify({
          description: String(form.get("description") || "").trim(),
          city: String(form.get("city") || "").trim(),
          category: String(form.get("category") || "").trim(),
          image: String(form.get("image") || "").trim() || null,
        }),
      });
      setStore(updated);
      setSuccess("Le profil de votre boutique a été mis à jour.");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : reason instanceof Error ? reason.message : "Modification de la boutique impossible.");
    } finally {
      setStoreSaving(false);
    }
  }

  if (loading) return <section className="workspace-panel full-panel loading-state" aria-busy="true"><span className="loading-spinner"/> Chargement de votre boutique…</section>;

  if (active === "Ma boutique") {
    return <section className="workspace-panel full-panel">
      <div className="workspace-panel-heading"><div><span className="eyebrow">VOTRE ACTIVITÉ FATA</span><h3>Ma boutique</h3></div></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="form-success" role="status">{success}</p>}
      {store && <><div className="store-settings-card">{store.image ? <img src={store.image} alt={`Visuel de ${store.name}`}/> : <div className="seller-avatar">{store.name.slice(0, 1).toUpperCase()}</div>}<div><span className="eyebrow">{store.city} · {store.category}</span><h3>{store.name}</h3><p>{store.description}</p><span className={`status-pill ${store.status === "APPROVED" ? "status-approved" : "status-pending"}`}>{storeStatus[store.status]}</span><p>{store._count.products} produit(s) dans votre boutique.</p></div></div>
        {store.status === "APPROVED" ? <form className="draft-product-form store-profile-form" onSubmit={updateStore}>
          <h4>Modifier le profil public</h4>
          <label>Description de la boutique<textarea name="description" defaultValue={store.description} required minLength={2} maxLength={80} rows={3}/></label>
          <label>Ville<input name="city" defaultValue={store.city} required minLength={2} maxLength={80}/></label>
          <label>Spécialité<input name="category" defaultValue={store.category} minLength={2} maxLength={60}/></label>
          <label>Image de couverture (URL)<input name="image" defaultValue={store.image ?? ""} maxLength={500} placeholder="/ma-boutique.jpg"/></label>
          <button className="button button-dark" type="submit" disabled={storeSaving}>{storeSaving ? "Enregistrement…" : "Enregistrer le profil"} <Save size={14}/></button>
        </form> : <p className="pending-review">Les informations publiques seront modifiables après validation de votre boutique.</p>}
      </>}
    </section>;
  }

  return <section className="workspace-panel full-panel">
    <div className="workspace-panel-heading"><div><span className="eyebrow">VOTRE SÉLECTION</span><h3>Gérer mes produits</h3></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {success && <p className="form-success" role="status">{success}</p>}
    {store?.status !== "APPROVED" && <p className="pending-review">Votre boutique doit être approuvée avant de publier des produits.</p>}
    {store?.status === "APPROVED" && <form className="draft-product-form" onSubmit={createProduct}>
      <label>Nom du produit<input name="name" required minLength={2} maxLength={120} placeholder="Ex. Tote bag en raphia"/></label>
      <label>Catégorie<select name="categoryId" required defaultValue=""><option value="" disabled>Choisir une catégorie</option>{categories.map(category => <option key={category.id} value={category.id}>{category.parent ? `${category.parent.name} — ${category.name}` : category.name}</option>)}</select></label>
      <label>Description<textarea name="description" required minLength={10} maxLength={2000} rows={3} placeholder="Présentez votre produit…"/></label>
      <label>Prix (FCFA)<input name="price" type="number" required min="1" max="100000000" step="1" placeholder="18000"/></label>
      <label>Stock<input name="stock" type="number" required min="0" max="1000000" step="1" defaultValue="1"/></label>
      <label>Image (URL)<input name="image" maxLength={500} placeholder="/mon-produit.jpg"/></label>
      <button className="button button-dark" type="submit" disabled={saving || categories.length === 0}>{saving ? "Enregistrement…" : "Soumettre le produit"} <Plus size={15}/></button>
      <p>Chaque nouveau produit est masqué du catalogue jusqu’à sa validation par FATA.</p>
    </form>}
    {products.length ? <div className="seller-product-list">{products.map(product => <div className="seller-product-entry" key={product.id}>
      <div className="seller-product-row"><div className="seller-product-thumb">{product.image && <img src={product.image} alt=""/>}</div><div><strong>{product.name}</strong><small>{product.category.parent ? `${product.category.parent.name} · ` : ""}{product.category.name} · Stock : {product.stock}</small></div><span className={`status-pill ${product.active ? "status-approved" : "status-pending"}`}>{product.active ? <><Check size={12}/> Publié</> : "Non publié"}</span><strong>{formatPrice(product.price)}</strong><button type="button" disabled={busyId === product.id} onClick={() => productDraft?.id === product.id ? setProductDraft(null) : editProduct(product)} aria-label={`${productDraft?.id === product.id ? "Annuler la modification de" : "Modifier"} ${product.name}`}><Pencil size={15}/></button></div>
      {productDraft?.id === product.id && <form className="draft-product-form seller-inline-edit" onSubmit={updateProduct}>
        <label>Nom<input value={productDraft.name} onChange={event => setProductDraft({ ...productDraft, name: event.target.value })} required minLength={2} maxLength={120}/></label>
        <label>Description<textarea value={productDraft.description} onChange={event => setProductDraft({ ...productDraft, description: event.target.value })} required minLength={10} maxLength={2000} rows={3}/></label>
        <label>Prix (FCFA)<input type="number" value={productDraft.price} onChange={event => setProductDraft({ ...productDraft, price: event.target.value })} required min={1} max={100000000} step={1}/></label>
        <label>Stock<input type="number" value={productDraft.stock} onChange={event => setProductDraft({ ...productDraft, stock: event.target.value })} required min={0} max={1000000} step={1}/></label>
        <label>Catégorie<select value={productDraft.categoryId} onChange={event => setProductDraft({ ...productDraft, categoryId: event.target.value })} required>{categories.map(category => <option key={category.id} value={category.id}>{category.parent ? `${category.parent.name} — ` : ""}{category.name}</option>)}{!categories.some(category => category.id === productDraft.categoryId) && <option value={productDraft.categoryId}>{product.category.parent ? `${product.category.parent.name} — ` : ""}{product.category.name} (inactive)</option>}</select></label>
        <label>Image (URL, facultative)<input value={productDraft.image} onChange={event => setProductDraft({ ...productDraft, image: event.target.value })} maxLength={500}/></label>
        <div className="seller-edit-actions"><button className="button button-dark" type="submit" disabled={busyId === product.id}>{busyId === product.id ? "Enregistrement…" : "Enregistrer et renvoyer" } <Save size={14}/></button><button className="button button-outline" type="button" onClick={() => setProductDraft(null)} disabled={busyId === product.id}>Annuler <X size={14}/></button></div>
        <p>Toute modification renvoie le produit en modération et le masque temporairement du catalogue.</p>
      </form>}
    </div>)}</div> : !error && <div className="workspace-empty"><strong>Pas encore de produit dans votre boutique.</strong><p>Ajoutez votre première référence pour la soumettre à l’équipe FATA.</p></div>}
  </section>;
}
