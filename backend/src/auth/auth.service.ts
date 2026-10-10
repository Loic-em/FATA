import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { JwtService } from "@nestjs/jwt";
import { compare, hash } from "bcryptjs";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) throw new ConflictException("Cette adresse e-mail est déjà utilisée.");

    const role = dto.role === "SELLER" ? UserRole.SELLER : UserRole.CLIENT;
    const passwordHash = await hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash,
        role,
        ...(role === UserRole.SELLER ? {
          sellerStatus: "PENDING",
          store: {
            create: {
              name: dto.storeName!.trim(),
              slug: this.storeSlug(dto.storeName!),
              description: "Boutique en attente de validation.",
              city: "Abidjan",
            },
          },
        } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        sellerStatus: true,
        store: { select: { name: true } },
      },
    });
    return this.createSession(user);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { store: { select: { name: true } } },
    });
    const validPassword = user ? await compare(dto.password, user.passwordHash) : false;
    if (!user || !validPassword) {
      throw new UnauthorizedException("Adresse e-mail ou mot de passe incorrect.");
    }
    return this.createSession({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      sellerStatus: user.sellerStatus,
      store: user.store,
    });
  }

  private async createSession(user: {
    id: string;
    name: string;
    email: string;
    role: string;
    sellerStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
    store?: { name: string } | null;
  }) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      role: user.role,
      email: user.email,
    });
    return { accessToken, user };
  }

  private storeSlug(name: string): string {
    const base = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "boutique";
    return `${base}-${randomUUID().slice(0, 8)}`;
  }
}
