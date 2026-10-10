import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { UpdatePlatformSettingsDto } from "./dto/update-platform-settings.dto";
import { SettingsService } from "./settings.service";

@Controller("settings")
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get("public")
  getPublicSettings() {
    return this.settings.getDeliveryFees();
  }

  @Get("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  getAdminSettings() {
    return this.settings.getAdminSettings();
  }

  @Patch("admin")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("ADMIN")
  updateAdminSettings(@Body() dto: UpdatePlatformSettingsDto) {
    return this.settings.updateAdminSettings(dto);
  }
}
