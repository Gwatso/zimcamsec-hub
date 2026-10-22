/** Cookie names shared by server code and the edge middleware. */
export const SESSION_COOKIE = "zch_session";
export const DATA_SAVER_COOKIE = "zch_ds";
export const THEME_COOKIE = "zch_theme";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Random, anonymous id used only to apply the guest download allowance. */
export const GUEST_COOKIE = "zch_guest";
export const GUEST_TTL_SECONDS = 365 * 24 * 60 * 60;
