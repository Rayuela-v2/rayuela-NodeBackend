import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Injectable, NotFoundException } from '@nestjs/common';
import { CheckInTemplate, CheckInDocument } from './checkin.schema';
import { UpdateCheckinDto } from '../dto/update-checkin.dto';
import { Checkin } from '../entities/checkin.entity';
import { CheckinMapper } from './CheckinMapper';

/**
 * Filters interpreted by [findForAdmin]. They are computed by the
 * service layer (DTO ➜ typed filters) so the DAO stays free of any
 * string-to-X coercion logic.
 */
export interface AdminCheckinFilter {
  projectId: string;
  taskType?: string;
  userId?: string;
  /** Restrict to checkin ids whose `contributesTo` matches a precomputed task id list. */
  taskIdIn?: string[];
  /** When `true` keep only checkins with images, `false` only those without. */
  hasPhotos?: boolean;
  /** When `true` keep only checkins that solved a task, `false` the rest. */
  contributed?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  /** Center of a geo radius filter (decimal degrees). */
  centerLat?: number;
  centerLng?: number;
  /** Radius in kilometers. Only used when center is provided. */
  radiusKm?: number;
  page: number;
  limit: number;
  sortOrder: 1 | -1;
}

export interface AdminCheckinPage {
  items: CheckInTemplate[];
  total: number;
  page: number;
  limit: number;
}

const EARTH_RADIUS_KM = 6371;

/**
 * Maximum number of documents fetched into memory when evaluating the geo
 * radius filter in-memory (coordinates are stored as strings so a native
 * $geoWithin index cannot be used). This prevents unbounded memory usage for
 * large projects while still covering realistic admin query volumes.
 */
const GEO_CANDIDATE_CAP = 5_000;

@Injectable()
export class CheckInDao {
  constructor(
    @InjectModel(CheckInTemplate.collectionName())
    private readonly checkInModel: Model<CheckInDocument>,
    //private userService: UserService,
  ) {}

  async findAll(): Promise<CheckInTemplate[]> {
    return this.checkInModel.find().exec();
  }

  async findOne(id: string): Promise<Checkin> {
    const checkIn = await this.checkInModel.findById(id).exec();
    if (!checkIn) {
      throw new NotFoundException('Check-in not found');
    }
    //const user = await this.userService.getByUserId(checkIn.userId);
    return CheckinMapper.toEntity(checkIn, null);
  }

  async create(checkin: Checkin): Promise<CheckInTemplate> {
    const checkinDB = CheckinMapper.toTemplate(checkin);
    const checkIn = new this.checkInModel(checkinDB);
    return checkIn.save();
  }

  async update(
    id: string,
    updateCheckInDto: UpdateCheckinDto,
  ): Promise<CheckInTemplate> {
    const updatedCheckIn = await this.checkInModel
      .findByIdAndUpdate(id, updateCheckInDto, { new: true })
      .exec();
    if (!updatedCheckIn) {
      throw new NotFoundException('Check-in not found');
    }
    return updatedCheckIn;
  }

  async remove(id: string): Promise<void> {
    const result = await this.checkInModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Check-in not found');
    }
  }

  findByProjectId(userId: string, projectId: string) {
    return this.checkInModel
      .find({ projectId, userId })
      .sort({ datetime: -1 })
      .limit(8)
      .exec();
  }

  /**
   * Admin endpoint backbone: builds a Mongo filter from `AdminCheckinFilter`,
   * paginates, and returns total count for the UI to render page controls.
   *
   * The location filter is applied in-memory after the Mongo query because
   * `latitude` / `longitude` are persisted as strings (see schema). It still
   * benefits from the DB-side filters (project, task, dates, photos), so the
   * candidate set is narrow before we Haversine-check each row.
   */
  async findForAdmin(filter: AdminCheckinFilter): Promise<AdminCheckinPage> {
    const mongoFilter: FilterQuery<CheckInDocument> = {
      projectId: filter.projectId,
    };

    if (filter.taskType) {
      mongoFilter.taskType = filter.taskType;
    }
    if (filter.userId) {
      mongoFilter.userId = filter.userId;
    }
    // taskIdIn ⇒ implies contributed=true. We let it win over the
    // `contributed` flag to avoid producing contradictory queries.
    if (filter.taskIdIn && filter.taskIdIn.length > 0) {
      mongoFilter.contributesTo = { $in: filter.taskIdIn };
    } else if (filter.contributed === true) {
      mongoFilter.contributesTo = { $nin: [null, ''] };
    } else if (filter.contributed === false) {
      mongoFilter.$or = [
        { contributesTo: { $exists: false } },
        { contributesTo: null },
        { contributesTo: '' },
      ];
    }
    if (filter.hasPhotos === true) {
      mongoFilter['imageRefs.0'] = { $exists: true };
    } else if (filter.hasPhotos === false) {
      // Either the field is missing or it's an empty array. We $and-merge
      // so we don't clobber a previous `$or` on `contributesTo`.
      mongoFilter.$and = [
        ...((mongoFilter.$and as object[]) || []),
        {
          $or: [{ imageRefs: { $exists: false } }, { imageRefs: { $size: 0 } }],
        },
      ];
    }
    if (filter.dateFrom || filter.dateTo) {
      mongoFilter.datetime = {};
      if (filter.dateFrom) (mongoFilter.datetime as any).$gte = filter.dateFrom;
      if (filter.dateTo) (mongoFilter.datetime as any).$lte = filter.dateTo;
    }

    const wantsGeoFilter =
      typeof filter.centerLat === 'number' &&
      typeof filter.centerLng === 'number' &&
      typeof filter.radiusKm === 'number' &&
      filter.radiusKm > 0;

    if (!wantsGeoFilter) {
      const [items, total] = await Promise.all([
        this.checkInModel
          .find(mongoFilter)
          .sort({ datetime: filter.sortOrder })
          .skip((filter.page - 1) * filter.limit)
          .limit(filter.limit)
          .exec(),
        this.checkInModel.countDocuments(mongoFilter).exec(),
      ]);
      return {
        items,
        total,
        page: filter.page,
        limit: filter.limit,
      };
    }

    // Geo path: evaluate Haversine in-memory after the cheap DB filters.
    // A cap is applied so we never load unbounded rows into memory; coordinates
    // are stored as strings which prevents using a native $geoWithin index.
    const candidates = await this.checkInModel
      .find(mongoFilter)
      .sort({ datetime: filter.sortOrder })
      .limit(GEO_CANDIDATE_CAP)
      .exec();

    const matched = candidates.filter((c) =>
      CheckInDao.withinRadius(
        Number(c.latitude),
        Number(c.longitude),
        filter.centerLat,
        filter.centerLng,
        filter.radiusKm,
      ),
    );

    const total = matched.length;
    const start = (filter.page - 1) * filter.limit;
    const items = matched.slice(start, start + filter.limit);
    return { items, total, page: filter.page, limit: filter.limit };
  }

  private static withinRadius(
    lat: number,
    lng: number,
    centerLat: number,
    centerLng: number,
    radiusKm: number,
  ): boolean {
    if (Number.isNaN(lat) || Number.isNaN(lng)) return false;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat - centerLat);
    const dLng = toRad(lng - centerLng);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(centerLat)) *
        Math.cos(toRad(lat)) *
        Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c <= radiusKm;
  }
}
