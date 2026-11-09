# GitHub support: findings from the documentation review

## Why this document exists

Homer currently works with one git provider (GitLab). We want to add GitHub
without rewriting the merge request notification feature. Before designing the
provider-neutral interfaces that the core code will use, we checked what GitHub
actually offers for every piece of GitLab data Homer relies on today. This
document records what we found, what differs, and what those differences mean
for the design.

**Scope.** Only the merge request notification feature (`src/review/`): the
Slack message posted for a merge request, its updates, the thread replies for
comments and new commits, the Slack buttons on that message, and the Slack
command that shares a merge request. Release management is out of scope.

**Method.** Documentation only (links at the end). No real GitHub webhook
delivery was captured. Points marked **Unverified** need to be confirmed against
a real delivery before we rely on them.

**Vocabulary.** GitLab says _merge request_, GitHub says _pull request_. They
are the same concept. Below, "pull request" always means the GitHub object.

---

## Summary: what changes in the design

1. **The required number of approvals is often unavailable on GitHub.** It
   lives in branch rulesets, which Homer can read with basic repository access,
   or in classic branch protection, which needs administration permission. The
   neutral approval model must treat "approvals required" as optional, and the
   Slack message needs a way to render without it.
2. **"Mergeable, waiting only for approval" has no single field on GitHub.**
   GitLab's `detailed_merge_status: not_approved` has to be derived from two
   GitHub fields. The rule that decides whether to post a review automatically
   must therefore be implemented separately for each provider, not shared.
3. **The Slack buttons don't all have GitHub equivalents.** GitHub's "update
   branch" merges the target branch into the source branch; it does not rebase.
   "Create a pipeline" maps to triggering a specific GitHub Actions workflow,
   which each repository has to opt into. Buttons must be enabled per provider.
4. **Comment events are split across three webhook types** on GitHub, versus
   one note event on GitLab.
5. **Matching GitHub users to Slack users by email will mostly fail.** GitHub
   usernames rarely match a corporate email local-part, and GitHub only exposes
   an email when the user made it public. An explicit GitHub-username-to-Slack
   mapping is needed from day one. It is no longer an optional extra.
6. **Repositories have a numeric id on GitHub too.** Every webhook payload
   includes `repository.id`, so database rows can keep a numeric key per
   provider. The `owner/name` string is still needed to call the REST API.

---

## 1. Recognising and verifying webhook requests

|                    | GitLab (today)                                       | GitHub                                                                                                                     |
| ------------------ | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Event header       | `X-Gitlab-Event`                                     | `X-GitHub-Event`                                                                                                           |
| Authenticity       | Shared secret compared as-is (`X-Gitlab-Token`)      | `X-Hub-Signature-256`: HMAC-SHA256 of the raw request body, keyed with the webhook secret, formatted `sha256=<hex digest>` |
| Unique delivery id | none used                                            | `X-GitHub-Delivery` (a GUID)                                                                                               |
| User agent         | not checked                                          | always starts with `GitHub-Hookshot/`                                                                                      |
| Replay protection  | none                                                 | none: the signature contains no timestamp                                                                                  |
| Maximum payload    | Homer accepts up to 5 MB (`REQUEST_BODY_SIZE_LIMIT`) | GitHub sends up to 25 MB                                                                                                   |

Consequences:

- The signature is computed over the **raw bytes** of the body. `src/app.ts`
  already keeps them in `req.rawBody` for Slack verification, so the same buffer
  can be reused.
- GitHub's documentation says never to compare signatures with `==` and to use
  a constant-time comparison such as Node's `crypto.timingSafeEqual`. The
  existing GitLab and Slack comparisons in `securityMiddleware.ts` use `!==`, so
  they should move to a constant-time comparison at the same time.
- Since there is no timestamp, the delivery id (`X-GitHub-Delivery`) is the only
  way to detect a delivery received twice (GitHub allows redelivering manually).
  Homer doesn't deduplicate GitLab deliveries today; this only needs to be
  revisited if duplicate Slack messages turn out to be a problem.
