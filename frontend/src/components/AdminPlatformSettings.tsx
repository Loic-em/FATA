import { useEffect, useState, type FormEvent } from "react";
import { Check, CreditCard, Package, Save, ShieldCheck, Store } from "lucide-react";
import { apiRequest } from "../data/api";
import { formatPrice } from "../data/orders";

type PlatformSettings = {
  deliveryFeeAbidjan: number;
  deliveryFeeGrandBassam: number;
  deliveryFeeOther: number;
  pickupFee: number;
  currency: "XOF";
};
type PaymentConfig = {
  mode: string;
  configured: boolean;
  simulationEnabled: boolean;
  apiKeyConfigured: boolean;
  apiSecretConfigured: boolean;
  webhookSecretConfigured: boolean;
  webhookUrlConfigured: boolean;
};

export default function AdminPlatformSettings({ onNavigate }: { onNavigate: (tab: "Finances" | "Commandes" | "Vendeurs") => void }) {
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [payment, setPayment] = useState<PaymentConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<PlatformSettings>("/settings/admin"),
      apiRequest<PaymentConfig>("/payments/geniuspay/admin/config"),
    ]).then(([platformSettings, paymentConfig]) => {
      if (!active) return;
      setSettings(platformSettings);
      setPayment(paymentConfig);
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "Impossible de charger les paramètres plateforme.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const updated = await apiRequest<PlatformSettings>("/settings/admin", {
        method: "PATCH",
        body: JSON.stringify({
          deliveryFeeAbidjan: Number(settings.deliveryFeeAbidjan),
          deliveryFeeGrandBassam: Number(settings.deliveryFeeGrandBassam),
          deliveryFeeOther: Number(settings.deliveryFeeOther),
        }),
      });
      setSettings(updated);
      setSuccess("Les frais sont enregistrés et seront utilisés au prochain checkout.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d'enregistrer les paramètres.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="admin-settings-stack">
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <section className="workspace-panel full-panel settings-loading" aria-busy="true"><span className="loading-spinner"/> Chargement des paramètres de plateforme…</section> : <>
      <section className="workspace-panel full-panel account-settings-panel">
        <div className="workspace-panel-heading account-settings-heading"><span className="settings-heading-icon"><Package size={18}/></span><div><span className="eyebrow">COMMANDES ET LIVRAISON</span><h3>Frais de livraison</h3><p>Ces montants sont recalculés et enregistrés par l’API au moment de la commande.</p></div></div>
        {settings && <form className="settings-form settings-grid" onSubmit={save}>
          <label>Abidjan (FCFA)<input type="number" min="0" max="100000" step="1" value={settings.deliveryFeeAbidjan} onChange={event => setSettings({ ...settings, deliveryFeeAbidjan: Number(event.target.value) })} required/></label>
          <label>Grand-Bassam (FCFA)<input type="number" min="0" max="100000" step="1" value={settings.deliveryFeeGrandBassam} onChange={event => setSettings({ ...settings, deliveryFeeGrandBassam: Number(event.target.value) })} required/></label>
          <label>Autres villes (FCFA)<input type="number" min="0" max="100000" step="1" value={settings.deliveryFeeOther} onChange={event => setSettings({ ...settings, deliveryFeeOther: Number(event.target.value) })} required/></label>
          <label>Retrait chez le vendeur<strong className="settings-readonly-value">{formatPrice(settings.pickupFee)} · toujours gratuit</strong></label>
          <div className="settings-form-actions">
            {success && <p className="form-success" role="status"><Check size={15}/>{success}</p>}
            <button className="button button-dark" type="submit" disabled={saving}>{saving ? <><span className="button-spinner"/> Enregistrement…</> : <>Enregistrer les frais <Save size={15}/></>}</button>
          </div>
        </form>}
      </section>

      <section className="workspace-panel full-panel account-settings-panel">
        <div className="workspace-panel-heading account-settings-heading"><span className="settings-heading-icon"><CreditCard size={18}/></span><div><span className="eyebrow">PAIEMENTS ET ESSAIS</span><h3>GeniusPay sandbox</h3><p>Le mode de paiement est défini côté serveur et reste non modifiable depuis le navigateur.</p></div></div>
        <div className="settings-payment-status"><span className={`status-pill ${payment?.mode === "sandbox" ? "status-approved" : "status-pending"}`}>{payment?.mode ?? "Indisponible"}</span><strong>{payment?.configured ? "Checkout GeniusPay sandbox configuré" : "Checkout GeniusPay externe non configuré"}</strong></div>
        <div className="settings-payment-checks">
          <span><Check size={14}/> Simulation interne sans argent réel</span>
          <span><Check size={14}/> Paiements réels désactivés dans le backend</span>
          <span><ShieldCheck size={14}/> Clés secrètes jamais affichées ici</span>
        </div>
        <p className="settings-help">Pour jouer le parcours complet, crée une commande client puis choisis « Simuler un paiement réussi ». Le vendeur pourra préparer, marquer l’expédition et le client confirmer la réception. Les commandes test restent exclues des revenus et avis vérifiés.</p>
        {!payment?.configured && <p className="settings-help">Pour le checkout hébergé GeniusPay, renseigne uniquement les clés sandbox et le secret du webhook dans les variables privées du serveur.</p>}
      </section>

      <section className="workspace-panel full-panel account-settings-panel">
        <div className="workspace-panel-heading account-settings-heading"><span className="settings-heading-icon"><Store size={18}/></span><div><span className="eyebrow">RACCOURCIS ADMIN</span><h3>Gestion de la plateforme</h3><p>Accède directement aux zones d’administration courantes.</p></div></div>
        <div className="settings-shortcuts">
          <button type="button" onClick={() => onNavigate("Finances")}><CreditCard size={16}/> Configuration GeniusPay</button>
          <button type="button" onClick={() => onNavigate("Commandes")}><Package size={16}/> Commandes et livraisons</button>
          <button type="button" onClick={() => onNavigate("Vendeurs")}><Store size={16}/> Validation des vendeurs</button>
        </div>
      </section>
    </>}
  </div>;
}
