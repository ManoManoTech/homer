/**
 * Identifies a message already posted on the chat platform. `messageId` is the
 * Slack thread timestamp today, and stays text so that another chat platform's
 * identifier fits without a database change.
 */
export interface MessageHandle {
  channelId: string;
  messageId: string;
}
