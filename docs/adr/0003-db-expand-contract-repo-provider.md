# 3. Add provider columns by expand and contract

- **Status:** Accepted
- **Date:** 2026-11-09

## Context

Three tables identify a GitLab project by a numeric `projectId`: `Projects`
(which channel a project is shared in), `Reviews` (which Slack message tracks
which merge request), and `Releases`. `Reviews` additionally stores GitLab's
per-project `mergeRequestIid`. All of these id columns are `INTEGER`.

Once GitHub rows live in the same tables, a numeric id alone is ambiguous:
GitLab project 42 and GitHub repository 42 are different repositories, and
GitLab merge request `!7` and GitHub pull request `#7` are different changes. A
lookup or a delete that matches on the number alone can touch the wrong rows —
a cross-project variant of this bug already existed and was fixed before this
work started.

Two constraints shape the change. Homer runs migrations with Umzug in
production, but uses `sequelize.sync({ alter: true })` outside production, so
the Sequelize model and the migration are two independent descriptions of the
same schema. And the existing deployment has live rows: there is no window in
which the table is empty.

## Decision

Add the provider information as **new, nullable columns with a default**, and
leave every existing column untouched:

- `repoProvider` — a string, nullable, defaulting to `'gitlab'`.
- `repoSlug` — a string, nullable, for the repository path.

No column is renamed. No column is widened. Nothing is backfilled by the
migration: existing rows read back as GitLab because of the default.

**GitLab rows keep the key they have.** A GitLab row is identified by its
provider plus the numeric `projectId` it already stores, and a review by that
plus `mergeRequestIid`. Every query, and in particular every delete, gains the
provider in its `where` clause. Nothing else about the GitLab path changes, and
no GitLab row is rewritten.

**GitHub rows key on the repository slug** — `owner/name` — in `repoSlug`,
with the pull request number in the existing `mergeRequestIid` column, which is
the same per-repository counter under a GitLab name. The slug is what every
GitHub REST call needs, so a row keyed on it is directly usable; and it avoids
putting GitHub's large and still-growing numeric repository ids into a 32-bit
`INTEGER` column, which is the one thing a non-widening migration cannot
accommodate.

**The Sequelize model and the Umzug migration move in the same commit.** The
migration follows the shape of the existing initial-schema migration, and the
change is not finished until a development database built by `sync({ alter: true })`
and a fresh database built by running the migrations describe the same schema.

## Alternatives considered

**Rename the columns to neutral names (`projectId` → `repoId`, `mergeRequestIid`
→ `changeNumber`).** The resulting schema is the one we would design from
scratch. Rejected: a rename is not backwards compatible, so the old and the new
code cannot both run against the database. Homer is deployed by other
organisations whose rollouts we do not control, and a rename turns a routine
deploy into a coordinated one. The names are worth less than that.

**Widen the id columns to `BIGINT` and store GitHub's numeric repository id.**
Keeps both providers keyed the same way and survives a repository rename, which
the slug does not. Rejected for this step: it is a type change on a populated
column in three tables, so it carries the same compatibility problem as a rename
for no benefit the slug does not provide, and the spike could not confirm how
close GitHub's current ids are to the 32-bit limit. If a rename or transfer
turns out to hurt in practice, this is the obvious follow-up, and it is
unaffected by the columns added now.

**One combined column, for example a `provider:id` string key.** Rejected:
it makes every query do string surgery, it cannot be indexed usefully per
provider, and it would have to be backfilled, which is exactly the rewrite of
live rows this decision avoids.

**Separate tables per provider.** Rejected: the review path is one feature, and
duplicating the tables would duplicate every query, every cleanup job and the
release wiring with it, to express a difference that is one column wide.

**Let `sync({ alter: true })` handle it and skip the migration.** Rejected:
production does not run `sync`, so this would ship a model the production schema
does not have.

## Consequences

**What this buys.** The migration is additive and defaulted, so it needs no
downtime, no backfill and no coordinated deploy, and old rows keep working with
no change in behaviour. GitLab-only installations never see a difference. The
existing tests continue to pass unchanged, because every existing row and every
fixture reads as a GitLab row.

**What it costs.**

- _The schema records its own history._ `mergeRequestIid` will hold GitHub pull
  request numbers, and `projectId` will be empty for GitHub rows while `repoSlug`
  is empty for GitLab rows. Anyone reading the tables afterwards needs this
  document to make sense of them, and the ER diagram in
  [the architecture overview](../ARCHITECTURE.md) has to say so.
- _The two providers are keyed differently._ Any code that looks up a repository
  must branch on the provider rather than share one lookup, and that branch is
  easy to forget in a query written later.
- _The slug is not stable._ Renaming or transferring a GitHub repository changes
  `owner/name`, which orphans the rows that reference it: shared reviews stop
  updating and have to be re-shared. GitLab rows do not have this problem. This
  is the accepted cost of not widening the id columns, and the reason the
  `BIGINT` alternative above stays on the table.
- _Nullable columns weaken the invariant._ The database cannot enforce "a GitLab
  row has a `projectId`, a GitHub row has a `repoSlug`"; only the code can. That
  is the price of adding columns to a populated table without a backfill.
- _The model and the migration can silently drift._ Nothing fails loudly when
  they disagree — development uses `sync`, production uses the migration, so a
  mismatch surfaces only in production. Keeping them in one commit and checking
  that both paths converge is a discipline, not a guarantee.
