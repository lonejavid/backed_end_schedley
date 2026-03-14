import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QuestionAnswerDto {
  @IsString()
  question: string;

  @IsString()
  answer: string;
}

export class CreateMeetingDto {
  @IsString()
  eventId: string;

  @IsString()
  guestName: string;

  @IsString()
  guestEmail: string;

  @IsOptional()
  @IsString()
  additionalInfo?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionAnswerDto)
  questionAnswers?: QuestionAnswerDto[];

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsString()
  guestTimezone?: string;

  @IsOptional()
  @IsString()
  dateStr?: string;

  @IsOptional()
  @IsString()
  slotTime?: string;

  @IsOptional()
  @IsNumber()
  eventDuration?: number;
}
