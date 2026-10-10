import { useEffect, useState, type FormEvent } from "react";
import { Check, KeyRound, MapPin, Save, UserRound } from "lucide-react";
import { apiRequest } from "../data/api";
import { useAuth } from "../context/AuthContext";

type SettingsSection = "profile" | "address" | "security";

const headings: Record<SettingsSection, { eyebrow: string; title: string; description: string }> = {
  profile: { eyebrow: "VOTRE IDENTITÉ", title: "Profil du compte", description: "Mettez à jour les informations associées à votre espace FATA." },
  address: { eyebrow: "LIVRAISON PLUS RAPIDE", title: "Coordonnées et adresse par défaut", description: "Ces informations préremplissent votre prochain checkout. Vous pourrez les modifier avant chaque commande." },
  security: { eyebrow: "SÉCURITÉ", title: "Mot de passe", description: "Confirmez votre mot de passe actuel pour en choisir un nouveau." },
};

export default function AccountSettings({ section }: { section: SettingsSection }) {
  const { user, retrySession } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [city, setCity] = useState(user?.defaultCity ?? "");
  const [address, setAddress] = useState(user?.defaultAddress ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setName(user?.name ?? "");
    setPhone(user?.phone ?? "");
    setCity(user?.defaultCity ?? "");
    setAddress(user?.defaultAddress ?? "");
  }, [user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      if (section === "security") {
        await apiRequest("/auth/password", {
          method: "PATCH",
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        setCurrentPassword("");
        setNewPassword("");
        setSuccess("Votre mot de passe a été mis à jour.");
      } else {
        await apiRequest("/auth/profile", {
          method: "PATCH",
          body: JSON.stringify({
            name: name.trim() || user?.name,
            phone: phone.trim(),
            ...(section === "address" ? { defaultCity: city.trim(), defaultAddress: address.trim() } : {}),
          }),
        });
        await retrySession();
        setSuccess(section === "address" ? "Vos coordonnées de livraison ont été enregistrées." : "Votre profil a été enregistré.");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d'enregistrer ces paramètres.");
    } finally {
      setSaving(false);
    }
  }

  const heading = headings[section];
  const Icon = section === "profile" ? UserRound : section === "address" ? MapPin : KeyRound;

  return <section className="workspace-panel full-panel account-settings-panel">
    <div className="workspace-panel-heading account-settings-heading"><span className="settings-heading-icon"><Icon size={18}/></span><div><span className="eyebrow">{heading.eyebrow}</span><h3>{heading.title}</h3><p>{heading.description}</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {success && <p className="form-success" role="status"><Check size={15}/>{success}</p>}
    <form className="settings-form" onSubmit={submit}>
      {section === "profile" && <>
        <label>Nom affiché<input value={name} onChange={event => setName(event.target.value)} required minLength={2} maxLength={100} autoComplete="name"/></label>
        <label>Adresse e-mail<input value={user?.email ?? ""} readOnly autoComplete="email"/><small>Contacte l’équipe FATA pour modifier l’adresse de connexion.</small></label>
        <label>Téléphone<input value={phone} onChange={event => setPhone(event.target.value)} maxLength={30} autoComplete="tel" placeholder="07 00 00 00 00"/></label>
      </>}
      {section === "address" && <>
        <label>Téléphone de réception<input value={phone} onChange={event => setPhone(event.target.value)} maxLength={30} autoComplete="tel" placeholder="07 00 00 00 00" required/></label>
        <label>Ville / commune<input value={city} onChange={event => setCity(event.target.value)} maxLength={100} autoComplete="address-level2" placeholder="Abidjan" required/></label>
        <label className="wide-field">Adresse par défaut<input value={address} onChange={event => setAddress(event.target.value)} maxLength={250} autoComplete="street-address" placeholder="Commune, quartier, rue et repère" required/></label>
      </>}
      {section === "security" && <>
        <label>Mot de passe actuel<input type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} autoComplete="current-password" required maxLength={128}/></label>
        <label>Nouveau mot de passe<input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" required minLength={12} maxLength={128}/><small>12 caractères minimum.</small></label>
      </>}
      <div className="settings-form-actions"><button className="button button-dark" type="submit" disabled={saving}>{saving ? <><span className="button-spinner"/> Enregistrement…</> : <>Enregistrer <Save size={15}/></>}</button></div>
    </form>
  </section>;
}
