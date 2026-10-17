export interface AppConfig {
  port: number;
  corsOrigins: string[];
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  ai: {
    /** OpenAI-compatible base URL (works for OpenAI, Azure, or local gateways). */
    baseUrl: string;
    apiKey?: string;
    model: string;
  };
  stripe: {
    secretKey?: string;
  };
  email: {
    resendApiKey?: string;
    fromAddress: string;
  };
  sms: {
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    twilioFromNumber?: string;
  };
  redis: {
    /** Redis connection URL for distributed rate limiting. Optional; falls back to in-memory if unset. */
    url?: string;
    /** Enable Redis-backed rate limiting (requires REDIS_URL). Defaults to false. */
    enabled: boolean;
    /** Connection timeout in ms. Default: 5000. */
    connectTimeout: number;
    /** Max retries for Redis connection. Default: 3. */
    maxRetriesPerRequest: number;
  };
}

export default (): AppConfig => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  jwt: {
    accessSecret:
      process.env.JWT_ACCESS_SECRET ?? 'sbos-dev-access-secret-change-me',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET ?? 'sbos-dev-refresh-secret-change-me',
    accessExpiresIn: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_TTL ?? '7d',
  },
  ai: {
    baseUrl: process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY,
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY,
    fromAddress: process.env.EMAIL_FROM ?? 'no-reply@sbos.health',
  },
  sms: {
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID,
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
    twilioFromNumber: process.env.TWILIO_FROM_NUMBER,
  },
  redis: {
    url: process.env.REDIS_URL,
    enabled: process.env.REDIS_RATE_LIMIT_ENABLED === 'true',
    connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT ?? '5000', 10),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES ?? '3', 10),
  },
});
