/**
 * Query parameters used by the admin "checkins for project" endpoint.
 *
 * Every property is optional. The class only converts and validates
 * the raw query string values; default fallbacks (e.g. page=1, limit=20)
 * are applied in CheckinService.findForAdmin so callers always see the same defaults.
 */
export class AdminCheckinQueryDto {
  /** Free-text search against the related task name and description (case-insensitive, partial match). */
  taskName?: string;

  /** Filter by task type as stored on the checkin (exact match). */
  taskType?: string;

  /** Restrict to checkins authored by a specific user. */
  userId?: string;

  /**
   * `'true'` keeps only checkins with at least one image,
   * `'false'` keeps only checkins without images,
   * undefined keeps both.
   */
  hasPhotos?: string;

  /** Whether the checkin solved a task (`'true'`/`'false'`). */
  contributed?: string;

  /** Lower bound for `datetime` (ISO string). */
  dateFrom?: string;

  /** Upper bound for `datetime` (ISO string). */
  dateTo?: string;

  /** Center of a geo radius filter (decimal degrees). */
  latitude?: string;
  longitude?: string;
  /** Radius in kilometers — only honored when latitude+longitude are both provided. */
  radiusKm?: string;

  /** 1-based page number. */
  page?: string;
  /** Page size (capped server-side to avoid runaway scans). */
  limit?: string;
  /** `'asc'` or `'desc'` (default `desc`) by `datetime`. */
  sortOrder?: string;
}
