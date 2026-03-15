import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Meeting } from '../../meetings/entities/meeting.entity';

@Entity('event_types')
export class EventType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'int' })
  duration: number;

  @Column({ type: 'varchar' })
  slug: string;

  @Column({ name: 'is_private', type: 'int', default: 0 })
  isPrivate: number;

  @Column({ name: 'location_type', type: 'varchar' })
  locationType: string;

  @Column({ name: 'time_slot_interval', type: 'int', default: 30 })
  timeSlotInterval: number;

  @Column({ name: 'blocked_domains', type: 'text', nullable: true })
  blockedDomains: string | null;

  @Column({ type: 'text', nullable: true })
  questions: string | null;

  @Column({ name: 'access_specifier', type: 'varchar', default: 'PUBLIC' })
  accessSpecifier: string;

  @Column({ name: 'booking_start_date', type: 'timestamp', nullable: true })
  bookingStartDate: Date | null;

  @Column({ name: 'booking_end_date', type: 'timestamp', nullable: true })
  bookingEndDate: Date | null;

  @Column({ name: 'minimum_notice', type: 'int', nullable: true })
  minimumNotice: number | null;

  @Column({ name: 'notice_type', type: 'varchar', nullable: true })
  noticeType: string | null;

  @Column({ name: 'booking_window_type', type: 'varchar', nullable: true })
  bookingWindowType: string | null;

  @Column({ name: 'date_range_limit', type: 'int', nullable: true })
  dateRangeLimit: number | null;

  @Column({ name: 'date_range_type', type: 'varchar', nullable: true })
  dateRangeType: string | null;

  @Column({ name: 'user_id', type: 'varchar' })
  userId: string;

  @ManyToOne(() => User, (u) => u.eventTypes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @OneToMany(() => Meeting, (m) => m.event)
  meetings?: Meeting[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
