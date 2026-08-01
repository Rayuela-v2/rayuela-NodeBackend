import { User } from './user.entity';
import { UserDocument, UserTemplate } from './user.schema';

export class UserMapper {
  static toEntity(userDocument: UserDocument): User {
    return new User(
      userDocument.complete_name,
      userDocument.username,
      userDocument.email,
      userDocument.password,
      userDocument.profile_image,
      userDocument.verified,
      userDocument.role,
      userDocument._id,
      userDocument.gameProfiles,
      userDocument.contributions,
      userDocument.ratings || [],
      [], // checkins
      userDocument.googleId ?? null,
      userDocument.createdAt,
      userDocument.refreshTokenHash ?? null,
      userDocument.refreshTokenExpiry ?? null,
      userDocument.description ?? '',
    );
  }

  // Convierte una entidad User en un objeto UserTemplate
  static toTemplate(user: User): UserTemplate {
    return {
      complete_name: user.completeName,
      username: user.username,
      email: user.email,
      password: user.password,
      profile_image: user.profileImage,
      description: user.description ?? '',
      verified: user.verified,
      role: user.role,
      resetToken: user.resetToken,
      ...(user.googleId ? { googleId: user.googleId } : {}),
      gameProfiles: user.gameProfiles,
      contributions: user.contributions,
      createdAt: user.createdAt,
      refreshTokenHash: user.refreshTokenHash,
      refreshTokenExpiry: user.refreshTokenExpiry,
      ratings: user.ratings.map((r) => ({
        score: r.score,
        checkinId: r.checkinId,
        taskId: r.taskId,
      })),
    };
  }
}
