import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminMessagingController } from "./admin-messaging.controller";
import { MessagingController } from "./messaging.controller";
import { MessagingService } from "./messaging.service";

@Module({
  imports: [AuthModule],
  controllers: [MessagingController, AdminMessagingController],
  providers: [MessagingService],
})
export class MessagingModule {}
