import { useState, type FormEvent } from "react";
import { ArrowRight, ChevronDown, CircleHelp, Mail, MessageCircle, Send } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { apiRequest } from "../data/api";

const faqs = [
  ["Comment acheter sur FATA ?", "Parcourez le catalogue, ouvrez une fiche produit et ajoutez vos trouvailles au panier. Connectez-vous à l'espace client pour enregistrer une commande. Les paiements sont actuellement en mode sandbox : aucun paiement réel n'est encaissé et une commande de test ne déclenche pas de livraison."],
  ["Qui vend les produits ?", "FATA rassemble des boutiques et des créateurs indépendants. Les boutiques présentées ici sont des exemples destinés à illustrer la plateforme."],
  ["Quels sont les délais de livraison ?", "Après confirmation d'un paiement réel, la boutique met à jour les étapes de préparation et d'expédition dans FATA. Les délais et frais définitifs restent à confirmer avec chaque boutique avant l'ouverture commerciale."],
  ["Puis-je contacter une boutique ?", "Ouvrez une fiche produit et choisissez « Contacter le vendeur ». Les échanges restent dans FATA ; les coordonnées, liens et paiements hors plateforme sont bloqués."],
  ["Puis-je suivre une commande ?", "Les commandes sont visibles dans votre espace FATA. Une fois le paiement réel confirmé, vous y verrez les étapes de préparation, d'expédition ou de retrait mises à jour par la boutique."],
  ["Les espaces client et vendeur sont-ils les mêmes ?", "Non. Le compte client sert à commander, suivre ses achats et contacter les boutiques. Le compte vendeur sert à gérer sa boutique et ses produits. Une adresse e-mail ne peut être associée qu'à un seul de ces rôles ; utilisez une autre adresse pour créer votre second compte."],
  ["Comment ouvrir une boutique ?", "Créez un compte vendeur dans l'espace vendeur. Votre demande est transmise à l'administration FATA pour validation."],
  ["Quels moyens de paiement sont acceptés ?", "GeniusPay est actuellement en mode sandbox : les transactions sont simulées et aucun paiement réel n'est encaissé. Ne transmettez jamais d'argent à un vendeur par message."],
];

export function HelpPage() {
  const [open, setOpen] = useState<number | null>(0);
  return <section className="help-page"><div className="page-container"><div className="help-intro"><div className="help-icon"><CircleHelp size={24}/></div><span className="eyebrow">ON EST LÀ POUR VOUS</span><h1>Une question ?<br/><em>On vous répond.</em></h1><p>Les réponses aux questions les plus fréquentes sur l'expérience FATA.</p></div><div className="faq-layout"><div className="faq-list">{faqs.map(([question, answer], index) => <article className={`faq-item ${open === index ? "faq-open" : ""}`} key={question}><button onClick={() => setOpen(open === index ? null : index)} aria-expanded={open === index}><span><small>0{index + 1}</small>{question}</span><ChevronDown size={19}/></button>{open === index && <p>{answer}</p>}</article>)}</div><aside className="faq-contact-card"><span className="eyebrow">BESOIN D'UN COUP DE MAIN ?</span><MessageCircle size={23}/><h2>Parlons-en.</h2><p>Envoyez votre demande depuis le formulaire de contact. L'équipe FATA la retrouvera dans son espace d'administration.</p><Link to="/contact" className="text-link">Nous écrire <ArrowRight size={15}/></Link></aside></div></div></section>;
}

export function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSending(true);
    setError("");
    try {
      await apiRequest("/contact", {
        method: "POST",
        body: JSON.stringify({
          name: values.get("name"),
          email: values.get("email"),
          subject: values.get("subject"),
          message: values.get("message"),
        }),
      });
      setSubmitted(true);
      form.reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Votre message n'a pas pu être envoyé. Réessayez dans un instant.");
    } finally {
      setSending(false);
    }
  }
  return <section className="contact-page"><div className="page-container contact-layout"><div className="contact-intro"><span className="eyebrow">ON RESTE EN CONTACT</span><h1>Écrivez-nous<br/><em>un petit mot.</em></h1><p>Une question sur une boutique, une idée à partager ou envie de rejoindre FATA ? Nous serons ravis de vous lire.</p><div className="contact-note"><Mail size={19}/><span><strong>Votre demande est suivie par FATA.</strong><small>Un administrateur pourra vous répondre à l'adresse indiquée.</small></span></div><div className="contact-symbol">✳</div></div><form className="contact-form" onSubmit={submit}><span className="eyebrow">VOTRE MESSAGE</span><label>Votre nom<input name="name" autoComplete="name" required maxLength={120} placeholder="Comment vous appelez-vous ?"/></label><label>Votre e-mail<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="vous@exemple.com"/></label><label>Le sujet<select name="subject" defaultValue="GENERAL"><option value="GENERAL">Une question générale</option><option value="SELLER">Devenir vendeur</option><option value="ORDER">Une commande</option><option value="OTHER">Autre</option></select></label><label>Votre message<textarea name="message" rows={5} required minLength={10} maxLength={2000} placeholder="Racontez-nous…"/></label>{error && <p className="form-error" role="alert">{error}</p>}{submitted && <p className="form-success" role="status">Merci pour votre message. Il a bien été transmis à l'équipe FATA.</p>}<button className="button button-dark" type="submit" disabled={sending}>{sending ? "Envoi en cours…" : submitted ? "Envoyer un autre message" : "Envoyer le message"} <Send size={15}/></button><small>Votre demande sera accessible à l'équipe d'administration FATA.</small></form></div></section>;
}

