import type {
    Block,
    InputBlock,
    KnownBlock,
    StaticSelect,
    View,
  } from '@slack/web-api';
  import { generateChangelog } from '@/changelog/utils/generateChangelog';
  import {
    fetchPipelineBridges,
    fetchPipelineJobs,
    fetchProjectTags,
  } from '@/core/services/gitlab';
  import { logger } from '@/core/services/logger';
  import { slackBotWebClient } from '@/core/services/slack';
  import type { BlockActionsPayload } from '@/core/typings/BlockActionPayload';
  import type { DataRelease } from '@/core/typings/Data';
  import type { GitlabDownstreamPipeline } from '@/core/typings/GitlabBridge';
  import type { GitlabCommit } from '@/core/typings/GitlabCommit';
  import type { GitlabDeploymentHook } from '@/core/typings/GitlabDeploymentHook';
  import type { SlackOption } from '@/core/typings/SlackOption';
  import type { StaticSelectAction } from '@/core/typings/StaticSelectAction';
  import { cleanViewState } from '@/core/utils/cleanViewState';
  import type {
    ReleaseManager,
    ReleaseModalData,
  } from '../../../typings/ReleaseManager';
  import type { ReleaseStateUpdate } from '../../../typings/ReleaseStateUpdate';
  import { addLoaderToReleaseModal } from '../utils/addLoaderToReleaseModal';
  import { slackifyChangelog } from '../utils/slackifyChangelog';
  import { defaultReleaseManager } from './defaultReleaseManager';
  import { federationReleaseTagManager } from './federationReleaseTagManager';
  import { stableDateReleaseTagManager } from './stableDateReleaseTagManager';
  
  const APP_NAME_DEFAULT = 'spartacux';
  const APP_NAME_OTHER = 'other';
  const ENV_VARIANTS = 10;
  const APP_NAME = 'spartacux';
  
  async function blockActionsHandler(
    { view }: BlockActionsPayload,
    action: StaticSelectAction
  ): Promise<void> {
    const { action_id } = action;
  
    switch (action_id) {
      case 'release-enter-app-action':
      case 'release-select-app-action': {
        const { blocks, id, state } = view;
        const appBlockIndex = blocks.findIndex(
          (block) => block.block_id === 'release-app-block'
        );
  
        blocks.splice(appBlockIndex + 1);
        cleanViewState(view);
  
        const projectId = parseInt(
          state.values['release-project-block']?.['release-select-project-action']
            ?.selected_option?.value,
          10
        );
  
        const projectOptions = ((blocks[0] as InputBlock).element as StaticSelect)
          .options as SlackOption[];
  
        const viewPromise = buildReleaseModalView({
          projectId,
          projectOptions,
          view,
        });
  
        await addLoaderToReleaseModal(view);
  
        await slackBotWebClient.views.update({
          view_id: id,
          view: await viewPromise,
        });
        break;
      }
  
      default:
        logger.error(new Error(`Unknown block action: ${action_id}`));
    }
  }
  
  async function getReleaseStateUpdate(
    release: DataRelease,
    deploymentHook: GitlabDeploymentHook
  ): Promise<ReleaseStateUpdate[]> {
    if (deploymentHook === undefined) {
      const productionEnvironment = release.successfulDeployments.find(
        isProductionDeployment
      );
  
      if (productionEnvironment === undefined) {
        return [];
      }
  
      const releaseStateUpdate: ReleaseStateUpdate = {
        deploymentState: 'completed',
        environment: 'production',
      };
  
      if (!isMultipleProjectEnvironment(productionEnvironment)) {
        releaseStateUpdate.projectDisplayName = getFederatedAppDisplayName(
          productionEnvironment
        );
      }
      return [releaseStateUpdate];
    }
  
    const { environment, status } = deploymentHook;
  
    if (!isMultipleProjectEnvironment(environment)) {
      const appName = environment.split('/').pop();
      const projectDisplayName = `${APP_NAME_DEFAULT}→${appName}`;
  
      return (
        await defaultReleaseManager.getReleaseStateUpdate(release, deploymentHook)
      ).map((update) => ({ ...update, projectDisplayName }));
    }
  
    if (isStagingDeployment(environment)) {
      const failedDeployments =
        release.failedDeployments.filter(isStagingDeployment);
      const startedDeployments =
        release.startedDeployments.filter(isStagingDeployment);
      const successfulDeployments =
        release.successfulDeployments.filter(isStagingDeployment);
  
      if (status === 'failed' && failedDeployments.length === 1) {
        return [{ deploymentState: 'failed', environment: 'staging' }];
      }
      if (status === 'running' && startedDeployments.length === 1) {
        return [{ deploymentState: 'deploying', environment: 'staging' }];
      }
      if (status === 'success' && successfulDeployments.length >= ENV_VARIANTS) {
        return [{ deploymentState: 'monitoring', environment: 'staging' }];
      }
    } else if (isProductionDeployment(environment)) {
      const failedDeployments = release.failedDeployments.filter(
        isProductionDeployment
      );
      const startedDeployments = release.startedDeployments.filter(
        isProductionDeployment
      );
      const successfulDeployments = release.successfulDeployments.filter(
        isProductionDeployment
      );
  
      if (status === 'failed' && failedDeployments.length === 1) {
        return [{ deploymentState: 'failed', environment: 'production' }];
      }
      if (status === 'running' && startedDeployments.length === 1) {
        return [
          { deploymentState: 'completed', environment: 'staging' },
          { deploymentState: 'deploying', environment: 'production' },
        ];
      }
      if (status === 'success' && successfulDeployments.length >= ENV_VARIANTS) {
        return [{ deploymentState: 'monitoring', environment: 'production' }];
      }
    }
    return [];
  }
  
  async function isReadyToRelease(
    { projectId, tagName }: DataRelease,
    mainBranchPipelineId: number
  ): Promise<boolean> {
    if (federationReleaseTagManager.isReleaseTag(tagName)) {
      return true;
    }
  
    const bridges = (
      await fetchPipelineBridges(projectId, mainBranchPipelineId)
    ).filter((bridge) => bridge.name.startsWith(`build_${APP_NAME_DEFAULT}`));
  
    const haveChildPipelinesBeenStarted = bridges.every(
      (bridge) => !!bridge.downstream_pipeline
    );
  
    if (bridges.length === 0 || !haveChildPipelinesBeenStarted) {
      return false;
    }
  
    const childPipelinesJobs = await Promise.all(
      bridges.map((bridge) =>
        fetchPipelineJobs(
          projectId,
          (bridge.downstream_pipeline as GitlabDownstreamPipeline).id
        )
      )
    );
  
    const dockerBuildJobs = childPipelinesJobs
      .flat()
      .filter((job) => job.name === 'build_image');
  
    return (
      dockerBuildJobs.length >= bridges.length &&
      dockerBuildJobs.every((job) => job.status === 'success')
    );
  }
  
  async function buildReleaseModalView({
    projectId,
    projectOptions,
    view,
  }: ReleaseModalData): Promise<View> {
    let appName = APP_NAME_DEFAULT;
    let previousReleaseTagName: string | undefined;
  
    if (view !== undefined) {
      const { state } = view;
  
      appName = getAppNameFromViewState(state);
  
      previousReleaseTagName =
        state.values['release-previous-tag-block']?.[
          'release-select-previous-tag-action'
        ]?.selected_option?.value;
    }
  
    const isMultiProjectApp = appName === APP_NAME;
    const projectTags = await fetchProjectTags(projectId);
    const appNames = [
      APP_NAME,
      ...new Set(
        projectTags
          .filter(({ name }) => federationReleaseTagManager.isReleaseTag(name))
          .map(({ name }) => federationReleaseTagManager.extractAppName(name))
          .sort()
      ),
      APP_NAME_OTHER,
    ];
  
    const appOptions = appNames.map((name) => ({
      text: {
        type: 'plain_text',
        text: name,
      },
      value: name,
    })) as SlackOption[];
  
    const tags = projectTags
      .filter(({ name }) =>
        isMultiProjectApp
          ? stableDateReleaseTagManager.isReleaseTag(name)
          : federationReleaseTagManager.isReleaseTag(name, appName)
      )
      .slice(0, 5);
  
    const previousReleaseTag =
      previousReleaseTagName !== undefined
        ? tags.find(({ name }) => name === previousReleaseTagName)
        : undefined;
  
    if (
      previousReleaseTagName !== undefined &&
      previousReleaseTag === undefined
    ) {
      throw new Error(`Unable to find a tag named ${previousReleaseTagName}`);
    }
  
    if (appName && tags.length > 0 && previousReleaseTagName === undefined) {
      previousReleaseTagName = tags[0].name;
    }
  
    const changelog = previousReleaseTagName
      ? await generateChangelog(projectId, previousReleaseTagName, (commit) =>
          filterChangelogByApp(commit, appName)
        )
      : '';
  
    const previousReleaseOptions = tags.map(({ name }) => ({
      text: {
        type: 'plain_text',
        text: name,
      },
      value: name,
    })) as SlackOption[];
  
    return {
      type: 'modal',
      callback_id: 'release-create-modal',
      title: {
        type: 'plain_text',
        text: 'Release',
      },
      submit: {
        type: 'plain_text',
        text: appName ? 'Start' : 'Update',
      },
      notify_on_close: false,
      blocks: [
        {
          type: 'input',
          block_id: 'release-project-block',
          dispatch_action: true,
          element: {
            type: 'static_select',
            action_id: 'release-select-project-action',
            initial_option: projectOptions?.[0],
            options: projectOptions,
            placeholder: {
              type: 'plain_text',
              text: 'Select the project',
            },
          },
          label: {
            type: 'plain_text',
            text: 'Project',
          },
        },
        {
          type: 'input',
          block_id: 'release-app-block',
          dispatch_action: true,
          element: appNames.includes(appName)
            ? {
                type: 'static_select',
                action_id: 'release-select-app-action',
                initial_option: appOptions.find(
                  (option) => option.value === appName
                ),
                options: appOptions,
                placeholder: {
                  type: 'plain_text',
                  text: 'Select the app',
                },
              }
            : {
                type: 'plain_text_input',
                action_id: 'release-enter-app-action',
                placeholder: {
                  type: 'plain_text',
                  text: 'Enter the app',
                },
                focus_on_load: true,
              },
          label: {
            type: 'plain_text',
            text: 'App',
          },
        },
        appName && [
          {
            type: 'input',
            block_id: 'release-tag-block',
            element: {
              type: 'plain_text_input',
              action_id: 'release-tag-action',
              initial_value: isMultiProjectApp
                ? stableDateReleaseTagManager.createReleaseTag()
                : federationReleaseTagManager.createReleaseTag(appName),
            },
            label: {
              type: 'plain_text',
              text: 'Release tag',
            },
          },
          previousReleaseOptions.length > 0
            ? [
                {
                  type: 'input',
                  block_id: 'release-previous-tag-block',
                  dispatch_action: true,
                  element: {
                    type: 'static_select',
                    action_id: 'release-select-previous-tag-action',
                    initial_option: previousReleaseOptions[0],
                    options: previousReleaseOptions,
                    placeholder: {
                      type: 'plain_text',
                      text: 'Select the previous release tag',
                    },
                  },
                  label: {
                    type: 'plain_text',
                    text: 'Previous release tag',
                  },
                },
                {
                  type: 'context',
                  block_id: 'release-previous-tag-info-block',
                  elements: [
                    {
                      type: 'plain_text',
                      text: 'This should be changed only whether the previous release has been aborted.',
                    },
                  ],
                },
              ]
            : [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: '*Previous release tag*',
                  },
                },
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: 'No previous release tag has been found.',
                  },
                },
              ],
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Changelog*',
            },
          },
          {
            type: 'section',
            block_id: 'release-changelog-block',
            text: {
              type: 'mrkdwn',
              text: changelog
                ? slackifyChangelog(changelog)
                : 'No change has been found.',
            },
          },
        ],
      ]
        .flat(2)
        .filter(Boolean) as (KnownBlock | Block)[],
    };
  }
  
  function filterChangelog(commit: GitlabCommit, viewState: any): boolean {
    const appName = getAppNameFromViewState(viewState);
    return filterChangelogByApp(commit, appName);
  }
  
  function filterChangelogByApp(
    { message }: GitlabCommit,
    appName: string
  ): boolean {
    const commitApps = message
      .match(/^APP: ?([a-z, ]+)$/im)?.[1]
      ?.split(',')
      .map((app) => app.trim().toLowerCase()) ?? [`${APP_NAME_DEFAULT}`]; // Filter not mandatory for Multi Project app
  
    return commitApps.includes(appName);
  }
  
  function filterReleasesToClean(
    newRelease: DataRelease,
    oldReleases: DataRelease[]
  ): DataRelease[] {
    const { tagName } = newRelease;
  
    if (federationReleaseTagManager.isReleaseTag(tagName)) {
      const appName = federationReleaseTagManager.extractAppName(tagName);
  
      return oldReleases.filter((release) =>
        federationReleaseTagManager.isReleaseTag(release.tagName, appName)
      );
    }
    return oldReleases.filter((release) =>
      stableDateReleaseTagManager.isReleaseTag(release.tagName)
    );
  }
  
  function getAppNameFromViewState(viewState: any): string {
    const releaseAppBlock = viewState.values['release-app-block'];
  
    let appName =
      releaseAppBlock?.['release-select-app-action']?.selected_option?.value ??
      releaseAppBlock?.['release-enter-app-action']?.value ??
      APP_NAME_DEFAULT;
  
    if (appName === APP_NAME_OTHER) {
      appName = '';
    }
    return appName;
  }
  
  function getFederatedAppDisplayName(environment: string): string {
    const appName = environment.split('/').pop();
    return `${APP_NAME_DEFAULT}→${appName}`;
  }
  
  function isProductionDeployment(environment: string): boolean {
    return environment.startsWith('production');
  }
  
  function isMultipleProjectEnvironment(environment: string): boolean {
    return /\/[a-z]{2}-[a-z0-9]{3}$/.test(environment);
  }
  
  function isStagingDeployment(environment: string): boolean {
    return environment.startsWith('staging');
  }
  
  export const multipleProjectReleaseManager: ReleaseManager = {
    blockActionsHandler,
    buildReleaseModalView,
    filterChangelog,
    filterReleasesToClean,
    getReleaseStateUpdate,
    isReadyToRelease,
  };
  