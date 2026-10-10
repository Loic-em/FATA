import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Flag, MessageCircle, RefreshCw, Send, ShieldAlert, X } from "lucide-react";
import { ApiError, apiRequest } from "../data/api";

type Participant = { id: string; name: string };
type Conversation = {
  id: string;
  status: "OPEN" | "CLOSED" | "SUSPENDED";
  client: Participant;
  seller: Participant;
  product: { id: string; name: string; image: string | null };
  order: { id: string; status: string } | null;
  lastMessage: { id: string; body: string; senderId: string; createdAt: string } | null;
  unreadCount: number;
};
type Message = {
  id: string;
  body: string;
  senderId: string;
  sender: Participant;
  createdAt: string;
  reports: { id: string }[];
};
type MessageRole = "client" | "vendeur";
type ReportReason = "HARASSMENT" | "SCAM" | "OFF_PLATFORM" | "OTHER";

const pendingConversationRequests = new Map<string, Promise<{ id: string }>>();

function getOrCreateConversation(role: MessageRole, productId: string, orderId?: string) {
  const key = `${role}:${productId}:${orderId ?? ""}`;
  const existing = pendingConversationRequests.get(key);
  if (existing) return existing;

  const request = apiRequest<{ id: string }>("/conversations", {
    method: "POST",
    body: JSON.stringify({
      productId,
      ...(orderId ? { orderId } : {}),
    }),
  }).finally(() => {
    if (pendingConversationRequests.get(key) === request) pendingConversationRequests.delete(key);
  });
  pendingConversationRequests.set(key, request);
  return request;
}

const reportLabels: Record<ReportReason, string> = {
  HARASSMENT: "Harcèlement ou contenu inapproprié",
  SCAM: "Tentative d’escroquerie",
  OFF_PLATFORM: "Paiement ou transaction hors FATA",
  OTHER: "Autre motif",
};

