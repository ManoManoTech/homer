import request from 'supertest';
import { app } from '@/app';
import { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_OK } from '@/constants';
import { slackBotWebClient } from '@/core/services/slack';
import type { ProjectReleaseConfig } from '@/release/typings/ProjectReleaseConfig';
import ConfigHelper from '@/release/utils/ConfigHelper';
import { slackUserFixture } from '@root/__tests__/__fixtures__/slackUserFixture';
import { dockerBuildJobFixture } from '../__fixtures__/dockerBuildJobFixture';
import { jobFixture } from '../__fixtures__/jobFixture';
import { pipelineFixture } from '../__fixtures__/pipelineFixture';
import { projectFixture } from '../__fixtures__/projectFixture';
import { releaseFixture } from '../__fixtures__/releaseFixture';
import { tagFixture } from '../__fixtures__/tagFixture';
import { getSlackHeaders } from '../utils/getSlackHeaders';
import { mockGitlabCall } from '../utils/mockGitlabCall';

const RELEASE_TAG_NAME = 'stable-19700101-0100';
const UNKNOWN_TAG_NAME = 'stable-20260903-1111';

function buildSubmissionPayload(previousReleaseTagName: string) {
  return {
    payload: JSON.stringify({
      type: 'view_submission',
      user: { id: slackUserFixture.id },
      view: {
        callback_id: 'release-create-modal',
        id: 'viewId',
        state: {
          values: {
            'release-project-block': {
              'release-select-project-action': {
                selected_option: { value: `${projectFixture.id}` },
              },
            },
            'release-tag-block': {
              'release-tag-action': { value: RELEASE_TAG_NAME },
            },
            'release-previous-tag-block': {
              'release-select-previous-tag-action': {
                selected_option: { value: previousReleaseTagName },
              },
            },
          },
        },
      },
    }),
  };
}

describe('release > createRelease with a previous tag missing from the project', () => {
  let releaseConfig: ProjectReleaseConfig;

  beforeAll(async () => {
    releaseConfig = await ConfigHelper.getProjectReleaseConfig(
      projectFixture.id,
    );
  });

  beforeEach(() => {
    (slackBotWebClient.chat.postMessage as jest.Mock).mockResolvedValue({
      ts: 'ts',
    });
    (slackBotWebClient.users.info as jest.Mock).mockResolvedValue({
      user: slackUserFixture,
    });
  });

  it('asks the user to pick another tag instead of starting the release', async () => {
    const { projectId } = releaseConfig;

    mockGitlabCall(`/projects/${projectId}`, projectFixture);
    // Gitlab answers a JSON 404 body, which callAPI returns as-is.
    mockGitlabCall(
      `/projects/${projectId}/repository/tags/${UNKNOWN_TAG_NAME}`,
      { message: '404 Tag Not Found' },
    );

    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(buildSubmissionPayload(UNKNOWN_TAG_NAME)))
      .send(buildSubmissionPayload(UNKNOWN_TAG_NAME));

    expect(response.status).toEqual(HTTP_STATUS_OK);
    expect(response.body).toEqual({
      response_action: 'errors',
      errors: {
        'release-previous-tag-block': expect.stringContaining(UNKNOWN_TAG_NAME),
      },
    });

    const { hasModelEntry } = (await import('sequelize')) as any;
    expect(
      await hasModelEntry('Release', { tagName: RELEASE_TAG_NAME }),
    ).toEqual(false);
  });

  it('starts the release when the previous tag belongs to the project', async () => {
    const { projectId } = releaseConfig;

    mockGitlabCall(`/projects/${projectId}`, projectFixture);
    mockGitlabCall(
      `/projects/${projectId}/repository/tags/${tagFixture.name}`,
      tagFixture,
    );
    mockGitlabCall(
      `/projects/${projectId}/repository/commits?since=2017-07-26T09:08:54.000Z&per_page=100`,
      [],
    );
    mockGitlabCall(`/projects/${projectId}/pipelines?ref=master`, [
      pipelineFixture,
    ]);
    mockGitlabCall(
      `/projects/${projectId}/pipelines/${pipelineFixture.id}/jobs?per_page=100`,
      [dockerBuildJobFixture, jobFixture],
    );
    mockGitlabCall(`/projects/${projectId}/releases`, releaseFixture);
    mockGitlabCall(
      `/projects/${projectId}/pipelines?ref=${RELEASE_TAG_NAME}`,
      [],
    );

    const response = await request(app)
      .post('/api/v1/homer/interactive')
      .set(getSlackHeaders(buildSubmissionPayload(tagFixture.name)))
      .send(buildSubmissionPayload(tagFixture.name));

    expect(response.status).toEqual(HTTP_STATUS_NO_CONTENT);
  });
});
