import { CONFIG } from '@/config';
import { HOMER_GIT_URL } from '@/constants';
import {
  addProjectToChannel,
  countChannelsByProjectId,
} from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';

export async function addProject(
  projectId: number,
  channelId: string,
  userId: string,
  projectPath: string
): Promise<void> {
  await addProjectToChannel({ projectId, channelId });
  const numberOfChannelsLinkedToProject = await countChannelsByProjectId(
    projectId
  );

  await sendSuccessMessage(channelId, userId, projectPath);

  if (
    numberOfChannelsLinkedToProject > CONFIG.slack.channelNotificationThreshold
  ) {
    await sendThresholdWarningMessage(
      channelId,
      userId,
      projectPath,
      numberOfChannelsLinkedToProject
    );
  }
}

async function sendSuccessMessage(
  channelId: string,
  userId: string,
  projectPath: string
): Promise<void> {
  await slackBotWebClient.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: `\
\`${projectPath}\` added to this channel :homer-happy:

Don't forget to <${CONFIG.gitlab.url}/${projectPath}/-/hooks|set up a webhook> \
in your Gitlab project by following the \
<${HOMER_GIT_URL}/#1-make-homer-notified-of-changes-happening-in-the-gitlab-project|dedicated documentation>.
`,
  });
}

async function sendThresholdWarningMessage(
  channelId: string,
  userId: string,
  projectPath: string,
  numberOfChannelsLinkedToProject: number
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
