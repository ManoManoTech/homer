import { CONFIG } from '@/config';

const TICKET_ID_MATCHER = '{ticketId}';

export function getTicketId(commitMessage: string): string | undefined {
  return commitMessage
    .match(/[A-Z]+-[0-9]+/i)?.[0]
    ?.trim()
    ?.toUpperCase();
}

/** ` - [TICKET-1](url)` when the message references a ticket, else ''. */
export function formatTicketLink(commitMessage: string): string {
  const ticketId = getTicketId(commitMessage);

  return ticketId
    ? ` - [${ticketId}](${CONFIG.ticketManagementUrlPattern.replace(
        TICKET_ID_MATCHER,
        ticketId,
      )})`
    : '';
}