- A push listing many commits (GitHub caps a push payload at 2048 commits) can
  exceed Homer's 5 MB limit. Homer already rejects oversized bodies cleanly, so
  this is acceptable, but it should be a deliberate choice.
- The legacy `X-Hub-Signature` header (SHA-1) is sent only for backwards
  compatibility and should be ignored.

## 2. Webhook events and how they map to Homer's handlers

Homer reacts to three GitLab events. On GitHub:

| Homer behaviour                                                                                         | GitLab event                | GitHub event(s)                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Update the Slack message, post "approved / merged / closed" thread replies, open a review automatically | `merge_request`             | `pull_request`, plus `pull_request_review` for approvals                                                                                                                                                |
| Post comments in the thread                                                                             | `note` (on a merge request) | `issue_comment` (general comments; it is a pull request comment only when `issue.pull_request` is present), `pull_request_review_comment` (inline code comments), and the body of `pull_request_review` |
| Post new commits in the thread                                                                          | `push`                      | `push`                                                                                                                                                                                                  |

### Merge request actions

`mergeRequestHookHandler.ts` accepts seven GitLab actions. GitHub equivalents:

| GitLab action | GitHub equivalent                                                                                                                                              | Notes                                                                                                                                                                                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `open`        | `pull_request` / `opened`                                                                                                                                      | Also consider `ready_for_review`, sent when a draft becomes reviewable.                                                                                                                                                                                             |
| `reopen`      | `pull_request` / `reopened`                                                                                                                                    |                                                                                                                                                                                                                                                                     |
| `close`       | `pull_request` / `closed` with `pull_request.merged == false`                                                                                                  | GitHub has no separate "merged" action.                                                                                                                                                                                                                             |
| `merge`       | `pull_request` / `closed` with `pull_request.merged == true`                                                                                                   |                                                                                                                                                                                                                                                                     |
| `update`      | `pull_request` / `synchronize`, `edited`, `labeled`, `unlabeled`, `assigned`, `unassigned`, `review_requested`, `review_request_removed`, `converted_to_draft` | GitHub splits GitLab's single "update" into many actions.                                                                                                                                                                                                           |
| `approved`    | `pull_request_review` / `submitted` with an approving review state                                                                                             | **Unverified:** the webhook reference doesn't list the review `state` values. In the GraphQL schema they are `APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`, `DISMISSED`, `PENDING`. The webhook is expected to use the lowercase form; confirm with a real delivery. |
| `unapproved`  | no direct equivalent                                                                                                                                           | A reviewer can't withdraw an approval on GitHub. The approval is either dismissed (`pull_request_review` / `dismissed`) or superseded by a later review that requests changes.                                                                                      |

GitHub also reports "changes requested" (a review with state
`CHANGES_REQUESTED`), which GitLab doesn't. It could get its own thread message;
that's a product choice, not a requirement.

### Comments arrive as a burst on GitLab. Unverified on GitHub.

`noteHookHandler.ts` batches comments per author for a short time before
posting them, because GitLab sends one note event per comment all at once when a
review is submitted. On GitHub, a review is one `pull_request_review` event, and
each inline comment is reported separately as a `pull_request_review_comment`
event. **Unverified:** whether those inline-comment events arrive in a burst at
the same moment as the review event. The batching should be kept for GitHub and
fed from all three comment events until a real delivery shows otherwise.

GitLab note events only carry the author's numeric id, which is why
`buildNoteMessage.ts` fetches the user by id. GitHub comment payloads include
the full user object (`login` and so on), so that extra request isn't needed.

### Push

The GitHub push payload has what `pushHookHandler.ts` uses: `ref` in the form
`refs/heads/<branch>`, and `commits[]` with `id`, `message`, `url`,
`author.name` / `author.email` / `author.username`, `added`, `modified`,
`removed`.

Differences:

- GitHub commits have no `title` field; the first line of `message` has to be
  used instead.
- To find the pull requests for a pushed branch, GitHub's list endpoint takes
  `head` in the form `owner:branch` rather than a bare branch name.
