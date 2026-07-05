import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types, Document } from 'mongoose';

@Schema()
export class BadgeTemplate {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  projectId: string;

  @Prop({ required: true })
  _id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  imageUrl: string;

  @Prop({ required: true, min: 1 })
  checkinsAmount: number;

  @Prop({ required: true })
  mustContribute: boolean;

  @Prop({ type: [String], default: [] })
  previousBadges: string[];

  @Prop({ required: true })
  taskType: string;

  @Prop({ required: true })
  areaId: string;

  @Prop({ required: true })
  timeIntervalId: string;

  @Prop({
    required: true,
    default: 'active',
    enum: ['active', 'faded', 'expired'],
  })
  status?: string;
}

const BadgeTemplateSchema = SchemaFactory.createForClass(BadgeTemplate);

@Schema()
export class PointRule {
  @Prop({ required: true })
  _id: string;
  @Prop({ required: true })
  score: number;

  @Prop({ required: true })
  areaId: string;

  @Prop({ required: true })
  timeIntervalId: string;

  @Prop({ required: true })
  taskType: string;

  @Prop({ required: true })
  mustContribute: boolean;
}

const PointRuleSchema = SchemaFactory.createForClass(PointRule);

@Schema()
export class GamificationTemplate extends Document {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  projectId: string;

  @Prop({ type: [BadgeTemplateSchema], default: [] })
  badges: BadgeTemplate[];

  @Prop({ type: [PointRuleSchema], default: [] })
  pointRules: PointRule[];

  static collectionName() {
    return 'Gamification';
  }
}

export type GamificationTemplateDocument = GamificationTemplate & Document;
export const GamificationTemplateSchema =
  SchemaFactory.createForClass(GamificationTemplate);
