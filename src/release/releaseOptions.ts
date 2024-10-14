import { generateChangelog } from '@/changelog/utils/generateChangelog';
import { slackifyChangelog } from '@/changelog/utils/slackifyChangelog';
import ReleasePluginManager from '@/core/pluginManager/ReleasePluginManager';
import {
  fetchPipelineBridges,
  fetchPipelineJobs,
  fetchProjectTags,
} from '@/core/services/gitlab';
import { logger } from '@/core/services/logger';
import { slackBotWebClient } from '@/core/services/slack';
import { cleanViewState } from '@/core/utils/cleanViewState';
import { addLoaderToReleaseModal } from './commands/create/utils/addLoaderToReleaseModal';
import type { ReleaseOptions } from './typings/ReleaseManager';

export default function getReleaseOptions(): ReleaseOptions {
  return {
    changelog: { generateChangelog },
    logger,
    slack: {
      addLoaderToReleaseModal,
      cleanViewState,
      slackifyChangelog,
      webClient: slackBotWebClient,
    },
    release: {
      getReleaseManager: (managerName: string) =>
        ReleasePluginManager.getReleaseManager(managerName),
      getReleaseTagManager: (tagManagerName: string) =>
        ReleasePluginManager.getReleaseTagManager(tagManagerName),
    },
    gitlab: {
      fetchPipelineBridges,
      fetchPipelineJobs,
      fetchProjectTags,
    },
  };
}