- A branch in a fork doesn't trigger a push event in the target repository, so
  commits pushed to a pull request from a fork will never produce "new commits"
  thread messages. On GitLab this behaves similarly, but it is worth knowing.
- `waitForMergeRequestCommits.ts` compares the pushed commits with the commits of
  the merge request, to ignore commits brought in by a rebase. GitHub's "list
  commits on a pull request" returns at most 250 commits, which is more than the
  100 Homer asks GitLab for.

## 3. Deciding when to post a review automatically

When no Slack message exists yet for a merge request, Homer posts one if either:

- the merge request has the `homer-review` label, or
- it has the `homer-mergeable` label **and** `detailed_merge_status` is
  `mergeable` or `not_approved` ("ready except for approvals").

GitHub has labels (`pull_request.labels[].name`; GitLab uses `title`), so the
first rule carries over as is.

The second rule doesn't. GitHub has no field meaning "ready except for
approvals". What it offers:

- REST `mergeable`: `true`, `false`, or `null`. `null` means "GitHub has started
  a background job to compute the mergeability", so a webhook payload often
  arrives before the value is known.
- GraphQL `mergeStateStatus`: `CLEAN` (mergeable and checks passing), `UNSTABLE`
  (mergeable, some checks failing), `HAS_HOOKS`, `BEHIND`, `DIRTY` (conflicts),
  `DRAFT`, `UNKNOWN`, and `BLOCKED` (blocked for **any** reason, including
  missing approvals and failing required checks).
- GraphQL `reviewDecision`: `APPROVED`, `CHANGES_REQUESTED`, `REVIEW_REQUIRED`.

