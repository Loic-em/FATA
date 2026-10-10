import { useEffect, useState } from "react";
import { ArrowRight, BadgeCheck, Check, RefreshCw } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ApiError, apiRequest, getOrderStatusLabel, type ApiOrder } from "../data/api";
import { formatPrice } from "../data/orders";

export default function Confirmation() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const paymentResult = searchParams.get("payment");
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [error, setError] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  useEffect(() => {
    let active = true;
    if (!id) return;
    apiRequest<ApiOrder>(`/orders/${encodeURIComponent(id)}`)
      .then(value => { if (active) setOrder(value); })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof ApiError && reason.status === 401
          ? "Connectez-vous au compte utilisé pour cette demande."
          : reason instanceof Error ? reason.message : "Impossible de retrouver cette demande.");
      });
    return () => { active = false; };
  }, [id]);

  useEffect(() => {
    if (!id || !order || order.status !== "AWAITING_PAYMENT" || paymentResult !== "success") return;
    const orderId = id;
    let active = true;
    let timer: number | undefined;
    setPaymentBusy(true);
    setPaymentMessage("Retour de GeniusPay reçu. Vérification du paiement…");

    async function verifyAfterRedirect() {
      for (let attempt = 0; attempt < 5 && active; attempt++) {
        try {
          const result = await apiRequest<{ orderStatus: string; paymentStatus: string }>(`/payments/geniuspay/orders/${encodeURIComponent(orderId)}`);
          if (!active) return;
          const updatedOrder = await apiRequest<ApiOrder>(`/orders/${encodeURIComponent(orderId)}`);
          if (!active) return;
          if (result.orderStatus === "TEST_PAID" || updatedOrder.status === "TEST_PAID") {
            setPaymentBusy(false);
            setOrder(updatedOrder);
            setPaymentMessage("Paiement sandbox confirmé par GeniusPay. Aucun encaissement réel n'a été effectué.");
            return;
          }
          setOrder(updatedOrder);
          if (result.paymentStatus === "FAILED") {
            setPaymentMessage("GeniusPay a indiqué que le paiement a échoué. Vous pouvez réessayer.");
            return;
          }
        } catch (reason) {
          if (!active) return;
          if (attempt === 4) {
            setPaymentMessage(reason instanceof Error ? reason.message : "Vérification du paiement impossible.");
            return;
          }
        }
        if (attempt < 4 && active) {
          await new Promise<void>(resolve => { timer = window.setTimeout(resolve, 2000); });
        }
      }
      if (active) setPaymentMessage("Le paiement n'est pas encore confirmé. Vous pouvez vérifier à nouveau dans quelques instants.");
    }

    void verifyAfterRedirect().finally(() => { if (active) setPaymentBusy(false); });
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [id, order?.id, order?.status, paymentResult]);

  useEffect(() => {
    if (paymentResult === "error") {
      setPaymentMessage("Le paiement n'a pas été confirmé. Vérifiez le statut ou réessayez.");
    }
  }, [paymentResult]);

  async function startSandboxPayment() {
    if (!order) return;
    setPaymentBusy(true);
    setPaymentMessage("");
    try {
      const checkout = await apiRequest<{ paymentUrl: string; mode: "sandbox" }>(`/payments/geniuspay/orders/${encodeURIComponent(order.id)}`, { method: "POST" });
      window.location.assign(checkout.paymentUrl);
    } catch (reason) {
      setPaymentMessage(reason instanceof Error ? reason.message : "Impossible de démarrer le paiement de test.");
      setPaymentBusy(false);
    }
  }

  async function verifySandboxPayment() {
    if (!order) return;
    setPaymentBusy(true);
    setPaymentMessage("");
    try {
      const result = await apiRequest<{ orderStatus: string; paymentStatus: string }>(`/payments/geniuspay/orders/${encodeURIComponent(order.id)}`);
      const updatedOrder = await apiRequest<ApiOrder>(`/orders/${encodeURIComponent(order.id)}`);
      setOrder(updatedOrder);
      setPaymentMessage(result.orderStatus === "TEST_PAID" || updatedOrder.status === "TEST_PAID"
        ? "Paiement sandbox confirmé par GeniusPay. Aucun encaissement réel n’a été effectué."
        : result.paymentStatus === "FAILED"
          ? "GeniusPay a indiqué que le paiement a échoué. Vous pouvez réessayer."
          : "GeniusPay n’a pas encore confirmé ce paiement. Réessayez après le retour du prestataire.");
    } catch (reason) {
      setPaymentMessage(reason instanceof Error ? reason.message : "Vérification du paiement impossible.");
    } finally {
      setPaymentBusy(false);
    }
  }

  async function simulateSandboxPayment(outcome: "SUCCESS" | "FAILED" | "PENDING") {
    if (!order) return;
    setPaymentBusy(true);
    setPaymentMessage("");
    try {
      const result = await apiRequest<{ orderStatus: string; paymentStatus: string; simulation: true }>(`/payments/simulation/orders/${encodeURIComponent(order.id)}`, {
        method: "POST",
        body: JSON.stringify({ outcome }),
      });
      const updatedOrder = await apiRequest<ApiOrder>(`/orders/${encodeURIComponent(order.id)}`);
      setOrder(updatedOrder);
      setPaymentMessage(result.orderStatus === "TEST_PAID"
        ? "Simulation réussie : aucun argent réel n'a été déplacé. Le vendeur peut maintenant tester la préparation et la livraison."
        : result.paymentStatus === "FAILED"
          ? "Échec simulé : la commande reste en attente et vous pouvez réessayer."
          : "Paiement simulé en attente : la commande n'est pas encore confirmée.");
    } catch (reason) {
      setPaymentMessage(reason instanceof Error ? reason.message : "Impossible de simuler ce paiement.");
    } finally {
      setPaymentBusy(false);
    }
  }

  return <section className="confirmation-page"><div className="confirmation-card">
    <div className="confirmation-icon"><BadgeCheck size={34}/></div>
    <span className="eyebrow">DEMANDE DE COMMANDE</span>
    <h1>{order ? <>Votre demande<br/><em>est enregistrée.</em></> : <>Une belle trouvaille<br/><em>se prépare.</em></>}</h1>
    {error ? <p role="alert">{error}</p> : !order ? <p aria-busy="true">Chargement de votre demande…</p> : <>
      <p>Votre demande est enregistrée dans votre espace FATA.</p>
      <div className="confirmation-order"><span>Référence</span><strong>{order.id}</strong><span>Montant de test</span><strong>{formatPrice(order.total)}</strong><span>Articles</span><strong>{order.items.reduce((count, item) => count + item.quantity, 0)}</strong><span>Statut</span><strong>{getOrderStatusLabel(order.status)}</strong></div>
      {order.status === "AWAITING_PAYMENT" ? <>
        <div className="confirmation-disclaimer">Mode sandbox : aucun débit réel. La simulation locale permet aussi de tester la préparation et le suivi de livraison.</div>
        {paymentMessage && <p role="status">{paymentMessage}</p>}
        <div className="payment-simulation-panel">
          <span className="eyebrow">SIMULATION SANS ARGENT</span>
          <button className="button button-dark" type="button" disabled={paymentBusy} onClick={() => void simulateSandboxPayment("SUCCESS")}>
            {paymentBusy ? "Simulation…" : "Simuler un paiement réussi"} <Check size={16}/>
          </button>
          <div className="payment-simulation-secondary">
            <button className="button button-outline" type="button" disabled={paymentBusy} onClick={() => void simulateSandboxPayment("FAILED")}>Simuler un échec</button>
            <button className="button button-outline" type="button" disabled={paymentBusy} onClick={() => void simulateSandboxPayment("PENDING")}>Simuler une attente</button>
          </div>
        </div>
        <details className="provider-sandbox-details">
          <summary>Tester aussi le checkout GeniusPay sandbox</summary>
          <p>Ce parcours utilise les clés sandbox GeniusPay configurées côté API.</p>
          <button className="button button-outline" type="button" disabled={paymentBusy} onClick={() => void startSandboxPayment()}>{paymentBusy ? "Connexion à GeniusPay…" : "Ouvrir GeniusPay sandbox"} <ArrowRight size={17}/></button>
          <button className="button button-outline" type="button" disabled={paymentBusy} onClick={() => void verifySandboxPayment()}><RefreshCw size={14}/> Vérifier le résultat</button>
        </details>
      </> : order.status === "TEST_PAID" && <div className="confirmation-disclaimer"><strong>Simulation réussie — 0 FCFA encaissé.</strong><br/>La commande de test peut maintenant suivre le parcours vendeur et livraison. Elle reste exclue des revenus et avis vérifiés.</div>}
    </>}
    {error.includes("Connectez-vous") && <Link className="button button-outline" to={`/client/connexion?return=${encodeURIComponent(`/confirmation/${id ?? ""}`)}`}>Se connecter comme client</Link>}
    <Link className="button button-outline" to="/catalogue">Continuer les découvertes <ArrowRight size={17}/></Link>
  </div></section>;
}
