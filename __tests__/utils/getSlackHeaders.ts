import crypto from 'crypto';

export function getSlackHeaders(
  body: Record<string, unknown> = {},
  timestamp: number = Date.now()
): Record<string, string> {
  const requestTimestamp = Math.floor(timestamp / 1000).toString();
  const signature = `v0=${crypto
    .createHmac('sha256', process.env.SLACK_SIGNING_SECRET as string)
    .update(`v0:${requestTimestamp}:${JSON.stringify(body)}`)
    .digest('hex')}`;

  return {
    'User-Agent': 'Slackbot',
    'X-Slack-Request-Timestamp': requestTimestamp,
    'X-Slack-Signature': signature,
  };
}
