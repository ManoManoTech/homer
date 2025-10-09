import { CONFIG } from '@/config';
import {
  fetchMergeRequestByIid,
  fetchMergeRequestCommits,
  fetchProjectCommit,
  fetchProjectCommits,
  fetchProjectCommitsSince,
  fetchProjectTag,
} from '@/core/services/gitlab';
import type { GitlabCommit } from '@/core/typings/GitlabCommit';
import type { GitlabMergeRequestDetails } from '@/core/typings/GitlabMergeRequest';

const DEFAULT_BRANCHES = ['main', 'master', 'release'];
const TICKET_ID_MATCHER = '{ticketId}';

export async function generateChangelog(
  projectId: number,
  previousReleaseTagName: string | undefined,
  filter: (commit: GitlabCommit) => boolean = () => true,
): Promise<string> {
  let commits: GitlabCommit[];

  if (previousReleaseTagName !== undefined) {
    const previousReleaseTag = await fetchProjectTag(
      projectId,
      previousReleaseTagName,
    );

    commits = await fetchProjectCommitsSince(
      projectId,
      new Date(
        new Date(previousReleaseTag.commit.created_at).getTime() + 1000,
      ).toISOString(),
    );
  } else {
    commits = await fetchProjectCommits(projectId);
  }

  const mergeRequestCommitsMaps = (
    await Promise.all(
      commits
        .filter(filterDefaultBranchMergeCommits)
        .map(async (mergeCommit) =>
          generateMergeRequestCommitsMap(projectId, mergeCommit),
        ),
    )
  ).flat();

  if (commits.length > 0 && mergeRequestCommitsMaps.length === 0) {
    return commits
      .filter(filter)
      .map(({ message, title }) => {
        const ticketId = getTicketId(message);

        return `- ${title}${
          ticketId
            ? ` - [${ticketId}](${CONFIG.ticketManagementUrlPattern.replace(
                TICKET_ID_MATCHER,
                ticketId,
              )})`
            : ''
        }`;
      })
      .join('\n');
  }

  return removeDuplicatedCommits(mergeRequestCommitsMaps)
    .filter(({ mergeRequestCommit }) => filter(mergeRequestCommit))
    .map(({ mergeRequest, mergeRequestCommit }) => {
      const ticketId = getTicketId(mergeRequestCommit.message);

      return `- [${mergeRequestCommit.title}](${mergeRequest.web_url})${
        ticketId
          ? ` - [${ticketId}](${CONFIG.ticketManagementUrlPattern.replace(
              TICKET_ID_MATCHER,
              ticketId,
            )})`
          : ''
      }`;
    })
    .join('\n');
}

interface MergeRequestCommitMap {
  mergeRequest: GitlabMergeRequestDetails;
  mergeRequestCommit: GitlabCommit;
}

function filterDefaultBranchMergeCommits({ message }: GitlabCommit): boolean {
  return (
    DEFAULT_BRANCHES.some((branch) => message.includes(`into '${branch}'`)) &&
    message.includes('See merge request')
  );
}

async function generateMergeRequestCommitsMap(
  projectId: number,
  mergeCommit: GitlabCommit,
): Promise<MergeRequestCommitMap[]> {
  const { message } = mergeCommit;
  const mergeRequestIid = parseInt(
    message.match(/See merge request.*!(\d+)/)?.[1] ?? '',
    10,
  );

  if (!Number.isInteger(mergeRequestIid)) {
    throw new Error(
      `Unable to retrieve merge request iid of merge commit ${message}`,
    );
  }

  const mergeRequest = await fetchMergeRequestByIid(projectId, mergeRequestIid);
  const { squash, squash_commit_sha } = mergeRequest;

  if (squash && !squash_commit_sha) {
    throw new Error(
      `Gitlab API did not provide squash_commit_sha for merge request ${mergeRequestIid} of project ${projectId}`,
    );
  }

  if (squash_commit_sha) {
    return [
      {
        mergeRequest,
        mergeRequestCommit: await fetchProjectCommit(
          projectId,
          squash_commit_sha,
        ),
      },
    ];
  }

  const mergeRequestCommits = await fetchMergeRequestCommits(
    projectId,
    mergeRequestIid,
  );

  return (
    await Promise.all(
      mergeRequestCommits.map(async (commit) => {
        if (commit.message.includes('See merge request')) {
          return generateMergeRequestCommitsMap(projectId, commit);
        }
        return {
          mergeRequest,
          mergeRequestCommit: commit,
        };
      }),
    )
  ).flat();
}

function getTicketId(commitMessage: string): string | undefined {
  return commitMessage
    .match(/[A-Z]+-[0-9]+/i)?.[0]
    ?.trim()
    ?.toUpperCase();
}

/**
 * When using release branches, the "same" commits will come either from the
 * release branch and the original one, so we list duplicates and keep the
 * oldest one.
 */
function removeDuplicatedCommits(
  mergeRequestCommitsMaps: MergeRequestCommitMap[],
): MergeRequestCommitMap[] {
  //
  return mergeRequestCommitsMaps.filter((mergeRequestCommitsMap) => {
    // We list all the mergeRequestCommitsMaps with the same commit message
    const duplicatedMaps = mergeRequestCommitsMaps.filter(
      (map) =>
        map.mergeRequestCommit.message ===
        mergeRequestCommitsMap.mergeRequestCommit.message,
    );

    // We pick the oldest one
    const oldestDuplicatedMap = duplicatedMaps.reduce((mapToKeep, map) =>
      new Date(map.mergeRequestCommit.created_at).getTime() <
      new Date(mapToKeep.mergeRequestCommit.created_at).getTime()
        ? map
        : mapToKeep,
    );

    // We keep only the oldest mergeRequestCommitsMap with this commit
    // message
    return mergeRequestCommitsMap === oldestDuplicatedMap;
  });
}
