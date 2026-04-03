import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async create(data: Partial<User>): Promise<User> {
    const user = this.repo.create(data);
    return this.repo.save(user);
  }

  async findOne(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repo.findOne({ where: { email } });
  }

  /** Case-insensitive email match (for OTP flows). */
  async findByEmailNormalized(email: string): Promise<User | null> {
    const norm = email.trim().toLowerCase();
    const exact = await this.repo.findOne({ where: { email: norm } });
    if (exact) return exact;
    return this.repo
      .createQueryBuilder('u')
      .where('LOWER(u.email) = :e', { e: norm })
      .getOne();
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.repo.findOne({ where: { username } });
  }

  async setGoogleId(userId: string, googleId: string): Promise<void> {
    await this.repo.update({ id: userId }, { googleId });
  }

  async setImageUrl(userId: string, imageUrl: string): Promise<void> {
    await this.repo.update({ id: userId }, { imageUrl });
  }

  async setApproved(userId: string, approved: 0 | 1): Promise<void> {
    await this.repo.update({ id: userId }, { isApproved: approved });
  }

  async setSetupStep(userId: string, step: number): Promise<void> {
    await this.repo.update({ id: userId }, { setupStep: Math.max(0, Math.min(4, step)) });
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.repo.update({ id: userId }, { passwordHash });
  }
}
