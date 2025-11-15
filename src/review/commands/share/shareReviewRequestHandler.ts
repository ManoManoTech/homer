import type { Response } from 'express';
import { HTTP_STATUS_NO_CONTENT, MERGE_REQUEST_OPEN_STATES } from '@/constants';
import {
  addReviewToChannel,
  getProjectsByChannelId,
} from '@/core/services/data';
import { logger } from '@/core/services/logger';
import { ProviderFactory } from '@/core/services/providers/ProviderFactory';
import { slackBotWebClient } from '@/core/services/slack';
import { getProjectIdValue } from '@/core/typings/Data';
import type {
  SlackExpressRequest,
  SlackSlashCommandResponse,
} from '@/core/typings/SlackSlashCommand';
import type { UnifiedPullRequest } from '@/core/typings/UnifiedModels';
import { parseProviderUrl } from '@/core/utils/parseProviderUrl';
import { buildHelpMessage } from '@/core/viewBuilders/buildHelpMessage';
import { buildMRSelectionEphemeral } from './viewBuilders/buildMRSelectionEphemeral';
import { buildReviewMessage } from './viewBuilders/buildReviewMessage';

export async function shareReviewRequestHandler(
  req: SlackExpressRequest,
  res: Response,
) {
  const { text, channel_id, user_id } = req.body as SlackSlashCommandResponse;
  const query = text.split(' ').slice(1).join(' ');

  if (query.length === 0) {
    res.send(buildHelpMessage(channel_id));
    return;
  }

  res.sendStatus(HTTP_STATUS_NO_CONTENT);

  // Check if query is a direct PR/MR URL
  const parsedUrl = parseProviderUrl(query);
  if (parsedUrl) {
    logger.info(
      `Direct URL detected: ${parsedUrl.provider} ${parsedUrl.projectId} #${parsedUrl.number}`,
    );

    try {
      // Get the appropriate provider
      const provider = ProviderFactory.getProvider(parsedUrl.provider);

      // Directly fetch the PR/MR without searching through projects
      const pullRequest = await provider.fetchPullRequest(
        parsedUrl.projectId,
        parsedUrl.number,
      );

      // Post the review message
      const { ts } = await slackBotWebClient.chat.postMessage(
        await buildReviewMessage(
          channel_id,
          pullRequest.projectId,
          pullRequest.iid,
        ),
      );

      // Save review to database
      await addReviewToChannel({
        channelId: channel_id,
        mergeRequestIid: pullRequest.iid,
        projectId:
          typeof pullRequest.projectId === 'number'
            ? pullRequest.projectId
            : null,
        projectIdString:
          typeof pullRequest.projectId === 'string'
            ? pullRequest.projectId
            : null,
        providerType: parsedUrl.provider,
        ts: ts as string,
      });

      logger.debug(
        `Direct URL review posted successfully: ${parsedUrl.provider} ${parsedUrl.projectId} #${parsedUrl.number}`,
      );
      return;
    } catch (error) {
      logger.error(
        { error, url: parsedUrl.url },
        `Failed to fetch PR/MR from URL: ${parsedUrl.url}`,
      );
      await slackBotWebClient.chat.postEphemeral({
        channel: channel_id,
        user: user_id,
        text: `Failed to fetch merge request from URL \`${
          parsedUrl.url
        }\` :homer-stressed:\n\nError: ${(error as Error).message}`,
      });
      return;
    }
  }

  // Not a URL - search through configured projects
  const projects = await getProjectsByChannelId(channel_id);

  // Search across all projects using their respective providers
  const allPullRequests: UnifiedPullRequest[] = [];
  const seenUrls = new Set<string>();

  for (const project of projects) {
    try {
      const projectId = getProjectIdValue(project);
      const provider = ProviderFactory.getProviderForProject(projectId);
      const pullRequests = await provider.searchPullRequests(
        [projectId],
        query,
        MERGE_REQUEST_OPEN_STATES,
      );

      // Deduplicate by webUrl to avoid showing the same PR multiple times
      for (const pr of pullRequests) {
        if (!seenUrls.has(pr.webUrl)) {
          seenUrls.add(pr.webUrl);
          allPullRequests.push(pr);
        }
      }
    } catch {
      // Continue searching other projects if one fails
      continue;
    }
  }

  if (allPullRequests.length === 1) {
    const { iid, projectId } = allPullRequests[0];
    const providerType = ProviderFactory.detectProviderType(projectId);

    const { ts } = await slackBotWebClient.chat.postMessage(
      await buildReviewMessage(channel_id, projectId, iid),
    );

    await addReviewToChannel({
      channelId: channel_id,
      mergeRequestIid: iid,
      projectId: typeof projectId === 'number' ? projectId : null,
      projectIdString: typeof projectId === 'string' ? projectId : null,
      providerType,
      ts: ts as string,
    });
  } else if (allPullRequests.length === 0) {
    await slackBotWebClient.chat.postEphemeral({
      channel: channel_id,
      user: user_id,
      text: `No merge request matches \`${query}\` :homer-stressed:`,
    });
  } else {
    // Convert UnifiedPullRequest to format expected by buildMRSelectionEphemeral
    const mergeRequests = allPullRequests.map((pr) => ({
      id: pr.id,
      iid: pr.iid,
      title: pr.title,
      description: pr.description,
      state: pr.state,
      web_url: pr.webUrl,
      source_branch: pr.sourceBranch,
      target_branch: pr.targetBranch,
      author: {
        id: typeof pr.author.id === 'number' ? pr.author.id : 0,
        username: pr.author.username,
        name: pr.author.name,
        avatar_url: pr.author.avatarUrl || null,
        state: 'active' as const,
        web_url: pr.author.webUrl || '',
      },
      project_id: pr.projectId,
      user_notes_count: pr.discussionCount,
      work_in_progress: pr.draft,
      labels: pr.labels,
      // Add minimal required fields (empty assignee since we don't have this info in UnifiedPullRequest)
      assignee: {
        id: 0,
        username: '',
        name: '',
        avatar_url: null,
        state: 'active' as const,
        web_url: '',
      },
      assignees: [],
      created_at: pr.createdAt,
      updated_at: pr.updatedAt,
      closed_at: pr.closedAt || null,
      closed_by: null,
      merge_status: (pr.mergeable ? 'can_be_merged' : 'cannot_be_merged') as
        | 'can_be_merged'
        | 'cannot_be_merged',
      references: { full: '', relative: '', short: '' },
      sha: '',
      merge_commit_sha: null,
      squash: false,
      squash_commit_sha: null,
      allow_collaboration: false,
      allow_maintainer_to_push: false,
      discussion_locked: false,
      downvotes: 0,
      upvotes: 0,
      force_remove_source_branch: false,
      merge_when_pipeline_succeeds: false,
      should_remove_source_branch: false,
      source_project_id: pr.projectId,
      target_project_id: pr.projectId,
      milestone: {} as any,
      task_completion_status: { count: 0, completed_count: 0 },
      time_stats: {
        human_time_estimate: null,
        human_total_time_spent: null,
        time_estimate: 0,
        total_time_spent: 0,
      },
    }));

    await slackBotWebClient.chat.postEphemeral(
      buildMRSelectionEphemeral({
        channelId: channel_id,
        mergeRequests,
        query,
        userId: user_id,
      }),
    );
  }
}
