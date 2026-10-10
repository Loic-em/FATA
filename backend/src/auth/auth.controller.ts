import { Body, Controller, Get, Patch, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { AuthenticatedUser } from "./jwt.strategy";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.auth.register(dto);
    this.setSessionCookie(response, session.accessToken);
    return { user: session.user };
  }

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.auth.login(dto);
    this.setSessionCookie(response, session.accessToken);
    return { user: session.user };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@Req() request: Request & { user: AuthenticatedUser }) {
    return request.user;
  }

  @Patch("profile")
  @UseGuards(JwtAuthGuard)
  updateProfile(@Req() request: Request & { user: AuthenticatedUser }, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(request.user.id, dto);
  }

  @Patch("password")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  changePassword(@Req() request: Request & { user: AuthenticatedUser }, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(request.user.id, dto);
  }

  @Post("logout")
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie("fata_session", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api",
    });
    return { success: true };
  }

  private setSessionCookie(response: Response, accessToken: string) {
    response.cookie("fata_session", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api",
      maxAge: 15 * 60 * 1000,
    });
  }
}
