import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { GameProfile } from './user.entity';

export type UserDocument = UserTemplate & Document;

export enum UserRole {
  Admin = 'Admin',
  Volunteer = 'Volunteer',
}

/** One signed-in device: the SHA-256 of its refresh token + its expiry. */
export interface RefreshSession {
  hash: string;
  expiry: Date;
}

export class Rating {
  @Prop({
    required: true,
  })
  checkinId: string;

  @Prop({
    required: true,
  })
  taskId: string;

  @Prop({ required: true })
  score: number;
}

@Schema()
export class UserTemplate {
  @Prop({ required: true })
  complete_name: string; // Nombre completo del usuario

  _id?: string; // Nombre completo del usuario

  @Prop({ required: true, unique: true })
  username: string; // Nombre de usuario único

  @Prop({ required: true, unique: true })
  email: string; // Email único

  @Prop({ default: '' })
  resetToken: string; // reset token

  @Prop({ required: true })
  password: string; // Contraseña (hash)

  @Prop({ required: false })
  googleId?: string; // Identificador estable de Google

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ default: null })
  profile_image: string; // Imagen de perfil (URL, o un id de avatar `avatar:<id>`)

  @Prop({ default: '' })
  description: string; // Bio corta que el usuario edita desde su perfil

  @Prop({ default: false })
  verified: boolean; // Indica si el usuario ha verificado su cuenta

  @Prop({ enum: UserRole, default: UserRole.Volunteer })
  role: UserRole; // Rol del usuario (Admin o Volunteer)

  @Prop({ type: Array, default: [] })
  gameProfiles: GameProfile[];

  @Prop({ default: null })
  refreshTokenHash: string; // legacy single-session field, migrated on first refresh

  @Prop({ type: Date, default: null })
  refreshTokenExpiry: Date; // legacy single-session field

  /**
   * One entry per signed-in device. Written only through the atomic
   * `$push` / `$set` / `$pull` helpers in UserDao — never through
   * `UserMapper.toTemplate`, so a concurrent profile update can't clobber
   * someone else's session.
   */
  @Prop({ type: [{ hash: String, expiry: Date, _id: false }], default: [] })
  refreshTokens?: RefreshSession[];

  @Prop({ type: Array, default: [] })
  contributions: string[]; // tasks id

  @Prop({ type: [{ type: Object }], default: [] })
  ratings: Rating[];

  static collectionName() {
    return 'Users';
  }
}

export const UserSchema = SchemaFactory.createForClass(UserTemplate);
UserSchema.index(
  { googleId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      googleId: { $exists: true, $type: 'string' },
    },
    name: 'googleId_1',
  },
);
