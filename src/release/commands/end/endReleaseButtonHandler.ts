import type { ButtonAction } from '@/core/typings/ButtonAction';
import { extractActionParameters } from '@/core/utils/slackActions';
import { endRelease } from '@/release/commands/end/endRelease';

export async function endReleaseButtonHandler({ value }: ButtonAction) {
  const [projectIdAsString, tagName] = extractActionParameters(value);
  const projectId = parseInt(projectIdAsString, 10);

  await endRelease(projectId, tagName);
}
