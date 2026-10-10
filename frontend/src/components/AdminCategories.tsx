import { Fragment, useEffect, useState, type ClipboardEvent, type FormEvent } from "react";
import { Check, Eye, EyeOff, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { ApiError, apiRequest } from "../data/api";

type Category = {
  id: string;
  name: string;
  slug: string;
  image: string | null;
  active: boolean;
  parentId: string | null;
  parent: { id: string; name: string; slug: string } | null;
  _count: { products: number; children: number };
};

function toSlug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeImageSource(value: string): string | null {
  const imageSource = value.trim();
  if (!imageSource) return null;
  if (imageSource.startsWith("//")) return `https:${imageSource}`;
  if (imageSource.startsWith("/")) return !imageSource.startsWith("//") && !/\s/.test(imageSource) ? imageSource : null;

  try {
    const url = new URL(imageSource);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function isValidImageSource(value: string) {
  return !value.trim() || normalizeImageSource(value) !== null;
}

function isPinterestPageLink(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "pin.it" || hostname.endsWith(".pin.it") || hostname === "pinterest.com" || hostname.endsWith(".pinterest.com") || /^pinterest\.[a-z.]+$/.test(hostname);
  } catch {
    return false;
  }
}

function getImageUrlFromClipboard(clipboard: DataTransfer): string | null {
  const html = clipboard.getData("text/html");
  let linkedImage: string | null = null;
  if (html) {
    const documentFromClipboard = new DOMParser().parseFromString(html, "text/html");
    for (const image of Array.from(documentFromClipboard.querySelectorAll("img"))) {
      for (const source of [image.getAttribute("src"), image.getAttribute("data-src"), image.getAttribute("data-original")]) {
        const normalized = source ? normalizeImageSource(source) : null;
        if (normalized) return normalized;
      }
    }
    for (const link of Array.from(documentFromClipboard.querySelectorAll("a[href]"))) {
      const normalized = normalizeImageSource(link.getAttribute("href") ?? "");
      if (normalized) {
        linkedImage = normalized;
        break;
      }
    }
  }

  const plainText = clipboard.getData("text/plain");
  const uriList = clipboard.getData("text/uri-list").split(/\r?\n/).find(line => line && !line.startsWith("#")) ?? "";
  return normalizeImageSource(plainText) ?? normalizeImageSource(uriList) ?? linkedImage;
}

function CategoryImageInput({ id, label, value, onChange }: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [previewFailed, setPreviewFailed] = useState(false);
  const [pasteMessage, setPasteMessage] = useState("");
  const imageSource = value.trim();
  const canPreview = Boolean(imageSource) && isValidImageSource(imageSource);

  useEffect(() => setPreviewFailed(false), [imageSource]);

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pastedImageUrl = getImageUrlFromClipboard(event.clipboardData);
    if (pastedImageUrl) {
      event.preventDefault();
      onChange(pastedImageUrl);
      setPasteMessage("");
      return;
    }

    const copiedImage = Array.from(event.clipboardData.items).some(item => item.type.startsWith("image/"));
    if (copiedImage) {
      event.preventDefault();
      setPasteMessage("Cette copie contient l’image, mais pas son URL. Sur Pinterest, faites un clic droit sur l’image puis « Copier l’adresse de l’image ».");
    }
  }

  return <div className="category-image-field">
    <label htmlFor={id}>{label}<input id={id} type="text" inputMode="url" autoComplete="url" value={value} onPaste={handlePaste} onChange={event => { onChange(event.target.value); setPasteMessage(""); }} maxLength={500} placeholder="https://i.pinimg.com/..."/></label>
    <small>Collez l’URL directe de l’image (HTTPS conseillé). Sur Pinterest, choisissez « Copier l’adresse de l’image » : un lien pinterest.com/pin/ ouvre une page, pas une image. L’image reste hébergée sur son site source.</small>
    {pasteMessage && <small role="status">{pasteMessage}</small>}
    {canPreview && (previewFailed
      ? <small role="status">{isPinterestPageLink(imageSource) ? "Ce lien ouvre une page Pinterest. Copiez l’adresse directe de l’image, généralement sur i.pinimg.com." : "L’aperçu ne peut pas charger cette image. Vérifiez que le lien est public et pointe directement vers une image."}</small>
      : <img key={imageSource} src={imageSource} alt="Aperçu de l’image de catégorie" onError={() => setPreviewFailed(true)}/>
    )}
  </div>;
}

export default function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [parentId, setParentId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [editImage, setEditImage] = useState("");
  const [editParentId, setEditParentId] = useState("");

  async function loadCategories() {
    setLoading(true);
    try {
      setCategories(await apiRequest<Category[]>("/categories/admin/all"));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Chargement des catégories impossible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadCategories(); }, []);

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isValidImageSource(image)) {
      setError("Saisissez une URL d’image HTTP(S) valide pour la catégorie.");
      return;
    }
    if (isPinterestPageLink(image)) {
      setError("Ce lien Pinterest ouvre une page. Copiez l’adresse directe de l’image, généralement sur i.pinimg.com.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiRequest<Category>("/categories", {
        method: "POST",
        body: JSON.stringify({
          name,
          slug: toSlug(name),
          ...(image.trim() ? { image: image.trim() } : {}),
          ...(parentId ? { parentId } : {}),
        }),
      });
      setName("");
      setImage("");
      setParentId("");
      await loadCategories();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Création de la catégorie impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(category: Category) {
    setBusyId(category.id);
    setError("");
    try {
      await apiRequest<Category>(`/categories/${encodeURIComponent(category.id)}/active`, {
        method: "PATCH",
        body: JSON.stringify({ active: !category.active }),
      });
      await loadCategories();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible de modifier la catégorie.");
    } finally {
      setBusyId("");
    }
  }

  async function updateCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    if (!isValidImageSource(editImage)) {
      setError("Saisissez une URL d’image HTTP(S) valide pour la catégorie.");
      return;
    }
    if (isPinterestPageLink(editImage)) {
      setError("Ce lien Pinterest ouvre une page. Copiez l’adresse directe de l’image, généralement sur i.pinimg.com.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await apiRequest<Category>(`/categories/${encodeURIComponent(editing.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          slug: toSlug(editName),
          image: editImage.trim() || null,
          parentId: editParentId || null,
        }),
      });
      setEditing(null);
      await loadCategories();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Modification de la catégorie impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(category: Category) {
    if (!window.confirm(`Supprimer définitivement la catégorie « ${category.name} » ?${category._count.products ? ` Elle contient ${category._count.products} produit(s) et devra d’abord être vidée.` : ""}${category._count.children ? ` Elle contient ${category._count.children} sous-catégorie(s) et devra d’abord être vidée.` : ""}`)) return;
    setBusyId(category.id);
    setError("");
    try {
      await apiRequest(`/categories/${encodeURIComponent(category.id)}`, { method: "DELETE" });
      if (editing?.id === category.id) setEditing(null);
      await loadCategories();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Suppression de la catégorie impossible.");
    } finally {
      setBusyId("");
    }
  }

  const categoryRows = categories
    .filter(category => !category.parentId)
    .flatMap(parent => [parent, ...categories.filter(category => category.parentId === parent.id)]);

  return <section className="workspace-panel full-panel">
    <div className="workspace-panel-heading"><div><span className="eyebrow">CATALOGUE FATA</span><h3>Gérer les catégories</h3></div></div>
    <form className="draft-product-form" onSubmit={addCategory}>
      <label>Nom de la catégorie ou sous-catégorie<input value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={60} placeholder="Ex. Mode, Robes"/></label>
      <label>Catégorie parente (facultatif)<select value={parentId} onChange={event => setParentId(event.target.value)}><option value="">Aucune — catégorie principale</option>{categories.filter(category => !category.parentId && category.active).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <CategoryImageInput id="new-category-image" label="Image (URL, facultative)" value={image} onChange={setImage}/>
      <button className="button button-dark" type="submit" disabled={saving || !toSlug(name)}>{saving ? "Ajout…" : parentId ? "Ajouter la sous-catégorie" : "Ajouter la catégorie"} <Plus size={15}/></button>
      <p>Choisissez une catégorie parente pour créer une sous-catégorie. Les sous-catégories ne peuvent pas être imbriquées davantage.</p>
    </form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <p>Chargement des catégories…</p> : categories.length ? <div className="seller-product-list">
      {categoryRows.map(category => <Fragment key={category.id}>
        <div className="seller-product-row admin-managed-row">
          <div className="seller-product-thumb">{category.image && <img src={category.image} alt=""/>}</div>
          <div className={category.parentId ? "admin-subcategory-copy" : ""}><strong>{category.parentId ? `↳ ${category.name}` : category.name}</strong><small>{category.parent ? `${category.parent.name} · ` : ""}/{category.slug} · {category._count.products} produit(s){category._count.children ? ` · ${category._count.children} sous-catégorie(s)` : ""}</small></div>
          <span className={`status-pill ${category.active ? "status-approved" : "status-pending"}`}>{category.active ? <><Check size={12}/> Active</> : "Inactive"}</span>
          <button type="button" disabled={busyId === category.id || saving} onClick={() => void toggleActive(category)} aria-label={category.active ? `Désactiver ${category.name}` : `Réactiver ${category.name}`}>{category.active ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
          <button type="button" disabled={busyId === category.id || saving} onClick={() => { setEditing(category); setEditName(category.name); setEditImage(category.image ?? ""); setEditParentId(category.parentId ?? ""); setError(""); }} aria-label={`Modifier ${category.name}`}><Pencil size={16}/></button>
          <button type="button" className="admin-delete-button" disabled={busyId === category.id || saving} onClick={() => void deleteCategory(category)} aria-label={`Supprimer ${category.name}`}><Trash2 size={16}/></button>
        </div>
        {editing?.id === category.id && <form className="draft-product-form admin-inline-edit" onSubmit={updateCategory}>
          <label>Nom<input value={editName} onChange={event => setEditName(event.target.value)} required minLength={2} maxLength={60}/></label>
          <label>Catégorie parente<select value={editParentId} onChange={event => setEditParentId(event.target.value)} disabled={Boolean(category._count.children)}><option value="">Aucune — catégorie principale</option>{categories.filter(candidate => !candidate.parentId && candidate.id !== category.id && (candidate.active || candidate.id === category.parentId)).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.active ? "" : " (inactive)"}</option>)}</select></label>
          <CategoryImageInput id={`edit-category-image-${category.id}`} label="Image (URL, facultative)" value={editImage} onChange={setEditImage}/>
          <div className="admin-edit-actions"><button className="button button-dark" type="submit" disabled={saving || !toSlug(editName)}>{saving ? "Enregistrement…" : "Enregistrer"} <Save size={14}/></button><button className="button button-outline" type="button" onClick={() => setEditing(null)} disabled={saving}>Annuler <X size={14}/></button></div>
        </form>}
      </Fragment>)}
    </div> : <div className="workspace-empty"><strong>Aucune catégorie configurée.</strong></div>}
  </section>;
}
