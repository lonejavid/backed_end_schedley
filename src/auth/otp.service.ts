import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../mail/mail.service';
import {
  loginOtpEmail,
  passwordResetOtpEmail,
  signupOtpEmail,
} from '../mail/email-templates';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import {
  OtpChallenge,
  OTP_PURPOSE_LOGIN,
  OTP_PURPOSE_PASSWORD_RESET,
  OTP_PURPOSE_SIGNUP,
} from './entities/otp-challenge.entity';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function generateSixDigitCode(): string {
  const n = randomInt(0, 1_000_000);
  return n.toString().padStart(6, '0');
}

@Injectable()
export class OtpService {
  constructor(
    @InjectRepository(OtpChallenge)
    private readonly otpRepo: Repository<OtpChallenge>,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  async sendSignupOtp(name: string, email: string, password: string): Promise<{ message: string }> {
    const normEmail = normalizeEmail(email);
    const existingUser = await this.usersService.findByEmailNormalized(normEmail);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const pending = await this.otpRepo.findOne({
      where: { email: normEmail, purpose: OTP_PURPOSE_SIGNUP },
    });
    if (pending) {
      const elapsed = Date.now() - new Date(pending.updatedAt).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        throw new HttpException(
          `Please wait ${waitSec} seconds before requesting a new code.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    await this.otpRepo.delete({ email: normEmail, purpose: OTP_PURPOSE_SIGNUP });

    const plainCode = generateSixDigitCode();
    const codeHash = await bcrypt.hash(plainCode, 10);
    const passwordHash = await bcrypt.hash(password, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.otpRepo.save(
      this.otpRepo.create({
        email: normEmail,
        purpose: OTP_PURPOSE_SIGNUP,
        codeHash,
        expiresAt,
        attempts: 0,
        pendingName: name.trim(),
        pendingPasswordHash: passwordHash,
      }),
    );

    const { subject, html, text } = signupOtpEmail(plainCode);
    await this.mailService.sendMail(normEmail, subject, html, text);

    return { message: 'Verification code sent to your email.' };
  }

  async verifySignupAndLogin(email: string, code: string) {
    const normEmail = normalizeEmail(email);
    const challenge = await this.otpRepo.findOne({
      where: { email: normEmail, purpose: OTP_PURPOSE_SIGNUP },
    });
    if (!challenge) {
      throw new BadRequestException('No pending signup for this email. Request a new code.');
    }
    if (new Date() > challenge.expiresAt) {
      await this.otpRepo.delete({ id: challenge.id });
      throw new BadRequestException('Code expired. Request a new code.');
    }
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      await this.otpRepo.delete({ id: challenge.id });
      throw new BadRequestException('Too many failed attempts. Request a new code.');
    }

    const ok = await bcrypt.compare(code, challenge.codeHash);
    if (!ok) {
      await this.otpRepo.update({ id: challenge.id }, { attempts: challenge.attempts + 1 });
      throw new UnauthorizedException('Invalid code');
    }

    if (!challenge.pendingName || !challenge.pendingPasswordHash) {
      await this.otpRepo.delete({ id: challenge.id });
      throw new BadRequestException('Invalid signup data. Start again.');
    }

    const stillExists = await this.usersService.findByEmailNormalized(normEmail);
    if (stillExists) {
      await this.otpRepo.delete({ id: challenge.id });
      throw new ConflictException('Email already registered');
    }

    await this.otpRepo.delete({ id: challenge.id });

    const user = await this.authService.createUserWithPasswordHash(
      challenge.pendingName,
      normEmail,
      challenge.pendingPasswordHash,
    );
    return this.authService.login(user);
  }

  /**
   * Email OTP sign-in for existing accounts (any user with this email).
   * Does not reveal whether the email is registered (same response when missing).
   */
  async sendLoginOtp(email: string): Promise<{ message: string; codeSent: boolean }> {
    const normEmail = normalizeEmail(email);
    const user = await this.usersService.findByEmailNormalized(normEmail);

    const ambiguous = {
      message:
        'If an account exists for this email, we sent a 6-digit sign-in code. It expires in 10 minutes.',
      codeSent: true as boolean,
    };

    if (!user) {
      return {
        message: ambiguous.message,
        codeSent: false,
      };
    }

    const pending = await this.otpRepo.findOne({
      where: { email: normEmail, purpose: OTP_PURPOSE_LOGIN },
    });
    if (pending) {
      const elapsed = Date.now() - new Date(pending.updatedAt).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        throw new HttpException(
          `Please wait ${waitSec} seconds before requesting a new code.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    await this.otpRepo.delete({ email: normEmail, purpose: OTP_PURPOSE_LOGIN });

    const plainCode = generateSixDigitCode();
    const codeHash = await bcrypt.hash(plainCode, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.otpRepo.save(
      this.otpRepo.create({
        email: normEmail,
        purpose: OTP_PURPOSE_LOGIN,
        codeHash,
        expiresAt,
        attempts: 0,
        pendingName: null,
        pendingPasswordHash: null,
      }),
    );

    const { subject, html, text } = loginOtpEmail(plainCode);
    await this.mailService.sendMail(normEmail, subject, html, text);

    return ambiguous;
  }

  async verifyLoginOtp(email: string, code: string) {
    const normEmail = normalizeEmail(email);
    const challenge = await this.otpRepo.findOne({
      where: { email: normEmail, purpose: OTP_PURPOSE_LOGIN },
    });
    if (!challenge) {
      throw new BadRequestException('No sign-in code for this email. Request a new code.');
    }
    if (new Date() > challenge.expiresAt) {
      await this.otpRepo.delete({ id: challenge.id });
      throw new BadRequestException('Code expired. Request a new code.');
    }
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      await this.otpRepo.delete({ id: challenge.id });
      throw new BadRequestException('Too many failed attempts. Request a new code.');
    }

    const ok = await bcrypt.compare(code, challenge.codeHash);
    if (!ok) {
      await this.otpRepo.update({ id: challenge.id }, { attempts: challenge.attempts + 1 });
      throw new UnauthorizedException('Invalid code');
    }

    const user = await this.usersService.findByEmailNormalized(normEmail);
    if (!user) {
      await this.otpRepo.delete({ id: challenge.id });
      throw new BadRequestException('Account not found.');
    }

    await this.otpRepo.delete({ id: challenge.id });
    return this.authService.login(user);
  }

  async sendPasswordResetOtp(email: string): Promise<{
    message: string;
    codeSent: boolean;
    flow?: 'google_only';
  }> {
    const normEmail = normalizeEmail(email);
    const user = await this.usersService.findByEmailNormalized(normEmail);

    const notFound = {
      message: 'Account not found.',
      codeSent: false as const,
    };

    if (!user) {
      return notFound;
    }

    if (!user.passwordHash) {
      return {
        message: 'This account uses Google sign-in. Please log in with Google.',
        codeSent: false,
        flow: 'google_only' as const,
      };
    }

    const pending = await this.otpRepo.findOne({
      where: { email: normEmail, purpose: OTP_PURPOSE_PASSWORD_RESET },
    });
    if (pending) {
      const elapsed = Date.now() - new Date(pending.updatedAt).getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        throw new HttpException(
          `Please wait ${waitSec} seconds before requesting a new code.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    await this.otpRepo.delete({ email: normEmail, purpose: OTP_PURPOSE_PASSWORD_RESET });

    const plainCode = generateSixDigitCode();
    const codeHash = await bcrypt.hash(plainCode, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await this.otpRepo.save(
      this.otpRepo.create({
        email: normEmail,
        purpose: OTP_PURPOSE_PASSWORD_RESET,
        codeHash,
        expiresAt,
        attempts: 0,
        pendingName: null,
        pendingPasswordHash: null,
      }),
    );

    const { subject, html, text } = passwordResetOtpEmail(plainCode);
    await this.mailService.sendMail(normEmail, subject, html, text);

    return {
      message:
        "We've sent a 6-digit code to your email. Enter it below with your new password.",
      codeSent: true,
    };
  }

  async resetPasswordWithOtp(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const normEmail = normalizeEmail(email);
    const challenge = await this.otpRepo.findOne({
      where: { email: normEmail, purpose: OTP_PURPOSE_PASSWORD_RESET },
    });
    if (!challenge) {
      throw new BadRequestException('No reset request for this email. Request a new code.');
    }
    if (new Date() > challenge.expiresAt) {
      await this.otpRepo.delete({ id: challenge.id });
      throw new BadRequestException('Code expired. Request a new code.');
    }
    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      await this.otpRepo.delete({ id: challenge.id });
      throw new BadRequestException('Too many failed attempts. Request a new code.');
    }

    const ok = await bcrypt.compare(code, challenge.codeHash);
    if (!ok) {
      await this.otpRepo.update({ id: challenge.id }, { attempts: challenge.attempts + 1 });
      throw new UnauthorizedException('Invalid code');
    }

    const user = await this.usersService.findByEmailNormalized(normEmail);
    if (!user) {
      await this.otpRepo.delete({ id: challenge.id });
      throw new BadRequestException('Account not found.');
    }

    await this.otpRepo.delete({ id: challenge.id });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePasswordHash(user.id, passwordHash);

    return { message: 'Password updated. You can sign in with your new password.' };
  }
}
