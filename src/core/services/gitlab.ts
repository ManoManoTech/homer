import type { RequestInit } from 'node-fetch';
import fetch from 'node-fetch';
import { GITLAB_URL, MERGE_REQUEST_OPEN_STATES } from '@/constants';
import type { DataProject } from '@/core/typings/Data';
import type { GitlabApprovalsResponse } from '@/core/typings/GitlabApprovalsResponse';
import type { GitlabBridge } from '@/core/typings/GitlabBridge';
import type { GitlabCiVariable } from '@/core/typings/GitlabCiVariable';
import type { GitlabCommit } from '@/core/typings/GitlabCommit';
import type { GitlabJob } from '@/core/typings/GitlabJob';
import type {
  GitlabMergeRequest,
  GitlabMergeRequestDetails,
} from '@/core/typings/GitlabMergeRequest';
import type { GitlabPipeline } from '@/core/typings/GitlabPipeline';
import type {
  GitlabProject,
  GitlabProjectDetails,
} from '@/core/typings/GitlabProject';
import type { GitlabTag } from '@/core/typings/GitlabTag';
import type { GitlabUser, GitlabUserDetails } from '@/core/typings/GitlabUser';
import { getEnvVariable } from '@/core/utils/getEnvVariable';

const BASE_API_URL = `${GITLAB_URL}/api/v4`;
const COREBOT_TOKEN = getEnvVariable('COREBOT_TOKEN');
const MERGE_REQUEST_ID_REGEX = /^!?\d+$/;
const MERGE_REQUEST_URL_REGEX = /^http.*\/merge_requests\/(\d+)$/;

export async function cancelPipeline(
  projectId: number,
  pipelineId: number
): Promise<void> {
  const response = await callAPI<any>(
    `/projects/${projectId}/pipelines/${pipelineId}/cancel`,
    { method: 'post' }
  );

  if (response?.id === undefined) {
    throw new Error(
      `Unable to cancel the pipeline ${pipelineId} of project ${projectId}: ${JSON.stringify(
        response
      )}`
    );
  }
}

export async function createRelease(
  projectId: number,
  commitId: string,
  tagName: string,
  description: string
): Promise<void> {
  const body = {
    description,
    tag_name: tagName,
    ref: commitId,
  };
  const response = await callAPI<any>(`/projects/${projectId}/releases`, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'post',
  });

  if (response?.name === undefined) {
    throw new Error(
      `Unable to create release ${tagName} for project ${projectId}: ${JSON.stringify(
        {
          body,
          response,
        }
      )}`
    );
  }
}

export async function fetchBranchPipelines(
  projectId: number,
  branchName: string
): Promise<GitlabPipeline[]> {
  return callAPI(`/projects/${projectId}/pipelines?ref=${branchName}`);
}

export async function fetchMergeRequestApprovers(
  projectId: number,
  mergeRequestIid: number
): Promise<GitlabUser[]> {
  return (
    await callAPI<GitlabApprovalsResponse>(
      `/projects/${projectId}/merge_requests/${mergeRequestIid}/approvals`
    )
  ).approved_by.map(({ user }) => user);
}

export async function fetchMergeRequestCommits(
  projectId: number,
  mergeRequestIid: number
): Promise<GitlabCommit[]> {
  return callAPI(
    `/projects/${projectId}/merge_requests/${mergeRequestIid}/commits?per_page=100`
  );
}

export async function fetchMergeRequestByIid(
  projectId: number,
  mergeRequestIid: number
): Promise<GitlabMergeRequestDetails> {
  const mergeRequest = await callAPI<GitlabMergeRequestDetails>(
    `/projects/${projectId}/merge_requests/${mergeRequestIid}`
  );

  if (mergeRequest.iid === undefined) {
    throw new Error(
      `Unable to find merge request with iid ${mergeRequestIid}: ${JSON.stringify(
        mergeRequest
      )}`
    );
  }
  return mergeRequest;
}

export async function fetchMergeRequestsByBranchName(
  projectId: number,
  branchName: string
): Promise<GitlabMergeRequest[]> {
  return callAPI(
    `/projects/${projectId}/merge_requests?source_branch=${branchName}`
  );
}

export async function fetchPipelineBridges(
  projectId: number,
  pipelineId: number
): Promise<GitlabBridge[]> {
  const bridges = await callAPI(
    `/projects/${projectId}/pipelines/${pipelineId}/bridges?per_page=100`
  );

  if (!Array.isArray(bridges)) {
    throw new Error(
      `Unable to get bridges for pipeline ${pipelineId} of project ${projectId}: ${JSON.stringify(
        bridges
      )}`
    );
  }
  return bridges;
}

export async function fetchPipelinesByRef(
  projectId: number,
  ref: string
): Promise<GitlabPipeline[]> {
  const pipelines = await callAPI<GitlabProjectDetails>(
    `/projects/${projectId}/pipelines?ref=${ref}`
  );

  if (!Array.isArray(pipelines)) {
    throw new Error(
      `Unable to find pipelines with ref ${ref}: ${JSON.stringify(pipelines)}`
    );
  }
  return pipelines;
}

