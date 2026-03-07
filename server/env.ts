/**
 * Server environment configuration.
 * S3-compatible storage (e.g. R2) - optional; app can fall back to Replit.
 */
function getEnv(key: string): string | undefined {
  return process.env[key];
}

export const env = {
  R2_ACCOUNT_ID: getEnv("R2_ACCOUNT_ID"),
  R2_ACCESS_KEY_ID: getEnv("R2_ACCESS_KEY_ID"),
  R2_SECRET_ACCESS_KEY: getEnv("R2_SECRET_ACCESS_KEY"),
  R2_BUCKET_NAME: getEnv("R2_BUCKET_NAME"),
  R2_PUBLIC_DOMAIN: getEnv("R2_PUBLIC_DOMAIN"),
} as const;

export function isR2Configured(): boolean {
  return !!(
    env.R2_ACCOUNT_ID &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET_NAME
  );
}
