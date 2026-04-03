import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('smtp.host');
    const port = this.config.get<number>('smtp.port') ?? 587;
    const user = this.config.get<string>('smtp.user');
    const pass = this.config.get<string>('smtp.pass');
    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      this.logger.warn(
        'SMTP not configured (SMTP_HOST, SMTP_USER, SMTP_PASS). OTP codes will be logged to the console.',
      );
    }
  }

  async sendMail(to: string, subject: string, html: string, text: string): Promise<void> {
    const from =
      this.config.get<string>('smtp.from') ||
      this.config.get<string>('smtp.user') ||
      'noreply@schedley.local';

    if (!this.transporter) {
      this.logger.log(`[email skipped — no SMTP] to=${to} subject=${subject}\n${text}`);
      return;
    }

    await this.transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });
  }
}
