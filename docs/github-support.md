# GitHub support matrix

Homer was built for GitLab. This page lists every GitLab feature Homer supports
and tracks its GitHub counterpart. A box is ticked once the feature ships and is
covered by tests.

Legend: `[x]` supported, `[ ]` not yet, `[-]` not applicable on this provider.

## Setup and security

| Feature                         | Trigger                                  | GitLab | GitHub | GitHub notes                                                                                                     |
| ------------------------------- | ---------------------------------------- | ------ | ------ | ---------------------------------------------------------------------------------------------------------------- |
| API client and token            | `GITLAB_TOKEN` / `GITHUB_TOKEN`          | [x]    | [x]    | Personal access token or fine-grained token. GitHub variables are optional so GitLab-only installs keep booting. |
| Webhook endpoint                | `POST /api/v1/homer/gitlab` / `/github`  | [x]    | [x]    |                                                                                                                  |
| Webhook authentication          | `X-Gitlab-Token` / `X-Hub-Signature-256` | [x]    | [x]    | GitHub signs the raw body with HMAC SHA-256 (`GITHUB_SECRET`).                                                   |
| Webhook ping                    | GitHub `ping` event                      | [-]    | [x]    | Answer 200 so GitHub marks the hook healthy.                                                                     |
| Provider icon on Slack messages | review message                           | [ ]    | [ ]    | Shows which provider a review comes from.                                                                        |

## Projects (`/homer project ...`)

| Feature                                   | Trigger                                | GitLab | GitHub | GitHub notes                             |
| ----------------------------------------- | -------------------------------------- | ------ | ------ | ---------------------------------------- |
| Add a project by id                       | `/homer project add <id>`              | [x]    | [x]    | GitHub repository numeric id.            |
| Add a project by path                     | `/homer project add <group/name>`      | [x]    | [x]    | `owner/repo`.                            |
| Add a project by search, pick from a list | `/homer project add <text>`            | [x]    | [x]    | GitHub repository search.                |
| Webhook setup hint after add              | ephemeral message                      | [x]    | [x]    | Link to the repository webhook settings. |
| Channel threshold warning                 | `SLACK_CHANNEL_NOTIFICATION_THRESHOLD` | [x]    | [x]    |                                          |
| List channel projects                     | `/homer project list`                  | [x]    | [x]    |                                          |
| Remove a project                          | `/homer project remove`                | [x]    | [x]    |                                          |

## Reviews (`/homer review ...`)

| Feature                                   | Trigger                | GitLab | GitHub | GitHub notes                                                                                          |
| ----------------------------------------- | ---------------------- | ------ | ------ | ----------------------------------------------------------------------------------------------------- |
| Share a review by search                  | `/homer review <text>` | [x]    | [x]    | Searches open PRs of the channel repositories.                                                        |
| Pick among several matches                | select menu            | [x]    | [x]    |                                                                                                       |
| List channel reviews                      | `/homer review list`   | [x]    | [x]    |                                                                                                       |
| Review message: title, link, state        | review message         | [x]    | [x]    | `merged` / `closed` states struck through.                                                            |
| Review message: project and target branch | review message         | [x]    | [x]    |                                                                                                       |
| Review message: open discussions count    | review message         | [x]    | [x]    | Sum of PR comments and review comments.                                                               |
| Review message: changes count             | review message         | [x]    | [x]    | Changed files count.                                                                                  |
| Review message: pipeline status           | review message         | [x]    | [x]    | Combined check runs status of the head commit.                                                        |
| Review message: mergeable                 | review message         | [x]    | [x]    | `mergeable_state`.                                                                                    |
| Review message: assignees and reviewers   | review message         | [x]    | [x]    | Requested reviewers plus users who reviewed.                                                          |
| Review message: approvals x/y             | review message         | [x]    | [x]    | Required count read from rulesets, then classic branch protection; 0 when the token cannot read them. |
| Review message: author as sender          | review message         | [x]    | [x]    | Needs Slack user mapping.                                                                             |
| Action: create a pipeline                 | overflow menu          | [x]    | [ ]    | Re-runs the latest workflow runs of the head commit. `AUTO_DEPLOY` has no direct equivalent.          |
| Action: rebase source branch              | overflow menu          | [x]    | [ ]    | Uses "update branch", which merges the base branch instead of rebasing.                               |
| Action: delete message                    | overflow menu          | [x]    | [x]    | Provider independent.                                                                                 |

## Review automation (webhooks)

