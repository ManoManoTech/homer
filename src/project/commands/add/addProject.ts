import { CONFIG } from '@/config';
import { HOMER_GIT_URL } from '@/constants';
import {
  addProjectToChannel,
  countChannelsByProjectId,
} from '@/core/services/data';
import { getProvider } from '@/core/services/providers/ProviderFactory';
import { slackBotWebClient } from '@/core/services/slack';
import type { UnifiedProject } from '@/core/typings/UnifiedModels';

export async function addProject(
  project: Pick<UnifiedProject, 'id' | 'path' | 'provider'>,
  channelId: string,
  userId: string,
): Promise<void> {
  const { id: projectId, path: projectPath, provider } = project;

  await addProjectToChannel({ projectId, channelId, provider });
  const numberOfChannelsLinkedToProject = await countChannelsByProjectId(
    projectId,
    provider,
  );

  await sendSuccessMessage(channelId, userId, project);

  if (
    numberOfChannelsLinkedToProject > CONFIG.slack.channelNotificationThreshold
  ) {
    await sendThresholdWarningMessage(
      channelId,
      userId,
      projectPath,
      numberOfChannelsLinkedToProject,
    );
  }
}

async function sendSuccessMessage(
  channelId: string,
  userId: string,
  project: Pick<UnifiedProject, 'path' | 'provider'>,
): Promise<void> {
  const webhookSettingsUrl = getProvider(
    project.provider,
  ).getWebhookSettingsUrl(project);
  const documentation =
    project.provider === 'github'
      ? `in your GitHub repository by following the \
<${HOMER_GIT_URL}/blob/main/docs/github.md|dedicated documentation>.`
      : `in your Gitlab project by following the \
<${HOMER_GIT_URL}/#1-make-homer-notified-of-changes-happening-in-the-gitlab-project|dedicated documentation>.`;

  await slackBotWebClient.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: `\
\`${project.path}\` added to this channel :homer-happy:

Don't forget to <${webhookSettingsUrl}|set up a webhook> ${documentation}
`,
  });
}

async function sendThresholdWarningMessage(
  channelId: string,
  userId: string,
  projectPath: string,
  numberOfChannelsLinkedToProject: number,
): Promise<void> {
  await slackBotWebClient.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: `\
D'oh! I've added \`${projectPath}\` to this channel, but my brain is starting to hurt. :homer-stressed:

This project is now in ${numberOfChannelsLinkedToProject} channels, and I get confused when it's in more than ${CONFIG.slack.channelNotificationThreshold}.
To keep things simple for me, I've disabled automatic merge requests (from the \`homer-review\` and \`homer-mergeable\` labels) for this project.

Don't worry, you can still use \`/homer review\` to handle MRs manually!

If you want me to go back to my automatic, donut-fueled self, just remove the project from another channel. :homer-donut:`,
  });
}
