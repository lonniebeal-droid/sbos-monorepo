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
});
