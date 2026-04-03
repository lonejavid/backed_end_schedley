import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class SignupVerifyDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;
}
