import { slackBotWebClient } from '@/core/services/slack';
import { buildReviewMessage } from '@/review/commands/share/viewBuilders/buildReviewMessage';
import { mergeRequestApprovalsFixture } from '../__fixtures__/mergeRequestApprovalsFixture';
import { mergeRequestDetailsFixture } from '../__fixtures__/mergeRequestDetailsFixture';
import { mergeRequestFixture } from '../__fixtures__/mergeRequestFixture';
import { mockBuildReviewMessageCalls } from '../utils/mockBuildReviewMessageCalls';
import { mockGitlabCall } from '../utils/mockGitlabCall';

/**
 * Golden Block Kit snapshots of `buildReviewMessage`'s return value (the
 * chat.postMessage / chat.update payload). These lock the current rendering
 * byte-for-byte so the later "pure renderer" refactor (c9) is provably a
 * no-op. We snapshot the returned payload directly — nothing is sent.
 */
describe('buildReviewMessage', () => {
  const { iid, project_id } = mergeRequestFixture;
  const channelId = 'channelId';

  beforeEach(() => {
    // Resolve every Slack lookup deterministically from the email local-part
    // (which equals the GitLab username), so the snapshot is stable.
    (slackBotWebClient.users.lookupByEmail as jest.Mock).mockImplementation(
      ({ email }: { email: string }) => {
        const name = email.split('@')[0];
        return Promise.resolve({
          user: {
            name,
            profile: { image_72: 'image_72' },
            real_name: `${name}.real`,
          },
        });
      },
    );
    mockBuildReviewMessageCalls();
  });

  it('renders the post payload for an open merge request', async () => {
    const message = await buildReviewMessage(channelId, project_id, iid);

    expect(message).toMatchSnapshot();
  });

  it('renders the update payload (with ts) for an open merge request', async () => {
    const message = await buildReviewMessage(channelId, project_id, iid, 'ts');

    expect(message).toMatchSnapshot();
  });

  it('renders the closed merge request payload', async () => {
    mockGitlabCall(`/projects/${project_id}/merge_requests/${iid}`, {
      ...mergeRequestDetailsFixture,
      state: 'closed',
    });

    const message = await buildReviewMessage(channelId, project_id, iid);

    expect(message).toMatchSnapshot();
  });

  it('renders the merged merge request payload', async () => {
    mockGitlabCall(`/projects/${project_id}/merge_requests/${iid}`, {
      ...mergeRequestDetailsFixture,
      state: 'merged',
    });

    const message = await buildReviewMessage(channelId, project_id, iid);

    expect(message).toMatchSnapshot();
  });

  it('renders the fully-approved payload (no approvals left)', async () => {
    mockGitlabCall(`/projects/${project_id}/merge_requests/${iid}/approvals`, {
      ...mergeRequestApprovalsFixture,
      approvals_required: 2,
      approvals_left: 0,
    });

    const message = await buildReviewMessage(channelId, project_id, iid);

    expect(message).toMatchSnapshot();
  });
});
