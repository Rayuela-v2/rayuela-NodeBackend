/**
 * How long an access token (JWT) stays valid, in seconds.
 *
 * Single source of truth shared by:
 *   - `JwtModule.register({ signOptions: { expiresIn } })` in auth.module.ts
 *   - the `expires_in` field returned by `AuthService.login()`
 *
 * Keep them coupled — drift here causes the client to refresh too late.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

/**
 * How long a refresh token stays valid, in days — counted from its LAST use,
 * not from login. Every `/auth/refresh` slides the expiry forward, so a user
 * who opens the app at least once every 90 days never gets logged out.
 */
export const REFRESH_TOKEN_TTL_DAYS = 90;

/**
 * Refresh tokens are per-session, not per-user: each login pushes one entry
 * onto `user.refreshTokens`, so signing in on a second device (or on the web)
 * doesn't kill the first one. Oldest entries fall off past this cap.
 */
export const MAX_REFRESH_SESSIONS = 10;

/**
 * Refresh tokens are shaped as `${userId}${SEPARATOR}${secret}` so the server
 * can locate the owner without an extra lookup field. The userId portion is a
 * Mongo ObjectId (24 hex chars, no dots) and the secret is a uuid v4 (hex +
 * dashes, no dots), so splitting on the first '.' is unambiguous.
 */
export const REFRESH_TOKEN_SEPARATOR = '.';
