import { IsEmail, IsIn, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export const CONTACT_INQUIRY_TYPES = [
  'General Inquiry',
  'Technical Support',
  'Report a Bug',
  'Feature Request',
] as const;

export type ContactInquiryType = (typeof CONTACT_INQUIRY_TYPES)[number];

export class ContactDto {
  @IsIn(CONTACT_INQUIRY_TYPES)
  inquiryType: ContactInquiryType;

  @IsString()
  @MinLength(1, { message: 'Message is required' })
  @MaxLength(5000)
  message: string;

  /** Required when the request is not authenticated (validated in ContactService). */
  @ValidateIf((_, v) => v !== undefined && v !== null && String(v).trim() !== '')
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ValidateIf((_, v) => v !== undefined && v !== null && String(v).trim() !== '')
  @IsEmail({}, { message: 'Please enter a valid email' })
  email?: string;
}
