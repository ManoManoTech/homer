import { GITLAB_URL, HOMER_GITLAB_URL } from '@/constants';
import { addProjectToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';

export async function addProject(
  projectId: number,
  channelId: string,
  userId: string,
  projectPath: string
): Promise<void> {
  await addProjectToChannel({ projectId, channelId });
  await slackBotWebClient.chat.postEphemeral({
    channel: channelId,
    user: userId,
    text: `\
\`${projectPath}\` added to this channel :homer-happy:

Don't forget to <${GITLAB_URL}/${projectPath}/-/hooks|set up a webhook> \
in your Gitlab project by following the \
<${HOMER_GITLAB_URL}/#make-homer-be-notified-of-changes-happening-in-your-gitlab-project|dedicated documentation>.
`,
  });
}
