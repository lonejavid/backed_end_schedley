import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DayAvailabilityDto {
  @IsString()
  day: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsOptional()
  isAvailable?: boolean;
}

export class UpdateAvailabilityDto {
  @IsOptional()
  @IsNumber()
  @Min(5)
  timeGap?: number;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DayAvailabilityDto)
  days?: DayAvailabilityDto[];
}
