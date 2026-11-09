# GitHub webhook fixtures

These payloads were written from GitHub's published webhook documentation and
its published webhook payload schema. **No real GitHub webhook delivery was ever
captured.** Confirming them needs a repository whose webhook points at a
reachable Homer instance, and the recorded deliveries from GitHub's own
"Recent Deliveries" view.

All values are invented. There are no real usernames, emails, tokens,
organisation names or internal URLs here, and the hosts (`example-github.test`,
`example.test`) are deliberately unreachable.

Each payload keeps only the fields the merge request notification feature could
plausibly need, not the whole delivery. Anything GitHub sends that Homer has no
use for — the long lists of `*_url` endpoints on repositories and users,
reactions, milestones, licences, star and fork counts — is left out. Fields the
design depends on are kept even when they are not needed yet, in particular the
approval state on `pull_request_review` and the mergeable fields on
`pull_request`.

## What is still unverified

Carried over from `docs/github-spike-notes.md`, plus what writing these payloads
turned up.

### Review state values

`review.state` is spelled lowercase here (`approved`, `changes_requested`). The
prose webhook reference does not list the values; GitHub's published webhook
schema does, as `commented | changes_requested | approved | dismissed`, and the
GraphQL schema uses the uppercase forms. So the lowercase spelling comes from a
schema, not from a delivery. **Confirmed by:** the `state` field of one real
`pull_request_review` delivery.

### Mergeable fields on a webhook payload

`pull_request.mergeable` is `true` in the base fixture and `null` on
`synchronize`, on the assumption that GitHub restarts its background
mergeability job after a push and sends the event before the job finishes. How
often a delivery actually arrives with `mergeable: null`, and whether
`mergeable_state` is then `unknown`, is not established. The exact
`mergeable_state` value for a pull request that only waits for approvals is
taken to be `blocked`, which the documentation describes as covering any
blocking reason. **Confirmed by:** the values of `mergeable`, `mergeable_state`
and `merged` across a real `opened`, `synchronize` and `closed` sequence.

Note also that the GraphQL `mergeStateStatus` and `reviewDecision` pair the
auto-share decision is expected to need is **not** in any webhook payload. Only
`mergeable_state` is, and it does not separate "waiting for approvals" from
"a required check failed". The fixtures cannot stand in for that; a GraphQL or
REST call will be needed.

### Approval counts are absent from the payload

No webhook payload carries how many approvals a pull request has or how many it
requires. Nothing in these fixtures can be used to test that part of the Slack
message. It comes from "list reviews" plus the branch rules endpoint, whose
availability depends on whether the repository uses rulesets or classic branch
protection.

### `issue.pull_request` on `issue_comment`

`issueCommentOnPullRequestHookFixture` carries
`issue.pull_request` as `{ url, html_url, diff_url, patch_url, merged_at }`.
GitHub's schema marks the object and every one of its fields optional, and the
documentation's own `issue_comment` example is a comment on a plain issue, so
it shows no such object at all. Whether every pull request comment carries all
five fields is unconfirmed. **Confirmed by:** one real `issue_comment` delivery
for a comment on a pull request.

### Reduced pull request object on review and comment events

`pull_request_review` and `issue_comment` are modelled here as carrying a
reduced pull request object, without `merged`, `mergeable`, `mergeable_state`,
`comments`, `review_comments` or `changed_files`. That comes from GitHub's
published schema distinguishing its full and simple pull request types.
**Confirmed by:** the key set of `pull_request` in one real
`pull_request_review` delivery.

### Whether comments arrive as a burst

Homer batches GitLab note events because GitLab sends one per comment at once
when a review is submitted. On GitHub a review is one `pull_request_review`
event and each inline comment is a separate `pull_request_review_comment`
event. Whether those arrive together is unknown, so these fixtures make no
claim about timing. There is deliberately no
`pull_request_review_comment` fixture yet: writing one without knowing how it
is delivered alongside the review event would pin down a guess.

### Commit author identity on `push`

`commits[].author.username` is set here. GitHub's schema marks it optional, and
`author.email` is nullable. Users with GitHub's email privacy setting enabled
commit with a `noreply` address, which is why matching a GitHub user to a Slack
user by email is expected to fail. Neither the optional `username` nor the
`noreply` behaviour was observed. **Confirmed by:** one real `push` delivery
from a user with email privacy enabled.

### Identifier sizes and stability

The ids here are small invented numbers. Real GitHub repository and user ids
are large and still growing, and the existing database columns are 32-bit
`INTEGER`. Whether a repository's numeric id survives a rename or a transfer is
widely assumed but was not found stated in the documentation. Both matter
before the database change, and neither can be checked from a fixture.

## Signing

`__tests__/utils/getGithubHeaders.ts` produces `X-GitHub-Event`,
`X-GitHub-Delivery` and `X-Hub-Signature-256`. Its signature is pinned against
the worked example in GitHub's own documentation and cross-checked against a
second HMAC implementation, in
`__tests__/utils/getGithubHeaders.test.ts`. That part is not a guess.

The secret is a fixture constant because Homer has no GitHub configuration yet.
The legacy SHA-1 `X-Hub-Signature` header is deliberately not produced.
