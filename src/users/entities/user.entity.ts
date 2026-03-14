import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Availability } from '../../availability/entities/availability.entity';
import { EventType } from '../../event-types/entities/event-type.entity';
import { Integration } from '../../integrations/entities/integration.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', unique: true })
  username: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  @Exclude()
  passwordHash: string | null;

  @Column({ name: 'image_url', type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'varchar', default: 'UTC' })
  timezone: string;

  @Column({ name: 'is_approved', type: 'int', default: 1 })
  isApproved: number;

  @Column({ name: 'google_id', type: 'varchar', nullable: true })
  googleId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToOne(() => Availability, (a) => a.user)
  availability?: Availability;

  @OneToMany(() => EventType, (e) => e.user)
  eventTypes?: EventType[];

  @OneToMany(() => Integration, (i) => i.user)
  integrations?: Integration[];
}
