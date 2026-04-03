import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export const OTP_PURPOSE_SIGNUP = 'signup';
export const OTP_PURPOSE_PASSWORD_RESET = 'password_reset';
export const OTP_PURPOSE_LOGIN = 'login';

@Entity('otp_challenges')
@Unique(['email', 'purpose'])
export class OtpChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  email: string;

  /** signup | password_reset | login */
  @Column({ type: 'varchar' })
  purpose: string;

  @Column({ name: 'code_hash', type: 'varchar' })
  codeHash: string;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ name: 'pending_name', type: 'varchar', nullable: true })
  pendingName: string | null;

  @Column({ name: 'pending_password_hash', type: 'varchar', nullable: true })
  pendingPasswordHash: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