A close equivalent of GitLab's rule is: `mergeable` is true, and either
`mergeStateStatus` is `CLEAN`, `UNSTABLE` or `HAS_HOOKS` (like GitLab's
`mergeable`), or `mergeStateStatus` is `BLOCKED` and `reviewDecision` is
`REVIEW_REQUIRED` (like GitLab's `not_approved`). Even then, "blocked" could
also be caused by a failing required check at the same time, which GitHub
doesn't separate out.

Consequences:

- This decision has to be a separate rule for each provider, sitting next to
  that provider's code, not a shared rule in the core written in GitLab terms.
- When `mergeable` is still `null` at webhook time, the GitHub rule has to
  re-read the pull request later or wait for the next event. It can't decide
  from the webhook payload alone.

## 4. Pull request data shown in the Slack message

What `buildReviewMessage.ts` renders today, and where the GitHub value comes
from (REST "get a pull request" unless noted):

| Slack message element         | GitLab source                             | GitHub source                                 | Difference                                                                                                                  |
| ----------------------------- | ----------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Title and link                | `title`, `web_url`                        | `title`, `html_url`                           |                                                                                                                             |
| Open / closed / merged        | `state` (`opened`, `closed`, `merged`, …) | `state` (`open` / `closed`) + `merged`        | Merged is a separate boolean on GitHub.                                                                                     |
| Draft                         | part of `state` / title prefix            | `draft`                                       |                                                                                                                             |
| Project line                  | project `web_url`, `path_with_namespace`  | `repository.html_url`, `repository.full_name` | Present in every webhook payload, so no extra request.                                                                      |
| Target branch                 | `target_branch`                           | `base.ref`                                    |                                                                                                                             |
| Source branch (button values) | `source_branch`                           | `head.ref`                                    |                                                                                                                             |
| "Open discussion(s)" count    | `user_notes_count`                        | `comments` + `review_comments`                | Neither counts unresolved threads only. GitLab's value is the total note count despite the label, so the sum is equivalent. |
| "Changes" count               | `changes_count` (a string)                | `changed_files` (a number)                    |                                                                                                                             |
| Pipeline status               | `head_pipeline.status`                    | see section 7                                 | Needs an extra request on GitHub.                                                                                           |
| "Mergeable"                   | `merge_status == can_be_merged`           | `mergeable == true`                           | GitHub can return `null` (still computing). The message needs an "unknown" rendering.                                       |
| Author (Slack avatar)         | `author`                                  | `user`                                        |                                                                                                                             |
| Assignees                     | `assignees`                               | `assignees`                                   |                                                                                                                             |
| Reviewers                     | `/reviewers` endpoint                     | see section 6                                 |                                                                                                                             |
| Approvals                     | `/approvals` endpoint                     | see section 5                                 |                                                                                                                             |

## 5. Approvals

Today's Slack line reads "`<approved>`/`<required>` required" followed by ✅ or ⏳,
and the "Approved by" field lists the approvers. GitLab provides all three
values from one endpoint (`approved_by`, `approvals_required`,
`approvals_left`). GitHub doesn't.

**Who approved.** REST "list reviews for a pull request" returns every review in
chronological order (paginated, up to 100 per page). The approvers are the users
whose **latest** opinionated review (approve or request changes) is an approval.
GraphQL computes this directly: `latestOpinionatedReviews` is "a list of latest
reviews per user".

**How many approvals are required.** There are two places, with different access
requirements:

| Source                    | Endpoint                                                                                                                                                  | Permission needed (fine-grained token)       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Rulesets                  | `GET /repos/{owner}/{repo}/rules/branches/{branch}` returns the active rules for a branch. The `pull_request` rule has `required_approving_review_count`. | **Metadata: read** (basic repository access) |
| Classic branch protection | `GET /repos/{owner}/{repo}/branches/{branch}/protection/required_pull_request_reviews`                                                                    | **Administration: read**                     |

The rulesets endpoint doesn't include classic branch protection. So for a
repository that still uses classic branch protection, Homer can only learn the
required count with administration permission, which we shouldn't ask for. A
repository with no rule at all has no required count.

**Is it approved overall.** GraphQL `reviewDecision` (`APPROVED`,
`CHANGES_REQUESTED`, `REVIEW_REQUIRED`) answers this even when the count is
unknown, and it takes code owner requirements into account.

Consequences:

- The neutral approval information must allow "approvals required" to be
  missing. "Approvals left" should be computed only when the required count is
  known.
- The Slack message needs a rendering for an unknown required count, for
  example the number of approvals plus an indicator based on the review
  decision. This is a product decision; GitLab messages must keep rendering
  exactly as today (the Block Kit snapshot tests in
  `__tests__/review/buildReviewMessage.test.ts` guarantee that).
- Supporting "changes requested" would need a new field in the neutral model.
  GitLab has no equivalent, so it would be GitHub-only.

## 6. Reviewers and participants

GitLab's reviewer list is stable: someone stays a reviewer after reviewing.

On GitHub, `requested_reviewers` only lists **pending** review requests. Once
someone submits a review, they drop out of it. So the GitHub reviewer list has
to be the union of `requested_reviewers` and the authors of submitted reviews.
Otherwise people who already reviewed disappear from the "Participants" field.

GitHub can also request a review from a **team** (`requested_teams`). A team
doesn't map to a single Slack user. The simplest option is to leave teams out of
the participants field.

## 7. Pipeline status

GitLab reports one pipeline per merge request (`head_pipeline.status`). GitHub
has two separate systems attached to the latest commit:

- **Check runs** (`GET /repos/{owner}/{repo}/commits/{ref}/check-runs`): `status`
  is `queued`, `in_progress` or `completed`, and `conclusion` is `success`,
  `failure`, `neutral`, `cancelled`, `skipped`, `timed_out` or
  `action_required`.
- **Commit statuses** (`GET /repos/{owner}/{repo}/commits/{ref}/status`, the
  combined status): `state` is `failure`, `pending` or `success`.

GraphQL `statusCheckRollup` on the pull request combines check runs and commit
statuses for the latest commit of the pull request, which avoids merging the two
lists by hand.

Consequence: the core should use a neutral pipeline status (success, failed,
running, pending, cancelled, skipped, manual, none) with a mapping for each
provider, instead of the GitLab status names that `buildReviewMessage.ts` maps to
emojis today.

## 8. Slack message buttons

The Slack message has an overflow menu with three buttons:

| Button               | GitLab behaviour                                                                         | GitHub option                                                                                                                                           | Assessment                                                                                                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create a pipeline    | Starts a pipeline on the source branch with CI variables (`POST /projects/:id/pipeline`) | Trigger a GitHub Actions workflow (`POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches`, up to 25 inputs). Needs **Actions: write**. | Not equivalent: the repository must contain a workflow that accepts manual triggering (`workflow_dispatch`), and Homer would need to know which workflow to trigger. Needs per-repository configuration. |
| Rebase source branch | Rebases the source branch (`PUT …/merge_requests/:iid/rebase`)                           | "Update a pull request branch" (`PUT /repos/{owner}/{repo}/pulls/{number}/update-branch`). Needs **Pull requests: write**.                              | Different behaviour: GitHub **merges** the target branch into the source branch; it does not rebase. The button label must say "Update branch", or be hidden.                                            |
| Delete message       | Slack only                                                                               | Slack only                                                                                                                                              | Unchanged.                                                                                                                                                                                               |

Consequence: each provider needs to declare which buttons it supports, and the
Slack message only shows those. For the first GitHub version, the simplest
choice is to show "Update branch" and hide "Create a pipeline".

## 9. Finding a pull request from the Slack command

The share command (`shareReviewRequestHandler.ts` via `searchMergeRequests`)
accepts three inputs:

| Input     | GitLab today                                             | GitHub                                                                                                   |
| --------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Number    | `!123`, looked up in every project linked to the channel | `#123`, looked up in every repository linked to the channel (`GET /repos/{owner}/{repo}/pulls/{number}`) |
| URL       | `…/-/merge_requests/123`                                 | `https://github.com/{owner}/{repo}/pull/{number}`                                                        |
| Free text | Per-project search on open merge requests                | Search API with `is:pull-request is:open repo:{owner}/{repo}`                                            |

The GitHub search API is limited to **30 requests per minute** and at most 1000
results per search. Instead of one request per linked repository, as GitLab does
today, one search with several `repo:` qualifiers should be used.

Linking a repository to a channel (`searchProjects` in the project command) also
needs a GitHub version. It isn't part of the notification feature, but GitHub
support is unusable without it.

## 10. Identifying repositories and pull requests in the database

Today the `Project` and `Review` tables store GitLab's numeric `projectId` and
`mergeRequestIid`.

- Every GitHub webhook payload includes a numeric `repository.id` as well as
  `repository.full_name` (`owner/name`). Pull requests have a per-repository
  `number`, which plays the same role as GitLab's `iid`.
- So GitHub rows can use a numeric repository id and pull request number, like
  GitLab rows. Only a column saying which provider the row belongs to is
  strictly needed, and every lookup and delete must include it. For example, the
  delete of reviews for a merge request (`removeReviewsByMergeRequestIid`) must
  include the provider, not just the project id, or rows from the two providers
  could collide.
- REST calls are addressed by `owner/name`, so the GitHub code also needs
  `full_name`. It can be stored next to the numeric id or resolved when needed.
  `full_name` changes when a repository is renamed or transferred, so it
  shouldn't be the key. (**Unverified:** that the numeric id stays the same
  after a rename or transfer. This is widely relied on, but it isn't stated in
  the pages we read.)
