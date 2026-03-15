import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class ContactDto {
  @IsString()
  @MinLength(1, { message: 'Name is required' })
  @MaxLength(200)
  name: string;

  @IsEmail({}, { message: 'Please enter a valid email' })
  email: string;

  @IsString()
  @MinLength(1, { message: 'Subject is required' })
  @MaxLength(300)
  subject: string;

  @IsString()
  @MinLength(1, { message: 'Message is required' })
  @MaxLength(5000)
  message: string;
}
