import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export interface DayAvailability {
  day: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

@Entity('availability')
export class Availability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', unique: true })
  userId: string;

  @OneToOne(() => User, (u) => u.availability, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'time_gap', type: 'int', default: 30 })
  timeGap: number;

  @Column({ type: 'varchar', default: 'UTC' })
  timezone: string;

  @Column({ type: 'simple-json', default: '[]' })
  days: DayAvailability[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
