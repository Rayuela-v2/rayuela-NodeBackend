export const MAX_IMAGES_PER_CHECKIN = 3;

/**
 * Per-file upload size cap. Aligned with mobile compression target
 * (~1600 px JPEG q80 ≈ 600 KB) plus generous headroom for unmanaged
 * uploads from the legacy web client.
 */
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Mime allowlist enforced by the multer fileFilter on `POST /checkin`.
 * Anything outside this set is rejected with HTTP 400 before ever
 * reaching CheckinService.
 */
export const ALLOWED_IMAGE_MIMES: ReadonlySet<string> = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

/** Header the mobile outbox sends so retries don't duplicate resources. */
export const IDEMPOTENCY_HEADER = 'idempotency-key';

/** Max tolerance for check-in timestamps in the future (clock skew guard). */
export const MAX_FUTURE_CHECKIN_TOLERANCE_MS = 10 * 60 * 1000; // 10 minutes
