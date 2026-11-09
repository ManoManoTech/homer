# 2. The neutral boundary is the domain model, not a rendered view

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

[ADR 1](./0001-pluggable-git-backends-ports-and-adapters.md) introduces a
`ChatNotifier` port between the core and the chat frontend. That port needs an
argument type, and the choice of argument type is the whole design.

Today `buildReviewMessage.ts` does three things in one function: it fetches what
it needs from GitLab (approvers, reviewers, users, project) in a `Promise.all`,
it resolves each git user to a Slack user, and it assembles Slack Block Kit. It
returns the message rather than sending it, so the coupling is awkward but not a
monolith.

An earlier proposal put the boundary higher: the core would produce a neutral,
chat-agnostic description of the message — a view tree of sections, fields,
buttons and links — and each chat adapter would translate that tree into its own
format. It is the more ambitious boundary, and it would make a second chat
frontend nearly free.

## Decision

The core passes **neutral domain objects** across `ChatNotifier`: the merge
request, approval information, git users, commits, a pipeline status, a message
handle. The chat adapter decides what the message looks like.

Concretely, this means two things stay inside the Slack adapter:

- **All Block Kit rendering.** `buildReviewMessage` moves into the Slack
  adapter, where it becomes a pure function from domain objects to Block Kit.
  The core never mentions a block, an accessory, or a Slack identifier.
- **All resolution of git users to Slack users**, through the user identity
  resolver chain. The core hands over a `GitUser` carrying a username and,
  when the provider supplied one, an email; turning that into a Slack mention is
  the Slack adapter's job.

The data fetching moves the other way: the `Promise.all` fan-out leaves the
renderer and becomes the orchestrator's responsibility, so the renderer receives
everything it needs and performs no I/O.

The neutral view tree is **not** built.

## Alternatives considered

**A neutral view model: the core renders a chat-agnostic view tree, each
frontend translates it.** Rejected on risk against benefit.

The benefit is real but speculative. There is no second chat frontend planned;
the `ChatNotifier` port alone already keeps the door open, and a future frontend
would implement that port with its own rendering, exactly as Slack does.

The cost is immediate and large. The view tree would have to be lossless for
every Slack feature the current message uses — overflow menus with per-provider
button sets, thread replies, user mentions resolved to Slack ids, the exact
field layout. Anything the tree cannot express is a visible regression in a
message the whole company reads. In practice the tree would end up mirroring
Block Kit, because Block Kit is the only consumer, and we would have paid for an
abstraction over an audience of one. Worse, it moves the _riskiest_ part of the
refactor — "does this still render identically?" — into new code that must be
written from scratch, instead of leaving it in code that already works and whose
output we can snapshot.

Dropping it changes the character of the refactor. With the domain boundary, the
hardest step is "move the fetch fan-out out of the renderer and pass it in" — a
mechanical change whose correctness is proved by the pre-existing Block Kit
snapshot. With the view model, the hardest step would have been a rewrite of the
rendering with no reference output to compare against.

**Keep Slack-user resolution in the core and pass resolved chat users to the
notifier.** Rejected: a resolved Slack user id is not a neutral value, so the
core would be carrying a Slack concept in its domain. Resolution also needs the
Slack API to confirm the user exists, which would put a Slack dependency back in
the core. The chat-neutral part of that problem — "who is this person" — is
already solved separately by the user identity resolver contract, which answers
in emails or a chat user id and leaves the chat lookup to the adapter.

**Pass raw provider payloads to the notifier and let the Slack adapter read
whatever it needs.** Rejected: that is the current coupling with extra steps, and
it would require the Slack adapter to understand both GitLab and GitHub shapes —
so the provider differences would reappear on the chat side.

## Consequences

**What this buys.**

- Block Kit stays in one place, and the snapshot of its output is a
  byte-for-byte regression gate across the whole refactor.
- The riskiest idea in the original plan is simply not built.
- The core's dependency list loses `@slack/*` entirely; the ports become easy to
  implement with a fake notifier that records what it was asked to post.
- Provider-specific presentation lands where the information is: the per-provider
  set of message buttons, and the rendering for an approval count GitHub cannot
  supply, are both decisions the Slack adapter makes from what the domain gives
  it.

**What it costs.**

- _A second chat frontend is not free._ It would have to render the messages
  again from the domain, duplicating layout decisions. That is the price of not
  building the view tree, and we are paying it deliberately because no such
  frontend is planned.
- _The domain model carries presentation pressure._ Every field the message
  shows must exist in the domain, so product changes to the message can push
  changes into neutral types shared with the git adapters. "Changes requested"
  is the live example: GitHub-only, and adding it to the message means adding it
  to the model.
- _The orchestrator grows._ Fetch fan-out, the channel notification threshold,
  multi-channel posting, the comment debouncer and the rebase-commit filter all
  move into it. It becomes the one place where getting the sequencing wrong is
  user-visible, and it must preserve those behaviours exactly.
- _Rendering is not covered by the provider contract tests._ The contract suites
  prove the adapters agree on the domain; nothing proves that a GitHub merge
  request renders sensibly until the end-to-end parity test is written.