| Feature                                              | Trigger                   | GitLab | GitHub | GitHub notes                                                                       |
| ---------------------------------------------------- | ------------------------- | ------ | ------ | ---------------------------------------------------------------------------------- |
| Auto-share on `homer-review` label                   | MR/PR event               | [x]    | [x]    | `pull_request` `labeled`/`opened`.                                                 |
| Auto-share on `homer-mergeable` label when mergeable | MR/PR event               | [x]    | [x]    |                                                                                    |
| Respect channel threshold on auto-share              | MR/PR event               | [x]    | [x]    |                                                                                    |
| Refresh review message on MR/PR update               | MR/PR event               | [x]    | [x]    | `pull_request` `edited`, `synchronize`, `review_requested`, etc.                   |
| Thread message: approved                             | MR approval / PR review   | [x]    | [x]    | `pull_request_review` `submitted` with state `approved`.                           |
| Thread message: unapproved                           | MR unapproval / PR review | [x]    | [-]    | GitHub has no unapprove event. "Changes requested" reviews are posted instead.     |
| Thread message: closed                               | MR/PR event               | [x]    | [x]    |                                                                                    |
| Thread message: merged                               | MR/PR event               | [x]    | [x]    | `closed` with `merged: true`.                                                      |
| Stop tracking closed/merged reviews                  | MR/PR event               | [x]    | [x]    | Also fixes deletion scope: today reviews are deleted by iid only, across projects. |
| Comments posted in thread                            | note / PR comment         | [x]    | [x]    | `issue_comment`, `pull_request_review_comment`, `pull_request_review` body.        |
| Comment debounce (3 s) per author                    | note / PR comment         | [x]    | [x]    |                                                                                    |
| New commits posted in thread                         | push / PR synchronize     | [x]    | [x]    | `push` event, matched against PR commits.                                          |
| Commit author resolved from commit email             | push                      | [x]    | [x]    |                                                                                    |

## Slack user mapping

| Feature                           | Trigger       | GitLab                       | GitHub          | GitHub notes                                                                                                                                                     |
| --------------------------------- | ------------- | ---------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git user to Slack user            | every message | [x] `username@EMAIL_DOMAINS` | [x]             | GitHub logins rarely match emails. Resolution order: `config/homer/githubUsers.json` (`{"login": "email"}`), GitHub public profile email, `login@EMAIL_DOMAINS`. |
| Fallback when no Slack user found | every message | [x] user hidden              | [x] user hidden | Same as GitLab.                                                                                                                                                  |

## Changelog (`/homer changelog`)

| Feature                                        | Trigger | GitLab | GitHub | GitHub notes                                                               |
| ---------------------------------------------- | ------- | ------ | ------ | -------------------------------------------------------------------------- |
| Changelog between two tags                     | modal   | [x]    | [ ]    | Compare API (`/compare/<tag>...<ref>`).                                    |
| Group commits by merge request                 | modal   | [x]    | [ ]    | GitLab parses `See merge request !N`; GitHub uses "list PRs for a commit". |
| Squash commits support                         | modal   | [x]    | [ ]    |                                                                            |
| Ticket links (`TICKET_MANAGEMENT_URL_PATTERN`) | modal   | [x]    | [ ]    | Provider independent.                                                      |

## Releases (`/homer release ...`)

| Feature                                                        | Trigger                 | GitLab | GitHub | GitHub notes                                                                                                                    |
| -------------------------------------------------------------- | ----------------------- | ------ | ------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Release modal, project picker, tag suggestion                  | `/homer release`        | [x]    | [ ]    | Tags from the tags API.                                                                                                         |
| Tag managers (semantic, stable date, federation)               | `releaseTagManager`     | [x]    | [ ]    | Provider independent once tags are fetched.                                                                                     |
| Wait for main branch pipeline before release                   | `isReadyToRelease`      | [x]    | [ ]    | Workflow runs of the default branch.                                                                                            |
| Create the release and its tag                                 | modal submit            | [x]    | [ ]    | Releases API with `target_commitish`.                                                                                           |
| Wait for the tag pipeline                                      | `hasReleasePipeline`    | [x]    | [ ]    | Workflow runs triggered by the tag.                                                                                             |
| Deployment tracking (running/success/failed)                   | deployment hook         | [x]    | [ ]    | `deployment_status` event.                                                                                                      |
| Release state notifications                                    | deployment hook         | [x]    | [ ]    |                                                                                                                                 |
| Cancel a release (rename to `[NOT DEPLOYED]`, cancel pipeline) | `/homer release cancel` | [x]    | [ ]    | Edit release name, cancel workflow runs.                                                                                        |
| End a release                                                  | `/homer release end`    | [x]    | [ ]    |                                                                                                                                 |
| Release changelog                                              | button                  | [x]    | [ ]    | Release body.                                                                                                                   |
| Release manager plugins                                        | `plugins/release`       | [x]    | [ ]    | Plugins receive GitLab helpers today; GitHub plugins get a provider-neutral API alongside, the GitLab contract stays unchanged. |

## Known GitHub limitations

- "Rebase source branch" merges the base branch into the PR (GitHub "update branch").
- "Create a pipeline" cannot pass `AUTO_DEPLOY`; it re-runs existing workflow runs.
- Approvals required needs read access to branch protection rules.