export async function fetchPipelineJobs(
  projectId: number,
  pipelineId: number
): Promise<GitlabJob[]> {
  return callAPI(
    `/projects/${projectId}/pipelines/${pipelineId}/jobs?per_page=100`
  );
}

export async function fetchProjectById(
  id: number
): Promise<GitlabProjectDetails> {
  const project = await callAPI<GitlabProjectDetails>(`/projects/${id}`);

  if (project.id === undefined) {
    throw new Error(
      `Unable to find project with id ${id}: ${JSON.stringify(project)}`
    );
  }
  return project;
}

export async function fetchProjectCommit(
  projectId: number,
  commitId: string
): Promise<GitlabCommit> {
  return callAPI(`/projects/${projectId}/repository/commits/${commitId}`);
}

export async function fetchProjectCommits(
  projectId: number
): Promise<GitlabCommit[]> {
  return callAPI(`/projects/${projectId}/repository/commits?per_page=100`);
}

export async function fetchProjectCommitsSince(
  projectId: number,
  since: string
): Promise<GitlabCommit[]> {
  return callAPI(
    `/projects/${projectId}/repository/commits?since=${new Date(
      since
    ).toISOString()}&per_page=100`
  );
}

export async function fetchProjectTag(
  projectId: number,
  tagName: string
): Promise<GitlabTag> {
  const tag = await callAPI<GitlabTag>(
    `/projects/${projectId}/repository/tags/${tagName}`
  );

  if (tag.name === undefined) {
    throw new Error(`Unable to find the tag named ${tagName}`);
  }
  return tag;
}

export async function fetchProjectTags(
  projectId: number
): Promise<GitlabTag[]> {
  return callAPI(`/projects/${projectId}/repository/tags?per_page=100`);
}

export async function fetchReviewers(
  projectId: number,
  mergeRequestIid: number
): Promise<GitlabUser[]> {
  return (
    await callAPI<{ user: GitlabUser }[]>(
      `/projects/${projectId}/merge_requests/${mergeRequestIid}/reviewers`
    )
  ).map(({ user }) => user);
}

export async function fetchUserById(
  id: number
): Promise<GitlabUserDetails | undefined> {
  return callAPI(`/users/${id}`);
}

export async function rebaseMergeRequest(
  projectId: number,
  mergeRequestIid: number
): Promise<void> {
  const response = await callAPI<any>(
    `/projects/${projectId}/merge_requests/${mergeRequestIid}/rebase`,
    { method: 'put' }
  );

  if (response?.rebase_in_progress !== true) {
    throw new Error(
      `Unable to rebase merge request ${mergeRequestIid} of project ${projectId}: ${JSON.stringify(
        response
      )}`
    );
  }
}

export async function runPipeline(
  projectId: number,
  branchName: string,
  variables: GitlabCiVariable[] = []
): Promise<void> {
  const body = {
    ref: branchName,
    variables,
  };
  const response = await callAPI<any>(`/projects/${projectId}/pipeline`, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'post',
  });

  if (response?.created_at === undefined) {
    throw new Error(
      `Unable to create a pipeline on branch ${branchName} of project ${projectId}: ${JSON.stringify(
        response
      )}`
    );
  }
}

export async function searchMergeRequests(
  search: string,
  projects: DataProject[]
): Promise<GitlabMergeRequest[]> {
  let projectMergeRequestPromises;

  if (MERGE_REQUEST_ID_REGEX.test(search)) {
    const iid = search.replace('!', '');

    projectMergeRequestPromises = projects.map(async ({ projectId }) =>
      callAPI(`/projects/${projectId}/merge_requests/${iid}`)
    );
  } else if (MERGE_REQUEST_URL_REGEX.test(search)) {
    const iid = search.match(MERGE_REQUEST_URL_REGEX)![1];

    projectMergeRequestPromises = projects.map(async ({ projectId }) =>
      callAPI(`/projects/${projectId}/merge_requests/${iid}`)
    );
  } else {
    projectMergeRequestPromises = projects.map(async ({ projectId }) =>
      callAPI(
        `/projects/${projectId}/merge_requests?state=opened&search=${encodeURIComponent(
          search
        )}`
      )
    );
  }

  return (await Promise.all(projectMergeRequestPromises))
    .flat()
    .filter((mergeRequest) =>
      MERGE_REQUEST_OPEN_STATES.includes(
        (mergeRequest as GitlabMergeRequest)?.state
      )
    ) as GitlabMergeRequest[];
}

export async function searchProjects(search: string): Promise<GitlabProject[]> {
  return callAPI(`/projects?search=${encodeURIComponent(search)}`);
}

async function callAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(
    `${BASE_API_URL}${path}${separator}private_token=${COREBOT_TOKEN}`,
    options
  );
  return response.json() as Promise<T>;
}