export default function Messaging({
  role,
  initialProductId,
  initialOrderId,
  initialConversationId,
}: {
  role: MessageRole;
  initialProductId?: string;
  initialOrderId?: string;
  initialConversationId?: string;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [pendingMessage, setPendingMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);
  const [reportMessageId, setReportMessageId] = useState("");

  const loadConversations = useCallback(async () => {
    const rows = await apiRequest<Conversation[]>("/conversations");
    setConversations(rows);
    return rows;
  }, []);

  async function refreshInbox() {
    setRefreshing(true);
    setError("");
    try {
      await loadConversations();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Actualisation impossible.");
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    async function initialize() {
      try {
        const rows = await loadConversations();
        let selectedConversationId = initialConversationId;
        if (initialProductId) {
          const conversation = await getOrCreateConversation(role, initialProductId, initialOrderId);
          const refreshedRows = await loadConversations();
          if (!refreshedRows.some(row => row.id === conversation.id)) {
            throw new Error("La conversation vient d’être créée mais ne figure pas dans votre liste. Actualisez pour réessayer.");
          }
          selectedConversationId = conversation.id;
        }
        if (mounted) setSelectedId(selectedConversationId || rows[0]?.id || "");
      } catch (reason) {
        if (mounted) setError(reason instanceof Error ? reason.message : "Impossible de charger vos messages.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void initialize();
    return () => { mounted = false; };
  }, [initialConversationId, initialOrderId, initialProductId, loadConversations]);

  const selected = conversations.find(conversation => conversation.id === selectedId) ?? null;

  useEffect(() => {
    if (messageListRef.current) messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages, pendingMessage]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    let mounted = true;
    setLoadingThread(true);
    setError("");
    Promise.all([
      apiRequest<Message[]>(`/conversations/${encodeURIComponent(selectedId)}/messages`),
      apiRequest(`/conversations/${encodeURIComponent(selectedId)}/read`, { method: "PATCH" }),
    ]).then(([rows]) => {
      if (mounted) setMessages(rows);
      return loadConversations();
    }).catch(reason => {
      if (mounted) setError(reason instanceof Error ? reason.message : "Impossible d’ouvrir cette conversation.");
    }).finally(() => { if (mounted) setLoadingThread(false); });
    return () => { mounted = false; };
  }, [loadConversations, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    let mounted = true;
    const refreshThread = async () => {
      try {
        const rows = await apiRequest<Message[]>(`/conversations/${encodeURIComponent(selectedId)}/messages`);
        await apiRequest(`/conversations/${encodeURIComponent(selectedId)}/read`, { method: "PATCH" });
        if (mounted) setMessages(rows);
        await loadConversations();
      } catch (reason) {
        if (mounted) setError(reason instanceof Error ? reason.message : "Actualisation des messages impossible.");
      }
    };
    const timer = window.setInterval(() => void refreshThread(), 15_000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, [loadConversations, selectedId]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    setError("");
    setNotice("");
    const submittedMessage = draft.trim();
    setPendingMessage(submittedMessage);
    try {
      await apiRequest(`/conversations/${encodeURIComponent(selectedId)}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: submittedMessage }),
      });
      setDraft("");
      await Promise.all([
        apiRequest<Message[]>(`/conversations/${encodeURIComponent(selectedId)}/messages`).then(setMessages),
        loadConversations(),
      ]);
      setPendingMessage("");
      setNotice("Message envoyé.");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : reason instanceof Error ? reason.message : "Impossible d’envoyer ce message.");
      setPendingMessage("");
    } finally {
      setSending(false);
    }
  }

  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!reportMessageId) return;
    setError("");
    try {
      await apiRequest(`/messages/${encodeURIComponent(reportMessageId)}/report`, {
        method: "POST",
        body: JSON.stringify({
          reason: String(form.get("reason")) as ReportReason,
          details: String(form.get("details") || "").trim(),
        }),
      });
      setReportMessageId("");
      setNotice("Merci. Le signalement a été transmis à l’équipe FATA.");
      const rows = await apiRequest<Message[]>(`/conversations/${encodeURIComponent(selectedId)}/messages`);
      setMessages(rows);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Impossible d’envoyer ce signalement.");
    }
  }

  return <section className="workspace-panel full-panel messaging-panel">
    <div className="workspace-panel-heading messaging-heading">
      <div><span className="eyebrow">ÉCHANGES SÉCURISÉS FATA</span><h3>Messages</h3></div>
      <button type="button" onClick={() => void refreshInbox()} disabled={refreshing} aria-label="Actualiser les conversations"><RefreshCw className={refreshing ? "icon-spinning" : ""} size={16}/></button>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="form-success" role="status">{notice}</p>}
    <div className="messaging-layout">
      <aside className={`conversation-list ${selectedId ? "has-selection" : ""}`} aria-label="Conversations">
        {loading ? <p aria-busy="true">Chargement des conversations…</p> : conversations.length ? conversations.map(conversation => {
          const other = role === "client" ? conversation.seller : conversation.client;
          return <button type="button" key={conversation.id} className={`conversation-list-item ${selectedId === conversation.id ? "selected" : ""}`} onClick={() => { setSelectedId(conversation.id); setNotice(""); }}>
            <span className="conversation-avatar">{other.name.slice(0, 1).toUpperCase()}</span>
            <span className="conversation-list-copy"><strong>{other.name}</strong><small>{conversation.product.name}</small><small className="conversation-preview">{conversation.lastMessage?.body ?? "Démarrer la conversation"}</small></span>
            <span className="conversation-list-meta">{conversation.lastMessage && <small>{new Date(conversation.lastMessage.createdAt).toLocaleDateString("fr-FR")}</small>}{conversation.unreadCount > 0 && <b>{conversation.unreadCount}</b>}</span>
          </button>;
        }) : <div className="messaging-empty"><MessageCircle size={22}/><strong>Aucun message pour le moment.</strong><span>Vous pouvez contacter un vendeur depuis une fiche produit.</span></div>}
      </aside>
      <div className={`conversation-thread ${selectedId ? "thread-open" : ""}`}>
        {selected ? <>
          <header className="conversation-thread-header">
            <div className="conversation-avatar">{(role === "client" ? selected.seller.name : selected.client.name).slice(0, 1).toUpperCase()}</div>
            <div><strong>{role === "client" ? selected.seller.name : selected.client.name}</strong><small>À propos de {selected.product.name}{selected.order && ` · Commande ${selected.order.id}`}</small></div>
            {selected.status !== "OPEN" && <span className="status-pill status-pending">Conversation fermée</span>}
            <button className="conversation-back" type="button" onClick={() => setSelectedId("")} aria-label="Retour aux conversations"><ArrowLeft size={18}/></button>
          </header>
          <div className="conversation-context"><span>Produit</span><strong>{selected.product.name}</strong>{selected.order && <><span>Commande</span><strong>{selected.order.id}</strong></>}</div>
          <div className="message-list" aria-live="polite" ref={messageListRef}>
            {loadingThread ? <p className="loading-state" aria-busy="true"><span className="loading-spinner"/> Chargement des messages…</p> : messages.length ? messages.map(message => {
              const own = message.senderId === (role === "client" ? selected.client.id : selected.seller.id);
              return <article key={message.id} className={`message-bubble ${own ? "message-own" : ""}`}>
                <div className="message-meta"><strong>{own ? "Vous" : message.sender.name}</strong><time>{new Date(message.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</time></div>
                <p>{message.body}</p>
                {!own && <button className="message-report-button" type="button" onClick={() => setReportMessageId(message.id)} disabled={message.reports.length > 0} aria-label={message.reports.length ? "Message déjà signalé" : "Signaler ce message"}>{message.reports.length ? "Signalé" : <><Flag size={13}/> Signaler</>}</button>}
              </article>;
            }) : <div className="messaging-empty"><MessageCircle size={22}/><strong>La conversation commence ici.</strong><span>Échangez au sujet du produit et de sa disponibilité.</span></div>}
            {pendingMessage && <article className="message-bubble message-own message-sending"><div className="message-meta"><strong>Vous</strong><time>À l’instant</time></div><p>{pendingMessage}</p><small>Envoi du message…</small></article>}
          </div>
          <div className="messaging-safety-note"><ShieldAlert size={15}/><span>Pour votre sécurité, gardez vos paiements et coordonnées dans FATA. Les liens, numéros et demandes de paiement hors plateforme sont bloqués.</span></div>
          <form className="message-compose" onSubmit={event => void send(event)}>
            <label className="sr-only" htmlFor="message-draft">Votre message</label>
            <textarea id="message-draft" value={draft} onChange={event => setDraft(event.target.value)} rows={2} maxLength={2000} placeholder="Écrire un message…" disabled={sending || selected.status !== "OPEN"} required/>
            <span>{draft.length}/2000</span>
            <button type="submit" className="button button-dark" disabled={sending || selected.status !== "OPEN" || !draft.trim()}>{sending ? <><span className="button-spinner"/> Envoi…</> : "Envoyer"} {!sending && <Send size={15}/>}</button>
          </form>
        </> : <div className="messaging-empty thread-placeholder"><MessageCircle size={25}/><strong>Sélectionnez une conversation</strong><span>Les échanges avec les boutiques apparaîtront ici.</span></div>}
      </div>
    </div>
    {reportMessageId && <div className="report-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setReportMessageId(""); }}>
      <form className="report-modal" onSubmit={event => void submitReport(event)} aria-labelledby="report-title">
        <button className="report-modal-close" type="button" onClick={() => setReportMessageId("")} aria-label="Fermer"><X size={18}/></button>
        <span className="eyebrow">PROTÉGEONS LA COMMUNAUTÉ</span><h3 id="report-title">Signaler ce message</h3>
        <label>Motif<select name="reason" defaultValue="OTHER">{Object.entries(reportLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Expliquez-nous<input name="details" required minLength={8} maxLength={500} placeholder="Décrivez brièvement le problème."/></label>
        <button className="button button-dark" type="submit">Envoyer le signalement <Flag size={15}/></button>
      </form>
    </div>}
  </section>;
}
