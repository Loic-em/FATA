import { IsBoolean } from "class-validator";

export class SetProductActiveDto {
  @IsBoolean()
  active!: boolean;
}
