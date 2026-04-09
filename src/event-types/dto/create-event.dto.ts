import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(5)
  duration: number;

  @IsString()
  locationType: string;

  /** JSON string or array of { id, question, type, required, options? } - invitee form questions */
  @IsOptional()
  questions?: string | Array<{ id?: number | string; question: string; type?: string; required?: boolean; options?: string[] }>;

  /** allow_all | block_domains — persisted for public booking rules */
  @IsOptional()
  @IsString()
  accessSpecifier?: string;

  /** e.g. ["@gmail.com"] — stored as JSON in blocked_domains */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedDomains?: string[];
}
