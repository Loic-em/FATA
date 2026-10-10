import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export const CONTACT_SUBJECTS = ["GENERAL", "SELLER", "ORDER", "OTHER"] as const;
export type ContactSubject = typeof CONTACT_SUBJECTS[number];

export class CreateContactRequestDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsIn(CONTACT_SUBJECTS)
  subject!: ContactSubject;

  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}