export function LegalPage() {
  const { slug = "informations" } = useParams();
  const content: Record<string, { eyebrow: string; title: string; intro: string; sections: [string, string][] }> = {
    livraison: { eyebrow: "INFORMATIONS PRATIQUES", title: "Livraison & retours", intro: "Les modalités définitives seront précisées après le choix des zones couvertes et des partenaires logistiques.", sections: [["Livraison", "Les délais et frais de livraison affichés dans cette maquette sont des estimations de démonstration. Ils ne constituent pas un engagement de livraison."], ["Retours et remboursements", "La politique de retour, les délais de réclamation et les modalités de remboursement restent à définir avant le lancement commercial."], ["Suivi", "Le suivi des colis nécessite une intégration avec les vendeurs et les partenaires de livraison de FATA."]] },
    confidentialite: { eyebrow: "VOTRE CONFIANCE COMPTE", title: "Confidentialité", intro: "FATA enregistre les données nécessaires au compte, aux commandes, à la messagerie et aux demandes envoyées via le formulaire de contact. La politique définitive doit être validée avant le lancement commercial.", sections: [["Données et statistiques", "Les comptes, commandes, avis, conversations, messages, demandes de contact, signalements et notifications sont enregistrés dans la base de données FATA. Les demandes de contact sont visibles par l'équipe d'administration et peuvent être traitées en répondant à l'adresse fournie. Un message privé n'est visible que par les membres de la conversation ; l'équipe d'administration peut consulter le contexte d'un signalement pour le modérer. FATA conserve également des compteurs journaliers agrégés de visites, vues et interactions. Les avis publics sont liés à une commande payée et le nom public est abrégé."], ["Conservation", "Les conversations et demandes de contact restent consultables par l'administration ; aucun effacement automatique n'est actuellement configuré. La durée de conservation, les demandes de suppression et les coordonnées d'exercice des droits doivent être définies et publiées avant le lancement."], ["Sécurité", "Les accès sont protégés par compte et rôle. FATA bloque les liens, coordonnées et demandes de paiement hors plateforme dans les messages. Les mots de passe sont hachés côté serveur ; ne partagez jamais d'informations sensibles dans une conversation."]] },
    conditions: { eyebrow: "INFORMATIONS JURIDIQUES", title: "Conditions générales", intro: "Les présentes informations de maquette ne constituent pas des conditions de vente. Les textes définitifs sont à valider avant le lancement.", sections: [["Vendeurs et produits", "Les boutiques et produits illustrés sont des exemples. La vérification des vendeurs et la modération des produits devront être opérées par le service FATA."], ["Commande et paiement", "Les demandes de commande sont enregistrées dans FATA, mais GeniusPay reste en mode sandbox : aucune somme n'est encaissée et une commande de test ne déclenche pas la préparation ni la livraison."], ["Mise à jour", "Les conditions de vente, d'utilisation et de médiation seront publiées après validation des règles métier et des obligations applicables."]] },
  };
  const page = content[slug] || { eyebrow: "INFORMATIONS FATA", title: "À bientôt ici.", intro: "Cette rubrique sera complétée avant le lancement de FATA.", sections: [["En préparation", "Les informations de cette page sont en cours de définition."]] as [string, string][] };
  return <section className="legal-page"><div className="page-container"><div className="breadcrumb"><Link to="/">Accueil</Link><span>/</span><span>{page.title}</span></div><div className="legal-content"><span className="eyebrow">{page.eyebrow}</span><h1>{page.title}<span className="brand-period">.</span></h1><p className="legal-intro">{page.intro}</p>{page.sections.map(([title, text]) => <article key={title}><h2>{title}</h2><p>{text}</p></article>)}<Link to="/aide" className="text-link">Consulter le centre d'aide <ArrowRight size={15}/></Link></div></div></section>;
}

export default HelpPage;
