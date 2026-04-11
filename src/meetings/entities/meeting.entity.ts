import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EventType } from '../../event-types/entities/event-type.entity';

@Entity('meetings')
export class Meeting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'varchar' })
  eventId: string;

  @ManyToOne(() => EventType, (e) => e.meetings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event: EventType;

  @Column({ name: 'guest_name', type: 'varchar' })
  guestName: string;

  @Column({ name: 'guest_email', type: 'varchar' })
  guestEmail: string;

  @Column({ name: 'additional_info', type: 'text', nullable: true })
  additionalInfo: string | null;

  @Column({ name: 'start_time' })
  startTime: Date;

  @Column({ name: 'end_time' })
  endTime: Date;

  @Column({ name: 'guest_timezone', type: 'varchar', nullable: true })
  guestTimezone: string | null;

  @Column({ name: 'meet_link', type: 'varchar', nullable: true })
  meetLink: string | null;

  @Column({ name: 'calendar_event_id', type: 'varchar', nullable: true })
  calendarEventId: string | null;

  /** Zoom API meeting id (for delete on cancel) */
  @Column({ name: 'zoom_meeting_id', type: 'varchar', nullable: true })
  zoomMeetingId: string | null;

  @Column({ type: 'varchar', default: 'SCHEDULED' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
