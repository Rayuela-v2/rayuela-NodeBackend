import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MoveDocument, MoveTemplate } from './move.schema';
import { Move } from '../entities/move.entity';

@Injectable()
export class MoveDao {
  constructor(
    @InjectModel(MoveTemplate.collectionName())
    private readonly moveModel: Model<MoveDocument>,
  ) {}

  /*async findAll(): Promise<Move[]> {
    const moves = await this.moveModel.find().exec();
    return moves.map(this.mapToEntity);
  }*/

  /* async findOne(id: string): Promise<Move> {
     const move = await this.moveModel.findById(id).exec();
     if (!move) {
       throw new NotFoundException('Move not found');
     }
     return this.mapToEntity(move);
   }*/

  async create(createMoveDto: Move): Promise<Move> {
    const moveDb = this.mapToSchema(createMoveDto);
    await new this.moveModel(moveDb).save();
    return createMoveDto;
  }

  async update(id: string, updateMoveDto: Move): Promise<any> {
    const moveDb = this.mapToSchema(updateMoveDto);
    const updatedMove = await this.moveModel
      .findByIdAndUpdate(id, moveDb, { new: true })
      .exec();

    if (!updatedMove) {
      throw new NotFoundException('Move not found');
    }

    return updatedMove;
  }

  async remove(id: string): Promise<void> {
    const result = await this.moveModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Move not found');
    }
  }

  async findMovesByBadge(badgeName: string): Promise<MoveDocument[]> {
    return this.moveModel.find({ newBadges: badgeName }).exec();
  }

  async findMovesByCheckinIds(checkinIds: string[]): Promise<MoveDocument[]> {
    return this.moveModel.find({ checkinId: { $in: checkinIds } }).exec();
  }

  /**
   * Mapea la entidad `Move` al formato del esquema de base de datos `MoveTemplate`.
   */
  private mapToSchema(move: Move): Partial<MoveTemplate> {
    return {
      checkinId: move.checkin.id,
      userId: move.checkin.user.id,
      score: move.score,
      timestamp: move.timestamp,
      newBadges: move.gameStatus.newBadges.map((badge) => badge.name),
      newPoints: move.gameStatus.newPoints,
    };
  }
}
