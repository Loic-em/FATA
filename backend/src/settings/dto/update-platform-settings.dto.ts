import { IsInt, Max, Min } from "class-validator";

export class UpdatePlatformSettingsDto {
  @IsInt()
  @Min(0)
  @Max(100_000)
  deliveryFeeAbidjan!: number;

  @IsInt()
  @Min(0)
  @Max(100_000)
  deliveryFeeGrandBassam!: number;

  @IsInt()
  @Min(0)
  @Max(100_000)
  deliveryFeeOther!: number;
}
