# 1. Pluggable git backends through ports and adapters

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

Homer bridges one chat frontend (Slack) and one git backend (GitLab). GitLab is
not isolated behind an interface: `src/core/services/gitlab.ts` is called
directly from the review handlers, the webhook entry point branches on GitLab's
`object_kind`, and GitLab-shaped objects travel all the way into the code that
builds the Slack message. The decision whether to post a review automatically
reads GitLab's `detailed_merge_status` in the handler itself.

We want to support GitHub. Done naively, that means a second copy of the review
feature, or a growing set of `if (provider === 'github')` branches inside code
that is already hard to test.

A documentation review of GitHub ([the spike notes](../github-spike-notes.md))
established that the two providers agree on the shape of the feature — a pull
request is a merge request, a review thread is a review thread — but disagree on
almost every detail: the approval model, the webhook taxonomy, the fields that
say whether a change is mergeable, and the way a user is identified. Those are
real differences, not naming differences, so they need somewhere to live.

## Decision

Introduce ports and adapters for the git side of the review feature.

The core defines neutral interfaces and neutral domain types. Each provider gets
an adapter that translates its own API and webhook payloads into them. The core
never imports a provider's types and never names a provider except to choose one
from a registry.

There are **three ports**:

- **`GitProvider`** — outbound reads: the merge request, its approvals,
  reviewers, project, commits, and lookups by branch or by user. Returns neutral
  domain objects.
- **`GitWebhookParser`** — inbound: recognise the request, verify its
  authenticity, and turn it into a neutral `GitEvent`, replacing the two
  `object_kind` switches that exist today.
- **`ChatNotifier`** — outbound to the chat side: post, update, reply in thread,
  delete. Slack is its one real implementation; a fake implementation serves the
  tests.

Two things that look like ports deliberately are not:

- **The automatic-share rule is a per-provider policy on the git adapter**, not
  a port of its own and not logic in the core. GitLab's rule reads labels plus
  `detailed_merge_status`; GitHub has no single equivalent and has to derive the
  same answer from `mergeable`, `mergeStateStatus` and `reviewDecision`, and
  sometimes cannot decide from the webhook payload at all. Putting the rule in
  the core would force GitLab's status vocabulary into the neutral domain.
- **Identity resolution is not a port.** See below.

### Why three ports and not five

An earlier proposal had five: it split a separate identity resolver out of the
chat side, and a separate renderer out of the notifier. Both were dropped.

The renderer split is covered by [ADR 2](./0002-domain-model-boundary-not-view-model.md):
rendering stays inside the Slack adapter, so there is nothing left for a
renderer port to abstract.

A port only earns its place when a second implementation would plausibly plug
into it and the core genuinely needs to not know which one it got. Three ports
meet that test — a second git provider is the whole point, and a second chat
frontend is foreseeable. The other two would have been interfaces with exactly
one implementation each, imposing an indirection on every call for no
substitutability.

### Why identity resolution is not one of them

Resolving a git user to a **Slack** user id is inherently specific to the chat
frontend: the answer is a Slack identifier, obtained from the Slack API. A core
port returning a Slack id would not be neutral, and one returning something
neutral would just be the chat adapter's own problem pushed up a layer.

This is now settled in code, and settled differently from how the plan first
imagined it. The merged user identity resolver plugin
([docs](../PLUGIN_USER_IDENTITY.md)) lets a company supply an ordered chain of
resolvers. Each resolver answers "who is this person" — emails, or a chat user
id if the company already knows it — and Homer does the Slack lookup itself. The
contract is deliberately chat-neutral so the same plugin would work for another
chat frontend, but it lives beside the chat side rather than among the git
ports, because it answers a question about people, not about repositories.

## Alternatives considered

**Branch on the provider inside the existing handlers.** Cheapest to start, and
honest about there being only two providers. Rejected because the spike shows
the differences are not cosmetic: approvals, webhook taxonomy, mergeability and
user identity each differ, so the branches would multiply through the review
path, and every one of them would be reachable only with a live provider — the
opposite of the testable seam we want.

**A thin anti-corruption layer over GitLab only: keep GitLab's shapes as the
neutral model and make GitHub pretend to be GitLab.** Attractive because it is
nearly free for the existing code and changes no tests. Rejected because GitLab
has fields GitHub cannot supply. The required approval count is the clearest
case: on GitHub it is often unreadable without administration permission we have
decided not to ask for. A GitLab-shaped model forces the GitHub adapter to
invent values, and an invented approval count is a wrong number in a Slack
message.

**A single `GitProvider` port that also parses webhooks.** Fewer moving parts.
Rejected because the two have different lifecycles and different test needs:
parsing is pure and fixture-driven, reads are network-bound and mock-driven, and
the webhook side carries the signature verification, which is security-sensitive
and deserves to be isolated.

**Five ports, as first proposed.** Rejected as above: two of the five would have
had one implementation forever.

**A static plugin manager, like the release feature's.** Rejected in favour of a
small registry populated by constructor injection at startup. The existing
singleton makes release code awkward to test; we do not want to repeat that on
the path we are trying to make testable.

## Consequences

**What this buys.** Adding GitHub becomes mostly additive: mappers, a provider,
a webhook parser, a policy, plus one route and one database migration. The
review path becomes testable without any network, because the fakes behind the
ports pass the same contract suites as the real adapters. The two `object_kind`
switches collapse into one parser-driven dispatch.

**What it costs.**

- _Indirection for a feature that works today._ Phases of this work ship with no
  user-visible change at all. The value is entirely in the second provider; if
  GitHub were abandoned, this would be a net loss in directness.
- _A refactor of the most-used feature with no behaviour change to show for it._
  The mitigation is a Block Kit snapshot test taken before the move, which the
  refactor must keep byte-for-byte identical, plus end-to-end tests that must
  keep returning the same status codes.
- _The neutral domain is a commitment._ It was designed from documentation, not
  from a captured GitHub delivery. Parts of the spike are explicitly marked
  unverified — the exact review state values, how often `mergeable` is still
  being computed, what commit emails look like under email privacy. Some of
  those may force a change to the domain types after they are in use.
- _The neutral model is lossy by construction._ GitHub's "changes requested" has
  no GitLab equivalent and is not in the model; GitLab's "unapproved" has no
  GitHub equivalent. Each addition of a provider-specific concept is a new
  decision, not an automatic extension.
- _Two implementations of the automatic-share rule to keep in step._ They answer
  the same product question in two different vocabularies, and nothing in the
  type system makes them agree.
