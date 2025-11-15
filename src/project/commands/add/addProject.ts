import { CONFIG } from '@/config';
import { HOMER_GIT_URL } from '@/constants';
import {
  addProjectToChannel,
  countChannelsByProjectId,
  countChannelsByProjectIdString,
} from '@/core/services/data';
import { ProviderFactory } from '@/core/services/providers/ProviderFactory';
import { slackBotWebClient } from '@/core/services/slack';

export async function addProject(
  projectId: number | string,
  channelId: string,
  userId: string,
  projectPath: string,
): Promise<void> {
  const providerType = ProviderFactory.detectProviderType(projectId);

  await addProjectToChannel({
    channelId,
    projectId: typeof projectId === 'number' ? projectId : null,
    projectIdString: typeof projectId === 'string' ? projectId : null,
    providerType,
  });

  // Count how many channels this project is in
  const numberOfChannelsLinkedToProject =
    typeof projectId === 'number'
      ? await countChannelsByProjectId(projectId)
      : await countChannelsByProjectIdString(projectId);

  await sendSuccessMessage(channelId, userId, projectPath, providerType);

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
  projectPath: string,
  providerType: 'gitlab' | 'github',
): Promise<void> {
  let webhookInstructions = '';
  if (providerType === 'gitlab') {
    webhookInstructions = `Don't forget to <${CONFIG.gitlab.url}/${projectPath}/-/hooks|set up a webhook> \
in your GitLab project by following the \
<${HOMER_GIT_URL}/#1-make-homer-notified-of-changes-happening-in-the-gitlab-project|dedicated documentation>.`;
  } else if (providerType === 'github') {
    webhookInstructions = `Don't forget to set up a webhook in your GitHub project:
1. Go to https://github.com/${projectPath}/settings/hooks
2. Add webhook with:
   - Payload URL: <your_homer_url>/api/v1/homer/github
   - Content type: application/json
   - Secret: your GITHUB_SECRET
   - Events: Pull requests, Issue comments, Pull request reviews`;
  }

  await slackBotWebClient.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: `\`${projectPath}\` added to this channel :homer-happy:\n\n${webhookInstructions}`,
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
