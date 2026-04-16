import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { MailService } from '../mail/mail.service';
import {
  jobApplicationAdminNotificationEmail,
  jobApplicationConfirmationEmail,
} from '../mail/email-templates';
import { User } from '../users/entities/user.entity';
import { JobApplicationDto } from './dto/job-application.dto';
import { CareerApplication } from './entities/career-application.entity';

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

function isUniqueConstraintError(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const d = err.driverError as { code?: string; errno?: number } | undefined;
  if (d?.code === '23505') return true;
  if (d?.errno === 19 && String(err.message).includes('UNIQUE')) return true;
  if (String(err.message).includes('Duplicate entry')) return true;
  return false;
}

@Injectable()
export class CareerApplicationService {
  private readonly logger = new Logger(CareerApplicationService.name);

  constructor(
    @InjectRepository(CareerApplication)
    private readonly careerRepo: Repository<CareerApplication>,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async findJobIdsByEmail(email: string): Promise<number[]> {
    const rows = await this.careerRepo.find({
      where: { email: email.trim().toLowerCase() },
      select: ['jobId'],
    });
    return rows.map((r) => r.jobId);
  }

  async submit(
    dto: JobApplicationDto,
    user: User | null,
  ): Promise<{ message: string }> {
    const name = (user?.name ?? dto.name ?? '').trim();
    const email = (user?.email ?? dto.email ?? '').trim().toLowerCase();
    if (!name || !email) {
      throw new BadRequestException(
        'Name and email are required when you are not signed in',
      );
    }

    try {
      await this.careerRepo.insert({ email, jobId: dto.jobId });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictException(
          'You have already applied for this position with this email address.',
        );
      }
      throw err;
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(dto.resumeBase64, 'base64');
    } catch {
      await this.careerRepo.delete({ email, jobId: dto.jobId });
      throw new BadRequestException('Invalid resume encoding');
    }
    if (!buffer.length) {
      await this.careerRepo.delete({ email, jobId: dto.jobId });
      throw new BadRequestException('Resume file is empty');
    }
    if (buffer.length > MAX_RESUME_BYTES) {
      await this.careerRepo.delete({ email, jobId: dto.jobId });
      throw new BadRequestException('Resume must be 5MB or smaller');
    }
    const pdfHeader = buffer.subarray(0, 4).toString('ascii');
    if (pdfHeader !== '%PDF') {
      await this.careerRepo.delete({ email, jobId: dto.jobId });
      throw new BadRequestException('Resume must be a PDF file');
    }

    const safeName = dto.resumeFileName.toLowerCase();
    if (!safeName.endsWith('.pdf')) {
      await this.careerRepo.delete({ email, jobId: dto.jobId });
      throw new BadRequestException('Resume must be a .pdf file');
    }

    const alertTo = this.config.get<string>('contact.alertEmail')?.trim();
    if (!alertTo) {
      this.logger.warn(
        'CONTACT_ALERT_EMAIL is not set; job application admin email is skipped (applicant confirmation is still attempted)',
      );
    }

    try {
      if (alertTo) {
        const admin = jobApplicationAdminNotificationEmail({
          applicantName: name,
          applicantEmail: email,
          country: dto.country.trim(),
          experience: dto.experience.trim(),
          jobTitle: dto.jobTitle.trim(),
          jobDepartment: dto.jobDepartment?.trim(),
          jobId: dto.jobId,
        });
        await this.mailService.sendMail(
          alertTo,
          admin.subject,
          admin.html,
          admin.text,
          [
            {
              filename: dto.resumeFileName.trim() || 'resume.pdf',
              content: buffer,
              contentType: 'application/pdf',
            },
          ],
        );
      }

      const confirmation = jobApplicationConfirmationEmail(
        name,
        dto.jobTitle.trim(),
      );
      await this.mailService.sendMail(
        email,
        confirmation.subject,
        confirmation.html,
        confirmation.text,
      );
    } catch (err) {
      await this.careerRepo.delete({ email, jobId: dto.jobId });
      throw err;
    }

    return {
      message:
        'Thank you for applying. We have received your application and will be in touch if there is a match.',
    };
  }
}
