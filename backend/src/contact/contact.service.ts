import { randomUUID } from "node:crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateContactRequestDto } from "./dto/create-contact-request.dto";
import type { ContactRequestStatus } from "./dto/update-contact-request.dto";

type ContactRequestRow = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactRequestStatus;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class ContactService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateContactRequestDto) {
    // Accept honeypot submissions without storing or revealing the spam check.
    if (dto.website?.trim()) return { accepted: true };

    await this.prisma.$executeRaw`
      INSERT INTO "ContactRequest" ("id", "name", "email", "subject", "message", "status", "createdAt", "updatedAt")
      VALUES (${randomUUID()}, ${dto.name.trim()}, ${dto.email.trim().toLowerCase()}, ${dto.subject}, ${dto.message.trim()}, 'NEW'::"ContactRequestStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `;
    return { accepted: true };
  }

  list() {
    return this.prisma.$queryRaw<ContactRequestRow[]>`
      SELECT "id", "name", "email", "subject", "message", "status", "createdAt", "updatedAt"
      FROM "ContactRequest"
      ORDER BY CASE "status" WHEN 'NEW' THEN 0 WHEN 'IN_PROGRESS' THEN 1 ELSE 2 END, "createdAt" DESC
      LIMIT 200
    `;
  }

  async updateStatus(id: string, status: ContactRequestStatus) {
    const rows = await this.prisma.$queryRaw<ContactRequestRow[]>`
      UPDATE "ContactRequest"
      SET "status" = ${status}::"ContactRequestStatus", "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${id}
      RETURNING "id", "name", "email", "subject", "message", "status", "createdAt", "updatedAt"
    `;
    if (!rows[0]) throw new NotFoundException("Demande de contact introuvable.");
    return rows[0];
  }
}
