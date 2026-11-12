import {
  GithubApiError,
  fetchBranchCommits,
  fetchComparedCommits,
  fetchPullRequestCommits,
  fetchRepositoryById,
} from '@/core/services/github';
import type { GithubCommit } from '@/core/typings/GithubModels';
import type { GitlabCommit } from '@/core/typings/GitlabCommit';
import { formatTicketLink } from './formatTicketLink';

// "Merge pull request #12 from owner/branch"
const MERGE_COMMIT_REGEX = /^Merge pull request #(\d+) /;
// "feat: add something (#12)"
const SQUASH_COMMIT_REGEX = /\(#(\d+)\)$/;

interface ChangelogEntry {
  commit: GitlabCommit;
  /** Unset when the pull request is not in this repository. */
  pullRequestUrl?: string;
}

/**
 * Same output as the GitLab changelog: one line per pull request commit,
 * linked to its pull request. Pull requests are found from merge and squash
 * commit messages, so no API call is made per commit.
 */
export async function generateGithubChangelog(
  repositoryId: number,
  previousReleaseTagName: string | undefined,
  filter: (commit: GitlabCommit) => boolean,
): Promise<string> {
  const repository = await fetchRepositoryById(repositoryId);
  const commits =
    previousReleaseTagName !== undefined
      ? await fetchComparedCommits(
          repositoryId,
          previousReleaseTagName,
          repository.default_branch,
        )
      : await fetchBranchCommits(repositoryId, repository.default_branch);

  const pullRequestUrl = (number: string) =>
    `${repository.html_url}/pull/${number}`;
  const entries: ChangelogEntry[] = [];

  for (const commit of commits) {
    const title = getTitle(commit);
    const mergedNumber = title.match(MERGE_COMMIT_REGEX)?.[1];
    const squashedNumber = title.match(SQUASH_COMMIT_REGEX)?.[1];

    if (mergedNumber !== undefined) {
      const pullRequestCommits = await fetchMergedPullRequestCommits(
        repositoryId,
        parseInt(mergedNumber, 10),
      );

      if (pullRequestCommits === undefined) {
        entries.push({ commit: toGitlabCommit(commit) });
        continue;
      }
      entries.push(
        ...pullRequestCommits.map((pullRequestCommit) => ({
          commit: toGitlabCommit(pullRequestCommit),
          pullRequestUrl: pullRequestUrl(mergedNumber),
        })),
      );
    } else if (squashedNumber !== undefined) {
      entries.push({
        commit: toGitlabCommit(commit, title.replace(SQUASH_COMMIT_REGEX, '')),
        pullRequestUrl: pullRequestUrl(squashedNumber),
      });
    }
  }

  if (commits.length > 0 && entries.length === 0) {
    return commits
      .map((commit) => toGitlabCommit(commit))
      .filter(filter)
      .map(({ message, title }) => `- ${title}${formatTicketLink(message)}`)
      .join('\n');
  }

  const seenCommitIds = new Set<string>();

  return entries
    .filter(({ commit }) => {
      // A commit merged twice (release branches) is listed once.
      if (seenCommitIds.has(commit.id)) return false;
      seenCommitIds.add(commit.id);
      return filter(commit);
    })
    .map(
      ({ commit, pullRequestUrl: url }) =>
        `- ${url === undefined ? commit.title : `[${commit.title}](${url})`}${formatTicketLink(commit.message)}`,
    )
    .join('\n');
}

/**
 * A fork inherits the merge commits of its upstream, whose pull request
 * numbers do not exist in the fork: those are listed as plain commits.
 */
async function fetchMergedPullRequestCommits(
  repositoryId: number,
  number: number,
): Promise<GithubCommit[] | undefined> {
  try {
    return await fetchPullRequestCommits(repositoryId, number);
  } catch (error) {
    if (error instanceof GithubApiError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

function getTitle(commit: GithubCommit): string {
  return commit.commit.message.split('\n')[0].trim();
}

/** Release plugins filter GitLab shaped commits. */
function toGitlabCommit(
  commit: GithubCommit,
  title = getTitle(commit),
): GitlabCommit {
  const { author, committer, message } = commit.commit;

  return {
    author_email: author?.email ?? '',
    author_name: author?.name ?? '',
    authored_date: author?.date ?? '',
    committed_date: committer?.date ?? '',
    committer_email: committer?.email ?? '',
    committer_name: committer?.name ?? '',
    created_at: committer?.date ?? '',
    id: commit.sha,
    message,
    parent_ids: [],
    short_id: commit.sha.slice(0, 8),
    title: title.trim(),
    web_url: commit.html_url,
  };
}
