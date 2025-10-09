import { getEnvVariable } from '@/core/utils/getEnvVariable';

export const CONFIG = {
  apiBasePath: getEnvVariable('API_BASE_PATH', '/api/v1/homer'),
  postgres: {
    host: getEnvVariable('POSTGRES_HOST'),
    username: getEnvVariable('POSTGRES_USER'),
    password: getEnvVariable('POSTGRES_PASSWORD'),
    port: Number(getEnvVariable('POSTGRES_PORT')),
    databaseName: getEnvVariable('POSTGRES_DATABASE_NAME', 'homer'),
  },
  gitlab: {
    url: getEnvVariable('GITLAB_URL'),
    token: getEnvVariable('GITLAB_TOKEN'),
    secret: getEnvVariable('GITLAB_SECRET'),
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
} as const;
