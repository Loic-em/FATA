import {
  BadRequestException,
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/jwt.strategy";

const GENIUSPAY_API = "https://geniuspay.ci/api/v1/merchant";
const CURRENCY = "XOF";

type GeniusPayConfig = {
  apiKey: string;
  apiSecret: string;
  returnUrl: string;
};

type GeniusPayPayment = {
  reference?: string;
  amount?: number | string;
  currency?: string;
  status?: string;
  checkout_url?: string;
  payment_url?: string;
  environment?: string;
  metadata?: Record<string, unknown>;
};

type GeniusPayResponse<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  getAdminConfig() {
    const mode = this.config.get<string>("GENIUSPAY_MODE")?.trim() ?? "disabled";
    const apiKey = this.config.get<string>("GENIUSPAY_API_KEY")?.trim() ?? "";
    const apiSecret = this.config.get<string>("GENIUSPAY_API_SECRET")?.trim() ?? "";
    const apiKeyConfigured = apiKey.startsWith("pk_sandbox_") || apiKey.startsWith("sk_sandbox_");
    const apiSecretConfigured = apiSecret.startsWith("sk_sandbox_") || apiSecret.startsWith("ss");
    const compatibleApiPair = this.hasSandboxApiPair(apiKey, apiSecret);
    const webhookSecretConfigured = Boolean(this.getWebhookSecret());
    const webhookUrl = this.config.get<string>("GENIUSPAY_WEBHOOK_URL")?.trim() ?? "";
    const webhookUrlConfigured = this.isHttpsUrl(webhookUrl)
      && !webhookUrl.includes("your-public-test-host.example");
    return {
      mode,
      simulationEnabled: mode !== "live",
      configured: mode === "sandbox" && compatibleApiPair
        && webhookSecretConfigured && webhookUrlConfigured,
      apiKeyConfigured,
      apiSecretConfigured,
      webhookSecretConfigured,
      webhookUrlConfigured,
    };
  }

  async simulatePayment(user: AuthenticatedUser, orderId: string, outcome: "SUCCESS" | "FAILED" | "PENDING") {
    const mode = this.config.get<string>("GENIUSPAY_MODE")?.trim();
    if (mode === "live") {
      throw new ServiceUnavailableException("La simulation locale est désactivée hors sandbox.");
    }

    return this.prisma.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} AND "customerId" = ${user.id} FOR UPDATE`;
      const order = await transaction.order.findFirst({ where: { id: orderId, customerId: user.id } });
      if (!order) throw new NotFoundException("Commande introuvable.");
      if (order.status !== "AWAITING_PAYMENT") {
        throw new ConflictException("Cette commande ne peut plus recevoir de simulation de paiement.");
      }

      const transactionId = `FATASIM${randomUUID().replaceAll("-", "").slice(0, 20)}`;
      const status = outcome === "SUCCESS" ? "SUCCEEDED" : outcome === "FAILED" ? "FAILED" : "PENDING";
      await transaction.paymentAttempt.create({
        data: {
          orderId: order.id,
          transactionId,
          amount: order.total,
          currency: CURRENCY,
          status,
          ...(outcome === "SUCCESS" ? { paidAt: new Date() } : {}),
        },
      });

      if (outcome === "SUCCESS") {
        await transaction.order.update({
          where: { id: order.id },
          data: { status: "TEST_PAID", paymentMethod: "SIMULATION" },
        });
      }

      return {
        transactionId,
        orderStatus: outcome === "SUCCESS" ? "TEST_PAID" : "AWAITING_PAYMENT",
        paymentStatus: status,
        mode: "sandbox" as const,
        simulation: true as const,
      };
    });
  }

  async startCheckout(user: AuthenticatedUser, orderId: string) {
    const config = this.requireApiConfig();
    const reservation = await this.prisma.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${orderId} AND "customerId" = ${user.id} FOR UPDATE`;
      const order = await transaction.order.findFirst({
        where: { id: orderId, customerId: user.id },
        include: {
          customer: { select: { name: true, email: true } },
          payments: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      });
      if (!order) throw new NotFoundException("Commande introuvable.");
      if (order.status !== "AWAITING_PAYMENT") {
        throw new ConflictException("Cette commande n’attend plus de paiement.");
      }

      if (order.total < 200) {
        throw new BadRequestException("GeniusPay accepte les paiements à partir de 200 FCFA.");
      }

      const previousAttempt = order.payments[0];
      if (previousAttempt?.status === "INITIALIZING") {
        throw new ConflictException("L’initialisation du paiement est déjà en cours. Réessayez dans un instant.");
      }
      if (previousAttempt?.status === "PENDING" && previousAttempt.providerReference && previousAttempt.checkoutUrl) {
        return {
          kind: "existing" as const,
          transactionId: previousAttempt.transactionId,
          paymentUrl: previousAttempt.checkoutUrl,
        };
      }

      const transactionId = `FATA${randomUUID().replaceAll("-", "").slice(0, 24)}`;
      const attempt = await transaction.paymentAttempt.create({
        data: { orderId: order.id, transactionId, amount: order.total, currency: CURRENCY },
      });
      return { kind: "new" as const, order, attempt };
    });

    if (reservation.kind === "existing") {
      return {
        transactionId: reservation.transactionId,
        paymentUrl: reservation.paymentUrl,
        mode: "sandbox" as const,
      };
    }

    const { order, attempt } = reservation;
    const checkoutUrl = `${config.returnUrl}/confirmation/${encodeURIComponent(order.id)}`;
    let response: GeniusPayResponse<GeniusPayPayment>;
    try {
      response = await this.request<GeniusPayResponse<GeniusPayPayment>>("/payments", {
        method: "POST",
        headers: this.apiHeaders(config),
        body: JSON.stringify({
          amount: order.total,
          currency: CURRENCY,
          description: `Commande FATA ${order.id}`,
          customer: {
            name: order.customer.name,
            email: order.customer.email,
            phone: this.normalizePhone(order.phone),
            country: "CI",
          },
          success_url: `${checkoutUrl}?payment=success`,
          error_url: `${checkoutUrl}?payment=error`,
          metadata: { order_id: order.id, fata_transaction_id: attempt.transactionId },
        }),
      });
    } catch (error) {
      await this.markFailed(attempt.id);
      if (error instanceof BadGatewayException) throw error;
      this.logger.error("GeniusPay checkout initialization failed unexpectedly.");
      throw error;
    }

    const payment = response.data;
    const paymentUrl = payment?.checkout_url ?? payment?.payment_url;
    const providerReference = payment?.reference;
    if (response.success !== true || !paymentUrl || !this.isGeniusPayUrl(paymentUrl)
      || !providerReference || payment?.currency !== CURRENCY || Number(payment.amount) !== order.total) {
      this.logger.warn("GeniusPay checkout initialization returned an incomplete or mismatched payment.");
      await this.markFailed(attempt.id);
      throw new BadGatewayException("GeniusPay n’a pas fourni de lien de paiement valide.");
    }

    await this.prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: { status: "PENDING", checkoutUrl: paymentUrl, providerReference },
    });
    return { transactionId: attempt.transactionId, paymentUrl, mode: "sandbox" as const };
  }

  async getPaymentStatus(user: AuthenticatedUser, orderId: string) {
    this.requireApiConfig();
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId: user.id },
      include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (!order) throw new NotFoundException("Commande introuvable.");
    const attempt = order.payments[0];
    if (!attempt) return { orderStatus: order.status, paymentStatus: "NOT_STARTED" as const };
    if (attempt.status === "INITIALIZING") {
      return { orderStatus: order.status, paymentStatus: attempt.status };
    }
    if (attempt.status === "PENDING" && attempt.providerReference) {
      await this.verifyAndApply(attempt.providerReference);
    }
    const latest = await this.prisma.paymentAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    const updatedOrder = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      select: { status: true },
    });
    return { orderStatus: updatedOrder.status, paymentStatus: latest.status, mode: "sandbox" as const };
  }

  async handleNotification(
    payload: Record<string, unknown>,
    rawBody: Buffer | undefined,
    headers: { signature?: string; timestamp?: string; event?: string; environment?: string },
  ) {
    if (this.config.get<string>("GENIUSPAY_MODE")?.trim() !== "sandbox") {
      throw new ServiceUnavailableException("Les notifications GeniusPay sont disponibles en mode sandbox uniquement.");
    }
    const secret = this.getWebhookSecret();
    if (!secret) throw new ServiceUnavailableException("Le secret webhook GeniusPay n’est pas configuré.");

    const { signature, timestamp, event, environment } = headers;
    const payloadEvent = typeof payload.event === "string" ? payload.event : "";
    const payloadEnvironment = typeof payload.environment === "string" ? payload.environment : "";
    const seconds = Number(timestamp);
    if (!signature || !timestamp || !Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > 300
      || !event || event !== payloadEvent || environment !== "sandbox" || payloadEnvironment !== "sandbox") {
      throw new UnauthorizedException("Notification GeniusPay invalide ou expirée.");
    }

    if (!rawBody?.length) throw new BadRequestException("Le corps brut signé par GeniusPay est introuvable.");
    const signatureHex = signature.replace(/^sha256=/i, "");
    const supplied = /^[a-f0-9]{64}$/i.test(signatureHex) ? Buffer.from(signatureHex, "hex") : Buffer.alloc(0);
    const expected = createHmac("sha256", secret).update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody])).digest();
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw new UnauthorizedException("Signature GeniusPay invalide.");
    }

    if (!["payment.success", "payment.failed", "payment.cancelled", "payment.expired"].includes(event)) {
      return { received: true, ignored: true };
    }

    if (!payload.data || typeof payload.data !== "object") {
      throw new BadGatewayException("Notification GeniusPay incomplète.");
    }
    const payment = payload.data as GeniusPayPayment;
    if (!payment.reference) throw new BadGatewayException("Référence GeniusPay manquante.");
    await this.verifyAndApply(payment.reference);
    return { received: true };
  }

  private async verifyAndApply(providerReference: string) {
    const config = this.requireApiConfig();
    const attempt = await this.prisma.paymentAttempt.findUnique({
      where: { providerReference },
      include: { order: { select: { id: true, status: true } } },
    });
    if (!attempt) throw new NotFoundException("Transaction GeniusPay inconnue.");
    if (attempt.status === "SUCCEEDED" || attempt.status === "FAILED") return;

    const response = await this.request<GeniusPayResponse<GeniusPayPayment>>(
      `/payments/${encodeURIComponent(providerReference)}`,
      { headers: this.apiHeaders(config) },
      7_000,
    );
    const payment = response.data;
    if (response.success !== true || !payment || payment.reference !== providerReference
      || Number(payment.amount) !== attempt.amount || payment.currency !== attempt.currency
      || payment.metadata?.order_id !== attempt.orderId
      || payment.environment !== "sandbox") {
      this.logger.warn("GeniusPay status verification was incomplete or did not match the order.");
      throw new BadGatewayException("GeniusPay n’a pas pu confirmer le statut de cette transaction.");
    }

    if (payment.status === "completed") {
      if (attempt.order.status !== "AWAITING_PAYMENT" && attempt.order.status !== "TEST_PAID") {
        throw new ConflictException("La commande ne peut pas être marquée comme payée.");
      }
      await this.prisma.$transaction(async transaction => {
        await transaction.paymentAttempt.update({
          where: { id: attempt.id },
          data: { status: "SUCCEEDED", paidAt: new Date() },
        });
        if (attempt.order.status === "AWAITING_PAYMENT") {
          await transaction.order.update({
            where: { id: attempt.order.id },
            data: { status: "TEST_PAID", paymentMethod: "GENIUSPAY_SANDBOX" },
          });
        }
      });
      return;
    }

    if (["failed", "cancelled", "expired"].includes(payment.status ?? "")) {
      await this.markFailed(attempt.id);
    }
  }

  private requireApiConfig(): GeniusPayConfig {
    const mode = this.config.get<string>("GENIUSPAY_MODE")?.trim();
    if (mode !== "sandbox") {
      throw new ServiceUnavailableException("Les paiements GeniusPay sont disponibles en mode sandbox uniquement.");
    }
    const apiKey = this.config.get<string>("GENIUSPAY_API_KEY")?.trim();
    const apiSecret = this.config.get<string>("GENIUSPAY_API_SECRET")?.trim();
    const returnUrl = this.config.get<string>("WEB_ORIGIN")?.trim();
    if (!apiKey || !apiSecret || !returnUrl) {
      throw new ServiceUnavailableException("Configuration incomplète : renseignez les clés sandbox GeniusPay dans backend/.env.");
    }
    if (!this.hasSandboxApiPair(apiKey, apiSecret)) {
      throw new ServiceUnavailableException("Seules les clés sandbox GeniusPay sont autorisées ; les paiements réels sont désactivés.");
    }
    if (!this.isHttpUrl(returnUrl)) {
      throw new ServiceUnavailableException("WEB_ORIGIN doit être une URL HTTP(S) valide pour le retour GeniusPay.");
    }
    return { apiKey, apiSecret, returnUrl: returnUrl.replace(/\/+$/, "") };
  }

  private hasSandboxApiPair(apiKey: string, apiSecret: string) {
    const documentedPair = apiKey.startsWith("pk_sandbox_") && apiSecret.startsWith("sk_sandbox_");
    const dashboardPair = apiKey.startsWith("sk_sandbox_") && apiSecret.startsWith("ss");
    return documentedPair || dashboardPair;
  }

  private apiHeaders(config: GeniusPayConfig) {
    return {
      "X-API-Key": config.apiKey,
      "X-API-Secret": config.apiSecret,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  private async request<T>(path: string, init: RequestInit, timeoutMs = 12_000): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${GENIUSPAY_API}${path}`, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new BadGatewayException("GeniusPay est momentanément injoignable.");
    }
    let payload: T;
    try {
      payload = await response.json() as T;
    } catch {
      throw new BadGatewayException("GeniusPay a renvoyé une réponse illisible.");
    }
    if (!response.ok) throw new BadGatewayException("GeniusPay a refusé la requête de paiement.");
    return payload;
  }

  private async markFailed(attemptId: string) {
    await this.prisma.paymentAttempt.updateMany({
      where: { id: attemptId, status: { in: ["INITIALIZING", "PENDING"] } },
      data: { status: "FAILED" },
    });
  }

  private getWebhookSecret() {
    return this.config.get<string>("GENIUSPAY_WEBHOOK_SECRET_SANDBOX")?.trim()
      || this.config.get<string>("GENIUSPAY_WEBHOOK_SECRET")?.trim()
      || "";
  }

  private normalizePhone(value: string) {
    const digits = value.replace(/\D/g, "");
    if (value.trim().startsWith("+")) return `+${digits}`;
    if (digits.startsWith("00")) return `+${digits.slice(2)}`;
    if (digits.startsWith("225")) return `+${digits}`;
    if (digits.startsWith("0")) return `+225${digits}`;
    return `+225${digits}`;
  }

  private isHttpsUrl(value: string) {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }

  private isGeniusPayUrl(value: string) {
    try {
      const url = new URL(value);
      return url.protocol === "https:"
        && (url.hostname === "geniuspay.ci" || url.hostname.endsWith(".geniuspay.ci"));
    } catch {
      return false;
    }
  }

  private isHttpUrl(value: string) {
    try {
      return ["http:", "https:"].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }
}
