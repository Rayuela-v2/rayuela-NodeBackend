import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserDocument, UserTemplate } from './user.schema';
import { User } from './user.entity';
import { UserMapper } from './UserMapper';

@Injectable()
export class UserDao {
  private readonly logger = new Logger(UserDao.name);

  constructor(
    @InjectModel(UserTemplate.collectionName())
    private userModel: Model<UserDocument>,
  ) {}

  async findByEmailOrUsername(
    email: string,
    username: string,
  ): Promise<User | null> {
    const userDocument = await this.userModel
      .findOne({ $or: [{ email }, { username }] })
      .exec();
    return userDocument ? UserMapper.toEntity(userDocument) : null;
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    const userDocument = await this.userModel.findOne({ googleId }).exec();
    return userDocument ? UserMapper.toEntity(userDocument) : null;
  }

  async create(userData: User): Promise<User> {
    const createdUser = new this.userModel(UserMapper.toTemplate(userData));
    const savedUser = await createdUser.save();
    return UserMapper.toEntity(savedUser);
  }

  async getUserById(userId: string): Promise<User | null> {
    const userDocument = await this.userModel.findById(userId).exec();
    return userDocument ? UserMapper.toEntity(userDocument) : null;
  }

  async update(id: string, userData: User): Promise<User | null> {
    const updatedUser = await this.userModel
      .findOneAndUpdate({ _id: id }, UserMapper.toTemplate(userData), {
        new: true,
      })
      .exec();
    return updatedUser ? UserMapper.toEntity(updatedUser['_doc']) : null;
  }

  // -------------------------------------------------------------------
  // Refresh sessions
  //
  // These bypass the User entity / UserMapper on purpose: they are the
  // only writers of `refreshTokens`, and they use atomic array operators
  // so two devices refreshing at the same moment can't overwrite each
  // other with a stale read-modify-write.
  // -------------------------------------------------------------------

  /** Adds a session, evicting the oldest once `max` is exceeded. */
  async addRefreshSession(
    userId: string,
    hash: string,
    expiry: Date,
    max: number,
  ): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: userId },
        {
          $push: {
            refreshTokens: { $each: [{ hash, expiry }], $slice: -max },
          },
        },
      )
      .exec();
  }

  /**
   * Slides a live session's expiry forward. Returns false only when the
   * hash matches no live session — the single condition that means "this
   * refresh token is dead, sign this device out".
   *
   * Falls back to the pre-multi-session `refreshTokenHash` field and
   * migrates it in place, so deploying this change doesn't log out every
   * user who is currently signed in.
   */
  async touchRefreshSession(
    userId: string,
    hash: string,
    expiry: Date,
    max: number,
  ): Promise<boolean> {
    const now = new Date();
    const live = await this.userModel
      .updateOne(
        {
          _id: userId,
          refreshTokens: { $elemMatch: { hash, expiry: { $gt: now } } },
        },
        { $set: { 'refreshTokens.$.expiry': expiry } },
      )
      .exec();
    if (live.matchedCount === 1) return true;

    const legacy = await this.userModel
      .updateOne(
        { _id: userId, refreshTokenHash: hash, refreshTokenExpiry: { $gt: now } },
        {
          $set: { refreshTokenHash: null, refreshTokenExpiry: null },
          $push: {
            refreshTokens: { $each: [{ hash, expiry }], $slice: -max },
          },
        },
      )
      .exec();
    return legacy.matchedCount === 1;
  }

  /** Signs one device out. Other sessions are untouched. */
  async removeRefreshSession(userId: string, hash: string): Promise<void> {
    await this.userModel
      .updateOne({ _id: userId }, { $pull: { refreshTokens: { hash } } })
      .exec();
  }

  /** Signs every device out (password reset, account recovery). */
  async clearRefreshSessions(userId: string): Promise<void> {
    await this.userModel
      .updateOne(
        { _id: userId },
        {
          $set: {
            refreshTokens: [],
            refreshTokenHash: null,
            refreshTokenExpiry: null,
          },
        },
      )
      .exec();
  }

  async getAllByProjectId(projectId: string): Promise<User[]> {
    const userDocuments = await this.userModel
      .find({
        gameProfiles: {
          $elemMatch: { projectId: projectId },
        },
      })
      .exec();

    return userDocuments.map((doc) => UserMapper.toEntity(doc));
  }

  async getUserByResetToken(token: string) {
    const u = await this.userModel.findOne({ resetToken: token }).exec();
    return u ? UserMapper.toEntity(u) : null;
  }
}
