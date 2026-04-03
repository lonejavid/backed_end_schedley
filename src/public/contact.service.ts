import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import {
  contactAdminNotificationEmail,
  contactConfirmationEmail,
} from '../mail/email-templates';
import { User } from '../users/entities/user.entity';
import { ContactDto } from './dto/contact.dto';

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async submit(dto: ContactDto, user: User | null): Promise<{ message: string }> {
    const name = (user?.name ?? dto.name ?? '').trim();
    const email = (user?.email ?? dto.email ?? '').trim().toLowerCase();
    if (!name || !email) {
      throw new BadRequestException('Name and email are required when you are not signed in');
    }

    const alertTo = this.config.get<string>('contact.alertEmail')?.trim();
    if (!alertTo) {
      this.logger.warn(
        'CONTACT_ALERT_EMAIL is not set; admin notification email is skipped (user confirmation is still attempted)',
      );
    }

    if (alertTo) {
      const admin = contactAdminNotificationEmail(
        dto.inquiryType,
        name,
        email,
        Boolean(user),
        dto.message,
      );
      await this.mailService.sendMail(alertTo, admin.subject, admin.html, admin.text);
    }

    const confirmation = contactConfirmationEmail(name, dto.inquiryType, dto.message);
    await this.mailService.sendMail(email, confirmation.subject, confirmation.html, confirmation.text);

    return { message: 'Thank you for your message. We will get back to you soon.' };
  }
}
