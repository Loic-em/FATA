import { IsIn } from "class-validator";

export const CONTACT_REQUEST_STATUSES = ["NEW", "IN_PROGRESS", "CLOSED"] as const;
export type ContactRequestStatus = typeof CONTACT_REQUEST_STATUSES[number];

export class UpdateContactRequestDto {
  @IsIn(CONTACT_REQUEST_STATUSES)
  status!: ContactRequestStatus;
}
