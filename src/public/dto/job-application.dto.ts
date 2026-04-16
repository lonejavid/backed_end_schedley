import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class JobApplicationDto {
  @IsString()
  @MinLength(1, { message: 'Job title is required' })
  @MaxLength(300)
  jobTitle: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  jobDepartment?: string;

  /** Required so we can prevent duplicate applications per email. */
  @IsInt()
  @Min(1)
  jobId: number;

  /** Required when the request is not authenticated (see CareerApplicationService). */
  @ValidateIf((_, v) => v !== undefined && v !== null && String(v).trim() !== '')
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ValidateIf((_, v) => v !== undefined && v !== null && String(v).trim() !== '')
  @IsEmail({}, { message: 'Please enter a valid email' })
  email?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  country: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  experience: string;

  /** Original filename (should be .pdf) */
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  resumeFileName: string;

  /** Base64-encoded PDF body */
  @IsString()
  @MinLength(1)
  @MaxLength(9_000_000)
  resumeBase64: string;
}