- **Unverified, to check before the database change:** the id columns are
  `INTEGER` (32-bit, maximum 2,147,483,647). GitHub repository and user ids are
  large and still growing. We didn't check current values against that limit.
  If they're close, the new columns (or the existing ones) should be `BIGINT`.

## 11. Matching GitHub users to Slack users

Homer finds a Slack user today by building `<gitlab username>@<domain>` for each
configured email domain and asking Slack for that email
(`fetchSlackUserFromGitlabUsername` in `slack.ts`, whose current behaviour is
pinned by `__tests__/core/services/fetchSlackUserFromGitlabUsername.test.ts`).
This works because GitLab usernames match the corporate email local-part.

On GitHub:

- A GitHub username (`login`) usually has nothing to do with the corporate email,
  so the computed email will mostly miss.
- The `email` field of the GitHub user API is "the publicly visible email
  address from your GitHub profile page" and is `null` when the user hasn't made
  one public.
- Push payloads include the commit author's email, but that's whatever the
  developer configured in git. **Unverified:** users with GitHub's email privacy
  setting commit with a GitHub "noreply" address, which won't match Slack.

Consequence: an explicit mapping from GitHub username to Slack user is needed
from the start. It can begin as a configuration map and move to a database table
if it grows. The lookup should try, in order: the explicit mapping, then an email
carried by the payload when it looks like a real corporate address, then the
computed `<username>@<domain>` convention. When nothing matches, the result stays
"no Slack user", exactly as today. That ordering keeps GitLab behaviour
unchanged, because GitLab users have no mapping entry and fall through to the
convention.

