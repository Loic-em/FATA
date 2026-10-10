import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/jwt.strategy";
import { CreateConversationDto } from "./dto/create-conversation.dto";
import { ReportMessageDto } from "./dto/report-message.dto";
import { ReviewMessageReportDto } from "./dto/review-message-report.dto";
import { SendMessageDto } from "./dto/send-message.dto";

const conversationContext = {
  client: { select: { id: true, name: true } },
  seller: { select: { id: true, name: true } },
  product: { select: { id: true, name: true, image: true } },
  order: { select: { id: true } },
} as const;

const prohibitedUrl = /(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:^|\s)[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?/i;
const prohibitedPayment = /\b(?:hors\s+fata|en\s+dehors\s+de\s+fata|paiement\s+direct|pay(?:ez|er)?\s+(?:moi|directement)|envoy(?:ez|er)\s+(?:moi\s+)?l['’]argent|orange\s+money|wave|mtn\s+money|moov\s+money)\b/i;
const contactContext = /\b(?:whatsapp|telegram|téléphone|telephone|mon numéro|mon numero|appelle-moi|appelez-moi|contacte-moi)\b/i;
const phoneLike = /(?:\+\s?\d{1,3}[\s().-]*)?(?:\d[\s().-]*){9,}/;
const ivorianPhone = /(?:\+?225[\s().-]*)?0[1-9](?:[\s().-]*\d){8}\b/;

@Injectable()
export class MessagingService {
  constructor(private readonly prisma: PrismaService) {}

  async listConversations(user: AuthenticatedUser) {
    this.assertMessagingRole(user);
    const conversations = await this.prisma.conversation.findMany({
      where: user.role === "CLIENT" ? { clientId: user.id } : { sellerId: user.id },
      include: {
        ...conversationContext,
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, body: true, senderId: true, createdAt: true },
        },
      },
      orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    });
    if (!conversations.length) return [];

    const unreadCounts = await this.prisma.message.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: { in: conversations.map(conversation => conversation.id) },
        senderId: { not: user.id },
        readAt: null,
      },
      _count: { _all: true },
    });
    const unreadByConversation = new Map(unreadCounts.map(entry => [entry.conversationId, entry._count._all]));
    return conversations.map(conversation => ({
      ...conversation,
      unreadCount: unreadByConversation.get(conversation.id) ?? 0,
      lastMessage: conversation.messages[0] ?? null,
      messages: undefined,
    }));
  }

  async createConversation(user: AuthenticatedUser, dto: CreateConversationDto) {
    this.assertMessagingRole(user);
    this.assertNotSuspended(user);
    if (user.role !== "CLIENT") throw new ForbiddenException("Seuls les clients peuvent ouvrir une discussion depuis un produit.");

    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: { store: { select: { id: true, sellerId: true, status: true } } },
    });
    if (!product || !product.store.sellerId) {
      throw new NotFoundException("Le vendeur de ce produit n’est pas disponible.");
    }
    if (product.store.sellerId === user.id) {
      throw new BadRequestException("Vous ne pouvez pas ouvrir une discussion avec votre propre boutique.");
    }
    if (!product.active && !dto.orderId) {
      throw new NotFoundException("Ce produit n’est plus disponible.");
    }

    let verifiedOrderId: string | undefined;
    if (dto.orderId) {
      const order = await this.prisma.order.findFirst({
        where: {
          id: dto.orderId,
          customerId: user.id,
          items: { some: { productId: product.id, product: { storeId: product.store.id } } },
        },
        select: { id: true },
      });
      if (!order) throw new NotFoundException("Commande introuvable pour ce produit.");
      verifiedOrderId = order.id;
    }
    if (product.store.status !== "APPROVED" && !verifiedOrderId) {
      throw new NotFoundException("Le vendeur de ce produit n’est pas disponible.");
    }

    const conversationKey = {
      clientId: user.id,
      sellerId: product.store.sellerId,
      productId: product.id,
    };
    const existing = await this.prisma.conversation.findUnique({
      where: { clientId_sellerId_productId: conversationKey },
      select: { status: true },
    });
    if (existing && existing.status !== "OPEN") {
      throw new ConflictException("Cette conversation est fermée par l’équipe FATA.");
    }
    const conversation = await this.prisma.conversation.upsert({
      where: { clientId_sellerId_productId: conversationKey },
      create: {
        clientId: user.id,
        sellerId: product.store.sellerId,
        productId: product.id,
        orderId: verifiedOrderId,
        lastMessageAt: new Date(),
      },
      update: verifiedOrderId ? { orderId: verifiedOrderId } : {},
      include: conversationContext,
    });
    if (conversation.status !== "OPEN") {
      throw new ConflictException("Cette conversation est fermée par l’équipe FATA.");
    }
    return conversation;
  }

  async getConversation(user: AuthenticatedUser, conversationId: string) {
    this.assertMessagingRole(user);
    const conversation = await this.findConversationForMember(user, conversationId);
    return conversation;
  }

  async listMessages(user: AuthenticatedUser, conversationId: string) {
    this.assertMessagingRole(user);
    await this.findConversationForMember(user, conversationId);
    return this.prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: { select: { id: true, name: true } },
        reports: { where: { reporterId: user.id }, select: { id: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
  }

  async markRead(user: AuthenticatedUser, conversationId: string) {
    this.assertMessagingRole(user);
    await this.findConversationForMember(user, conversationId);
    const now = new Date();
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: user.id }, readAt: null },
      data: { readAt: now, status: "READ" },
    });
    await this.prisma.notification.updateMany({
      where: { userId: user.id, conversationId, type: "NEW_MESSAGE", readAt: null },
      data: { readAt: now },
    });
    return { read: true };
  }

  async sendMessage(user: AuthenticatedUser, conversationId: string, dto: SendMessageDto) {
    this.assertMessagingRole(user);
    this.assertNotSuspended(user);
    const body = this.sanitizeAndValidateBody(dto.body);
    const result = await this.prisma.$transaction(async transaction => {
      await transaction.$queryRaw`SELECT "id" FROM "Conversation" WHERE "id" = ${conversationId} FOR UPDATE`;
      const conversation = await transaction.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true, clientId: true, sellerId: true, status: true, product: { select: { name: true } } },
      });
      if (!conversation || (conversation.clientId !== user.id && conversation.sellerId !== user.id)) {
        throw new NotFoundException("Conversation introuvable.");
      }
      if (conversation.status !== "OPEN") {
        throw new ConflictException("Cette conversation est fermée.");
      }
      const recipientId = conversation.clientId === user.id ? conversation.sellerId : conversation.clientId;
      const [message] = await Promise.all([
        transaction.message.create({
          data: { conversationId, senderId: user.id, body },
          include: { sender: { select: { id: true, name: true } } },
        }),
        transaction.conversation.update({
          where: { id: conversationId },
          data: { lastMessageAt: new Date() },
        }),
        transaction.notification.create({
          data: {
            userId: recipientId,
            conversationId,
            type: "NEW_MESSAGE",
            title: "Nouveau message FATA",
            body: `${user.name} vous a écrit au sujet de ${conversation.product.name}.`,
          },
        }),
      ]);
      return message;
    });
    return result;
  }

  async reportMessage(user: AuthenticatedUser, messageId: string, dto: ReportMessageDto) {
    this.assertMessagingRole(user);
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, conversation: { OR: [{ clientId: user.id }, { sellerId: user.id }] } },
      select: {
        id: true,
        senderId: true,
        conversationId: true,
        conversation: { select: { clientId: true, sellerId: true } },
      },
    });
    if (!message) throw new NotFoundException("Message introuvable.");
    if (message.senderId === user.id) throw new BadRequestException("Vous ne pouvez pas signaler votre propre message.");
    const existing = await this.prisma.messageReport.findUnique({
      where: { reporterId_messageId: { reporterId: user.id, messageId } },
    });
    if (existing) throw new ConflictException("Ce message a déjà été signalé.");

    try {
      return await this.prisma.$transaction(async transaction => {
        const createdReport = await transaction.messageReport.create({
          data: {
            messageId,
            conversationId: message.conversationId,
            reporterId: user.id,
            reason: `${dto.reason}: ${dto.details.trim()}`,
          },
        });
        const admins = await transaction.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true },
        });
        if (admins.length) {
          await transaction.notification.createMany({
            data: admins.map(admin => ({
              userId: admin.id,
              type: "MESSAGE_REPORT",
              title: "Nouveau signalement de message",
              body: `Un message a été signalé par ${user.name}.`,
            })),
          });
        }
        return createdReport;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("Ce message a déjà été signalé.");
      }
      throw error;
    }
  }

  async listReports() {
    return this.prisma.messageReport.findMany({
      include: {
        message: { include: { sender: { select: { id: true, name: true } } } },
        conversation: {
          include: {
            ...conversationContext,
            messages: {
              orderBy: { createdAt: "desc" },
              take: 8,
              include: { sender: { select: { id: true, name: true } } },
            },
          },
        },
        reporter: { select: { id: true, name: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
    });
  }

  async reviewReport(admin: AuthenticatedUser, reportId: string, dto: ReviewMessageReportDto) {
    const report = await this.prisma.messageReport.findUnique({
      where: { id: reportId },
      include: {
        message: { select: { id: true, senderId: true } },
        conversation: { select: { id: true, clientId: true, sellerId: true } },
      },
    });
    if (!report) throw new NotFoundException("Signalement introuvable.");
    if (report.status !== "PENDING") throw new ConflictException("Ce signalement a déjà été traité.");
    const action = dto.action ?? "NONE";
    if (dto.status === "DISMISSED" && action !== "NONE") {
      throw new BadRequestException("Un signalement classé ne peut pas appliquer de mesure.");
    }
    if (action === "SUSPEND_MESSAGE_SENDER" && report.message.senderId === report.reporterId) {
      throw new BadRequestException("L’auteur du message signalé correspond au déclarant.");
    }
    const resolution = dto.resolution?.trim() || null;
    await this.prisma.$transaction(async transaction => {
      const updated = await transaction.messageReport.updateMany({
        where: { id: report.id, status: "PENDING" },
        data: { status: dto.status, resolution, handledAt: new Date() },
      });
      if (!updated.count) throw new ConflictException("Ce signalement a déjà été traité.");
      if (action === "CLOSE_CONVERSATION") {
        await transaction.conversation.update({
          where: { id: report.conversationId },
          data: { status: "SUSPENDED" },
        });
      } else if (action === "SUSPEND_MESSAGE_SENDER") {
        await transaction.user.update({
          where: { id: report.message.senderId },
          data: { messagingSuspended: true },
        });
      }
      await transaction.moderationAuditLog.create({
        data: {
          actorId: admin.id,
          action: `MESSAGE_REPORT_${dto.status}_${action}`,
          entityType: "MessageReport",
          entityId: report.id,
          metadata: { conversationId: report.conversationId, resolution },
        },
      });
      await transaction.notification.create({
        data: {
          userId: report.reporterId,
          conversationId: report.conversationId,
          type: "MESSAGE_REPORT_HANDLED",
          title: "Votre signalement a été traité",
          body: resolution || "L’équipe FATA a examiné votre signalement.",
        },
      });
    });
    return { id: report.id, status: dto.status, action };
  }

  async listNotifications(user: AuthenticatedUser) {
    return this.prisma.$queryRaw<{
      id: string;
      userId: string;
      conversationId: string | null;
      orderId: string | null;
      type: string;
      title: string;
      body: string;
      readAt: Date | null;
      createdAt: Date;
    }[]>`
      SELECT "id", "userId", "conversationId", "orderId", "type", "title", "body", "readAt", "createdAt"
      FROM "Notification"
      WHERE "userId" = ${user.id}
      ORDER BY "createdAt" DESC
      LIMIT 50
    `;
  }

  async markNotificationRead(user: AuthenticatedUser, notificationId: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { id: notificationId, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    if (!updated.count) {
      const notification = await this.prisma.notification.findFirst({
        where: { id: notificationId, userId: user.id },
        select: { id: true },
      });
      if (!notification) throw new NotFoundException("Notification introuvable.");
    }
    return { read: true };
  }

  private async findConversationForMember(user: AuthenticatedUser, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        ...(user.role === "CLIENT" ? { clientId: user.id } : { sellerId: user.id }),
      },
      include: conversationContext,
    });
    if (!conversation) throw new NotFoundException("Conversation introuvable.");
    return conversation;
  }

  private assertMessagingRole(user: AuthenticatedUser) {
    if (user.role !== "CLIENT" && user.role !== "SELLER") {
      throw new ForbiddenException("La messagerie est réservée aux clients et aux vendeurs.");
    }
  }

  private assertNotSuspended(user: AuthenticatedUser) {
    if (user.messagingSuspended) throw new ForbiddenException("La messagerie de ce compte est suspendue.");
  }

  private sanitizeAndValidateBody(value: string) {
    const body = value.normalize("NFKC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
    if (!body) throw new BadRequestException("Le message ne peut pas être vide.");
    if (body.length > 2000) throw new BadRequestException("Le message dépasse la limite de 2 000 caractères.");
    if (prohibitedUrl.test(body) || prohibitedPayment.test(body) || ivorianPhone.test(body) || (contactContext.test(body) && phoneLike.test(body))) {
      throw new BadRequestException("Pour votre sécurité, les liens, coordonnées et demandes de paiement hors FATA ne sont pas autorisés dans les messages.");
    }
    return body;
  }
}
