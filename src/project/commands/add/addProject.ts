import { HOMER_GIT_URL } from '@/constants';
import { addProjectToChannel } from '@/core/services/data';
import { slackBotWebClient } from '@/core/services/slack';
import { getEnvVariable } from '@/core/utils/getEnvVariable';

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

Don't forget to <${getEnvVariable(
      'GITLAB_URL'
    )}/${projectPath}/-/hooks|set up a webhook> \
in your Gitlab project by following the \
<${HOMER_GIT_URL}/#1-make-homer-notified-of-changes-happening-in-the-gitlab-project|dedicated documentation>.
`,
  });
}
