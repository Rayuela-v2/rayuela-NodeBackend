import { Checkin } from './checkin.entity';
import { GameStatus } from './game.entity';

export enum ScoreRate {
  NO_RATE = 0,
  ONE_STAR = 1,
  TWO_STAR = 2,
  THREE_STAR = 3,
  FOUR_STAR = 4,
  FIVE_STAR = 5,
}

export class Move {
  get gameStatus(): GameStatus {
    return this._gameStatus;
  }

  get timestamp(): Date {
    return this._timestamp;
  }

  get score(): ScoreRate {
    return this._score;
  }

  get checkin(): Checkin {
    return this._checkin;
  }

  private _checkin: Checkin;
  private _gameStatus: GameStatus;
  private _score: ScoreRate;
  private _timestamp: Date;

  constructor(checkin: Checkin, gameStatus: GameStatus) {
    this._checkin = checkin;
    this._gameStatus = gameStatus;
    this._score = ScoreRate.NO_RATE;
    const checkinDate = checkin?.date ? new Date(checkin.date) : null;
    this._timestamp =
      checkinDate && !Number.isNaN(checkinDate.getTime())
        ? checkinDate
        : new Date();
  }
}