## 12. Authentication and permissions

Minimum fine-grained permissions for Homer on a GitHub repository, from the
endpoints above:

| Permission                          | Why                                                                                             |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| Metadata: read                      | Branch rules (required approval count)                                                          |
| Pull requests: read                 | Pull request details, reviews, commits, list by branch                                          |
| Pull requests: write                | Only for the "Update branch" button                                                             |
| Commit statuses: read, Checks: read | Pipeline status (**Unverified:** the exact permission for check runs; the page didn't state it) |
| Actions: write                      | Only if the "Create a pipeline" button is supported                                             |

Administration permission is deliberately left out. The only thing it would add
is the required approval count for repositories that use classic branch
protection.

Whether Homer should authenticate as a personal access token or as a GitHub App
is an open decision. A GitHub App isn't tied to one person's account and is the
usual choice for organisation-wide bots. That comparison is outside what this
document checked.

---

## What the provider-neutral interfaces must allow

Collected from the sections above:

- Approval information where the required count is optional, and an optional
  overall review decision.
- A neutral pipeline status with a mapping for each provider.
- "Mergeable" with an "unknown" value.
- A repository reference that combines the provider, a stable numeric id, and a
  display name / API path (`owner/name` on GitHub, the namespace path on GitLab).
- Merge request events reduced to a small neutral set (opened, reopened, closed,
  merged, updated, approved, approval withdrawn, comment added, commits pushed).
  Each provider translates its own actions into that set.
- A per-provider rule that decides whether to post a review automatically.
- A per-provider list of supported Slack message buttons.
- Git users carrying an optional email, so the Slack lookup can use it when the
  payload provides one.

## Open questions to confirm with a real GitHub delivery

1. The exact `review.state` values in the `pull_request_review` webhook payload.
2. Whether inline review comments arrive as a burst at the same time as the review.
3. How often `mergeable` is `null` in `pull_request` webhook payloads.
4. What commit author emails look like for users with email privacy enabled.
5. Current magnitude of GitHub repository ids against 32-bit `INTEGER` columns.
6. Which permission the check runs endpoint requires.

## Sources

- [Webhook events and payloads](https://docs.github.com/en/webhooks/webhook-events-and-payloads)
- [Validating webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)
- [REST: Pull requests](https://docs.github.com/en/rest/pulls/pulls)
- [REST: Pull request reviews](https://docs.github.com/en/rest/pulls/reviews)
- [REST: Repository rules](https://docs.github.com/en/rest/repos/rules)
- [REST: Branch protection](https://docs.github.com/en/rest/branches/branch-protection)
- [Permissions required for fine-grained personal access tokens](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens)
- [GraphQL: Pull requests (reviewDecision, mergeStateStatus, statusCheckRollup)](https://docs.github.com/en/graphql/reference/pulls)
- [REST: Check runs](https://docs.github.com/en/rest/checks/runs)
- [REST: Commit statuses](https://docs.github.com/en/rest/commits/statuses)
- [REST: Users](https://docs.github.com/en/rest/users/users)
- [REST: Workflows (workflow dispatch)](https://docs.github.com/en/rest/actions/workflows)
- [REST: Search](https://docs.github.com/en/rest/search/search)
