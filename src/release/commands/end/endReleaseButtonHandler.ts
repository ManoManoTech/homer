import type { ButtonAction } from '@/core/typings/ButtonAction';
import { parseProjectRef } from '@/core/utils/projectRef';
import { extractActionParameters } from '@/core/utils/slackActions';
import { endRelease } from '@/release/commands/end/endRelease';

export async function endReleaseButtonHandler({ value }: ButtonAction) {
  const [projectRef, tagName] = extractActionParameters(value);
  const { projectId, provider } = parseProjectRef(projectRef);

  await endRelease(projectId, tagName, provider);
}
