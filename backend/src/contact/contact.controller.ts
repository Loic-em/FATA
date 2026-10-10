import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { CreateContactRequestDto } from "./dto/create-contact-request.dto";
import { UpdateContactRequestDto } from "./dto/update-contact-request.dto";
import { ContactService } from "./contact.service";

@Controller("contact")
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  @Post()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  create(@Body() dto: CreateContactRequestDto) {
    return this.contact.create(dto);
  }
}

@Controller("admin/contact-requests")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class AdminContactController {
  constructor(private readonly contact: ContactService) {}

  @Get()
  list() {
    return this.contact.list();
  }

  @Patch(":id")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateContactRequestDto) {
    return this.contact.updateStatus(id, dto.status);
  }
}
