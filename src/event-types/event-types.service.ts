import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventType } from './entities/event-type.entity';
import { User } from '../users/entities/user.entity';
import { CreateEventDto } from './dto/create-event.dto';

@Injectable()
export class EventTypesService {
  constructor(
    @InjectRepository(EventType)
    private readonly repo: Repository<EventType>,
  ) {}

  async create(userId: string, dto: CreateEventDto): Promise<EventType> {
    const slug = this.titleToSlug(dto.title);
    const questionsStr =
      dto.questions == null
        ? null
        : typeof dto.questions === 'string'
          ? dto.questions
          : JSON.stringify(dto.questions);
    const event = this.repo.create({
      title: dto.title,
      description: dto.description ?? '',
      duration: dto.duration,
      locationType: dto.locationType,
      slug,
      userId,
      questions: questionsStr,
    });
    return this.repo.save(event);
  }

  async findAllByUser(userId: string): Promise<{ events: EventType[]; username: string }> {
    const userRepo = this.repo.manager.getRepository(User);
    const user = await userRepo.findOne({ where: { id: userId } });
    const events = await this.repo.find({
      where: { userId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    const eventsWithCount = await Promise.all(
      events.map(async (e) => {
        const count = await this.repo
          .createQueryBuilder('e')
          .innerJoin('e.meetings', 'm')
          .where('e.id = :id', { id: e.id })
          .getCount();
        return { ...e, _count: count };
      }),
    );
    return {
      events: eventsWithCount as (EventType & { _count: number })[],
      username: user?.username ?? '',
    };
  }

  async findOne(id: string, userId?: string): Promise<EventType> {
    const event = await this.repo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!event) throw new NotFoundException('Event not found');
    if (userId != null && event.userId !== userId) {
      throw new ForbiddenException();
    }
    return event;
  }

  async togglePrivacy(eventId: string, userId: string): Promise<EventType> {
    const event = await this.findOne(eventId, userId);
    event.isPrivate = event.isPrivate ? 0 : 1;
    return this.repo.save(event);
  }

  async remove(eventId: string, userId: string): Promise<void> {
    await this.findOne(eventId, userId);
    await this.repo.delete(eventId);
  }

  async findByUsernameAndSlug(
    username: string,
    slug: string,
  ): Promise<EventType | null> {
    return this.repo
      .createQueryBuilder('e')
      .innerJoin('e.user', 'u')
      .where('u.username = :username', { username })
      .andWhere('e.slug = :slug', { slug })
      .andWhere('e.isPrivate = :isPrivate', { isPrivate: false })
      .select(['e', 'u.id', 'u.name', 'u.username', 'u.imageUrl', 'u.timezone'])
      .getOne();
  }

  /** Public: list non-private events for a user by username */
  async findPublicEventsByUsername(
    username: string,
  ): Promise<{ user: User | null; events: EventType[] }> {
    const userRepo = this.repo.manager.getRepository(User);
    const user = await userRepo.findOne({
      where: { username },
      select: ['id', 'name', 'username', 'imageUrl', 'timezone'],
    });
    if (!user) return { user: null, events: [] };
    const events = await this.repo.find({
      where: { userId: user.id, isPrivate: 0 },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    return { user, events };
  }

  titleToSlug(title: string): string {
    return (
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || `event-${Date.now()}`
    );
  }
}
