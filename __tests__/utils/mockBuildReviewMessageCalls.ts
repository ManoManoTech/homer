import { mergeRequestApprovalsFixture } from '../__fixtures__/mergeRequestApprovalsFixture';
import { mergeRequestDetailsFixture } from '../__fixtures__/mergeRequestDetailsFixture';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import { mergeRequestReviewersFixture } from '../__fixtures__/mergeRequestReviewersFixture';
import { projectFixture } from '../__fixtures__/projectFixture';
import { mockGitlabCall } from './mockGitlabCall';

export function mockBuildReviewMessageCalls() {
  const { iid, project_id, web_url } = mergeRequestFixture;

  const url = new URL(web_url);
  const projectPath = url.pathname
    .split('/')
    .filter(Boolean)
    .slice(0, -3)
    .join('/');
  const encodedProjectPath = encodeURIComponent(projectPath);

  // Also extract path from mergeRequestDetailsFixture for URL-based tests
  const detailsUrl = new URL(mergeRequestDetailsFixture.web_url);
  const detailsProjectPath = detailsUrl.pathname
    .split('/')
    .filter(Boolean)
    .slice(0, -3)
    .join('/');
  const encodedDetailsProjectPath = encodeURIComponent(detailsProjectPath);

  // Mock for numeric project ID
  mockGitlabCall(
    `/projects/${project_id}/merge_requests/${iid}/approvals`,
    mergeRequestApprovalsFixture
  );
  mockGitlabCall(
    `/projects/${project_id}/merge_requests/${iid}`,
    mergeRequestDetailsFixture
  );
  mockGitlabCall(
    `/projects/${project_id}/merge_requests/${iid}/reviewers`,
    mergeRequestReviewersFixture
  );
  mockGitlabCall(`/projects/${project_id}`, projectFixture);

  // Mock for URL-encoded project path from mergeRequestFixture
  mockGitlabCall(
    `/projects/${encodedProjectPath}/merge_requests/${iid}`,
    mergeRequestDetailsFixture
  );
  mockGitlabCall(
    `/projects/${encodedProjectPath}/merge_requests/${iid}/approvals`,
    mergeRequestApprovalsFixture
  );
  mockGitlabCall(
    `/projects/${encodedProjectPath}/merge_requests/${iid}/reviewers`,
    mergeRequestReviewersFixture
  );

  // Mock for URL-encoded project path from mergeRequestDetailsFixture
  mockGitlabCall(
    `/projects/${encodedDetailsProjectPath}/merge_requests/${iid}`,
    mergeRequestDetailsFixture
  );
  mockGitlabCall(
    `/projects/${encodedDetailsProjectPath}/merge_requests/${iid}/approvals`,
    mergeRequestApprovalsFixture
  );
  mockGitlabCall(
    `/projects/${encodedDetailsProjectPath}/merge_requests/${iid}/reviewers`,
    mergeRequestReviewersFixture
  );
}
