import type { Response } from 'express';
import { HTTP_STATUS_NO_CONTENT } from '@/constants';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import { slackBotWebClient } from '@/core/services/slack';
import type { ProviderType } from '@/core/typings/Provider';
import type {
  SlackExpressRequest,
  SlackSlashCommandResponse,
} from '@/core/typings/SlackSlashCommand';
import type { UnifiedProject } from '@/core/typings/UnifiedModels';
import { buildHelpMessage } from '@/core/viewBuilders/buildHelpMessage';
import { addProject } from './addProject';
import { buildAddProjectSelectionEphemeral } from './buildAddProjectSelectionEphemeral';

const GITHUB_KEYWORD = 'github';
const GITHUB_URL_REGEX = /^https:\/\/github\.com\//;

export async function addProjectRequestHandler(
  req: SlackExpressRequest,
  res: Response,
) {
  const { text, channel_id, user_id } = req.body as SlackSlashCommandResponse;

  const { provider, query } = parseQuery(text.split(' ').slice(2));

  if (query.length === 0) {
    res.send(buildHelpMessage(channel_id));
    return;
  }

  res.sendStatus(HTTP_STATUS_NO_CONTENT);

  let projects: UnifiedProject[] = [];

  if (!Number.isNaN(Number(query))) {
    try {
      projects = [await getProvider(provider).fetchProject(Number(query))];
    } catch {
      await slackBotWebClient.chat.postEphemeral({
        channel: channel_id,
        user: user_id,
        text: `No project found with id \`${query}\` :homer-stressed:`,
      });
      return;
    }
  } else {
    projects = await getProvider(provider).searchProjects(query);

    if (projects.length === 0) {
      await slackBotWebClient.chat.postEphemeral({
        channel: channel_id,
        user: user_id,
        text: `No project matches \`${query}\` :homer-stressed:`,
      });
      return;
    }
    if (projects.length > 1) {
      await slackBotWebClient.chat.postEphemeral(
        buildAddProjectSelectionEphemeral({
          channelId: channel_id,
          projects,
          query,
          userId: user_id,
        }),
      );
      return;
    }
  }

  await addProject(projects[0], channel_id, user_id);
}

/**
 * GitHub projects are added with `github <query>` or a github.com URL, the
 * rest goes to GitLab.
 */
function parseQuery(words: string[]): {
  provider: ProviderType;
  query: string;
} {
  if (words[0]?.toLowerCase() === GITHUB_KEYWORD) {
    return { provider: 'github', query: words.slice(1).join(' ') };
  }

  const query = words.join(' ');
  return {
    provider: GITHUB_URL_REGEX.test(query) ? 'github' : 'gitlab',
    query,
  };
}
