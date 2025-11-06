import { mergeRequestFixture } from './mergeRequestFixture';
import { projectFixture } from './projectFixture';

export const mergeRequestNoteHookFixture = {
  object_kind: 'note',
  user: {
    name: 'Administrator',
    username: 'root',
    avatar_url:
      'http://www.gravatar.com/avatar/e64c7d89f26bd1972efa854d13d7dd61?s=40\u0026d=identicon',
  },
  project_id: projectFixture.id,
  project: {
    id: projectFixture.id,
    name: projectFixture.name,
    description: projectFixture.description,
    web_url: projectFixture.web_url,
    avatar_url: projectFixture.avatar_url,
    git_ssh_url: 'git@example.com:mike/diaspora.git',
    git_http_url: 'https://my-git.domain.com/mike/diaspora.git',
    namespace: projectFixture.namespace,
    visibility_level: 0,
    path_with_namespace: projectFixture.path_with_namespace,
    default_branch: projectFixture.default_branch,
    homepage: 'https://my-git.domain.com/mike/diaspora',
    url: 'git@example.com:mike/diaspora.git',
    ssh_url: 'git@example.com:mike/diaspora.git',
    http_url: 'https://my-git.domain.com/mike/diaspora.git',
  },
  repository: {
    name: 'Gitlab Test',
    url: 'http://localhost/gitlab-org/gitlab-test.git',
    description: 'Aut reprehenderit ut est.',
    homepage: 'https://my-git.domain.com/gitlab-org/gitlab-test',
  },
  object_attributes: {
    id: 1244,
    note: 'This MR needs work.',
    noteable_type: 'MergeRequest',
    author_id: 1,
    created_at: '2015-05-17 18:21:36 UTC',
    updated_at: '2015-05-17 18:21:36 UTC',
    project_id: 5,
    attachment: null,
    line_code: null,
    commit_id: '',
    noteable_id: 7,
    system: false,
    st_diff: null,
    url: 'https://my-git.domain.com/gitlab-org/gitlab-test/merge_requests/1#note_1244',
  },
  merge_request: mergeRequestFixture,
};
