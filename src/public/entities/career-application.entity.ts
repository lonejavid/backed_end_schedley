import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('career_application')
@Unique('UQ_career_application_email_job', ['email', 'jobId'])
export class CareerApplication {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  @Index()
  email: string;

  @Column({ name: 'job_id', type: 'int' })
  jobId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
