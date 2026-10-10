import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../prisma/prisma.service";

export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  defaultCity: string | null;
  defaultAddress: string | null;
  role: "CLIENT" | "SELLER" | "ADMIN";
  sellerStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  store: { name: string } | null;
  messagingSuspended: boolean;
};

type JwtPayload = { sub: string };

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        request => request?.cookies?.fata_session ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>("JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        sellerStatus: true,
        store: { select: { name: true } },
        messagingSuspended: true,
      },
    });
    if (!user) throw new UnauthorizedException();
    const [profile] = await this.prisma.$queryRaw<{ phone: string | null; defaultCity: string | null; defaultAddress: string | null }[]>`
      SELECT "phone", "defaultCity", "defaultAddress" FROM "User" WHERE "id" = ${user.id}
    `;
    return { ...user, ...profile };
  }
}
