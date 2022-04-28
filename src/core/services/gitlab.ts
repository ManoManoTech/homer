import fetch, { RequestInit } from 'node-fetch';
import { GITLAB_URL, MERGE_REQUEST_OPEN_STATES } from '@/constants';
import { DataProject } from '@/core/typings/Data';
import { GitlabApprovalsResponse } from '@/core/typings/GitlabApprovalsResponse';
import { GitlabCiVariable } from '@/core/typings/GitlabCiVariable';
import { GitlabCommit } from '@/core/typings/GitlabCommit';
import {
  GitlabMergeRequest,
  GitlabMergeRequestDetails,
} from '@/core/typings/GitlabMergeRequest';
import {
  GitlabProject,
  GitlabProjectDetails,
} from '@/core/typings/GitlabProject';
import { GitlabUser, GitlabUserDetail } from '@/core/typings/GitlabUser';
import { getEnvVariable } from '@/core/utils/getEnvVariable';

const BASE_API_URL = `${GITLAB_URL}/api/v4`;
const COREBOT_TOKEN = getEnvVariable('COREBOT_TOKEN');
const MERGE_REQUEST_ID_REGEX = /^!\d+$/;

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

export async function fetchParticipants(
  projectId: number,
  mergeRequestIid: number
): Promise<GitlabUser[]> {
  return callAPI(
    `/projects/${projectId}/merge_requests/${mergeRequestIid}/participants`
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

export async function fetchUserById(
  id: number
): Promise<GitlabUserDetail | undefined> {
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
