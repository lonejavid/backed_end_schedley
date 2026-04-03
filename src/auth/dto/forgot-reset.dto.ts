import { IsEmail, IsString, Length, Matches, MinLength } from 'class-validator';

export class ForgotResetDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}
