import { getEnvVariable } from '@/core/utils/getEnvVariable';

export const CONFIG = {
  apiBasePath: getEnvVariable('API_BASE_PATH', '/api/v1/homer'),
  postgres: {
    host: getEnvVariable('POSTGRES_HOST'),
    username: getEnvVariable('POSTGRES_USER', 'homer'),
    password: getEnvVariable('POSTGRES_PASSWORD'),
    port: Number(getEnvVariable('POSTGRES_PORT', '5432')),
    databaseName: getEnvVariable('POSTGRES_DATABASE_NAME', 'homer'),
    pool: {
      max: Number(getEnvVariable('POSTGRES_POOL_MAX', '5')),
      min: Number(getEnvVariable('POSTGRES_POOL_MIN', '0')),
      idle: Number(getEnvVariable('POSTGRES_POOL_IDLE', '10000')),
      acquire: Number(getEnvVariable('POSTGRES_POOL_ACQUIRE', '30000')),
    },
  },
  gitlab: {
    url: getEnvVariable('GITLAB_URL'),
    token: getEnvVariable('GITLAB_TOKEN'),
    secret: getEnvVariable('GITLAB_SECRET'),
  },
  // Optional: GitHub support is enabled when GITHUB_TOKEN is set.
  github: {
    url: getEnvVariable('GITHUB_URL', 'https://github.com'),
    apiUrl: getEnvVariable('GITHUB_API_URL', 'https://api.github.com'),
    token: getEnvVariable('GITHUB_TOKEN', ''),
    secret: getEnvVariable('GITHUB_SECRET', ''),
    // Anyone can pick any login on github.com, so matching logins with emails
    // is only safe when the organization controls logins (Enterprise, SSO).
    loginMatchesEmail:
      getEnvVariable('GITHUB_LOGIN_MATCHES_EMAIL', '') === 'true',
  },
  slack: {
    signingSecret: getEnvVariable('SLACK_SIGNING_SECRET'),
    accessToken: getEnvVariable('SLACK_BOT_USER_O_AUTH_ACCESS_TOKEN'),
    emailDomains: getEnvVariable('EMAIL_DOMAINS'),
    supportChannel: {
      id: getEnvVariable('SLACK_SUPPORT_CHANNEL_ID'),
      name: getEnvVariable('SLACK_SUPPORT_CHANNEL_NAME'),
    },
    channelNotificationThreshold: Number(
      getEnvVariable('SLACK_CHANNEL_NOTIFICATION_THRESHOLD', '3'),
    ),
  },
  ticketManagementUrlPattern: getEnvVariable('TICKET_MANAGEMENT_URL_PATTERN'),
  userIdentityResolvers: getEnvVariable(
    'USER_IDENTITY_RESOLVERS',
    'emailDomainConvention',
  ),
  requestBodySizeLimit: getEnvVariable('REQUEST_BODY_SIZE_LIMIT', '5mb'),
} as const;
