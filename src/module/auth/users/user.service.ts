import { Injectable, NotFoundException } from '@nestjs/common';
import { UserDao } from './user.dao';
import { User } from './user.entity';
import { Checkin } from '../../checkin/entities/checkin.entity';

/** Campos que el propio usuario puede editar desde su perfil. */
export interface UpdateProfileDTO {
  complete_name?: string;
  description?: string;
  profile_image?: string;
}

export const PROFILE_LIMITS = {
  completeName: 80,
  description: 280,
  profileImage: 300,
};

@Injectable()
export class UserService {
  constructor(private readonly userDao: UserDao) {}

  async findByEmailOrUsername(
    email: string,
    username: string,
  ): Promise<User | null> {
    return this.userDao.findByEmailOrUsername(email, username);
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.userDao.findByGoogleId(googleId);
  }

  async create(userData: User): Promise<User> {
    return this.userDao.create(userData);
  }

  async update(id: string, userData: User): Promise<User> {
    return this.userDao.update(id, userData);
  }

  /**
   * Actualiza los campos editables del propio perfil. Solo toca las claves
   * presentes en el patch: mandar `{ description }` no borra el avatar.
   * `email`, `username` y `role` no son editables por acá a propósito —
   * el email identifica la cuenta.
   */
  async updateProfile(username: string, patch: UpdateProfileDTO): Promise<User> {
    const user = await this.userDao.findByEmailOrUsername('', username);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (patch.complete_name !== undefined) {
      const name = clamp(patch.complete_name, PROFILE_LIMITS.completeName);
      // Un nombre vacío dejaría la UI sin nada que mostrar: se ignora.
      if (name) user.completeName = name;
    }
    if (patch.description !== undefined) {
      user.description = clamp(patch.description, PROFILE_LIMITS.description);
    }
    if (patch.profile_image !== undefined) {
      const image = clamp(patch.profile_image, PROFILE_LIMITS.profileImage);
      user.profileImage = image || null;
    }
    return this.userDao.update(user.id, user);
  }

  async getByUserId(userId: string): Promise<User | null> {
    return await this.userDao.getUserById(userId);
  }

  addRefreshSession(userId: string, hash: string, expiry: Date, max: number) {
    return this.userDao.addRefreshSession(userId, hash, expiry, max);
  }

  touchRefreshSession(
    userId: string,
    hash: string,
    expiry: Date,
    max: number,
  ): Promise<boolean> {
    return this.userDao.touchRefreshSession(userId, hash, expiry, max);
  }

  removeRefreshSession(userId: string, hash: string) {
    return this.userDao.removeRefreshSession(userId, hash);
  }

  clearRefreshSessions(userId: string) {
    return this.userDao.clearRefreshSessions(userId);
  }

  async findAllByProjectId(projectId: string): Promise<User[]> {
    return await this.userDao.getAllByProjectId(projectId);
  }

  async saveResetToken(id: string, resetToken: string) {
    const u = await this.getByUserId(id);
    u.resetToken = resetToken;
    await this.userDao.update(id, u);
  }

  async rate(userId: string, checkin: Checkin, rate: number) {
    const u = await this.getByUserId(userId);
    if (!u) {
      throw new Error('User not found');
    }
    u.addRating(checkin, rate);
    await this.update(u.id, u);
    return u;
  }

  getUserByResetToken(token: string): Promise<User | null> {
    return this.userDao.getUserByResetToken(token);
  }
}

/** Trimea y corta al límite. Entrada no-string se trata como vacía. */
function clamp(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}
