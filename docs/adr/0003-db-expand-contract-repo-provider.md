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

So every table needs to say which provider a row belongs to, and we need to
decide what identifies a GitHub repository. GitHub offers two candidates in
every webhook payload: a numeric `repository.id`, and `repository.full_name` —
the `owner/name` slug that every REST call is addressed by.

Two constraints shape how the change is applied. Homer runs migrations with
Umzug in production, but uses `sequelize.sync({ alter: true })` outside
production, so the Sequelize model and the migration are two independent
descriptions of the same schema. And the existing deployment has live rows:
there is no window in which the table is empty.

## Decision

Add the provider information as **new, nullable columns with a default**, and
widen only the columns that will hold a GitHub repository id:

- `repoProvider` — a string, nullable, defaulting to `'gitlab'`, on all three
  tables.
- `repoSlug` — a string, nullable, on `Projects` and `Reviews`.
- `projectId` on `Projects` and `Reviews` widens from `INTEGER` to `BIGINT`.

No column is renamed, and nothing is backfilled: existing rows read back as
GitLab because of the default.

**GitLab rows keep the key they have.** A GitLab row is identified by its
provider plus the numeric `projectId` it already stores, and a review by that
plus `mergeRequestIid`. Every query, and in particular every delete, gains the
provider in its `where` clause. Nothing else about the GitLab path changes, and
no GitLab row is rewritten.

**GitHub rows key on the numeric repository id**, in the same `projectId`
column, with the pull request number in the existing `mergeRequestIid` column —
the same per-repository counter under a GitLab name. Both providers are
therefore keyed the same way: `(provider, numeric repository id)`, plus the
change number for a review.

**The slug is stored but is not a key.** `repoSlug` holds `owner/name` because
GitHub REST calls are addressed by it, and it is refreshed from every webhook
payload. A repository that is renamed or transferred keeps its id, so its rows
keep matching, and the next webhook delivery corrects the stored slug on its
own. Nothing has to be repaired by hand.

`Releases` gets `repoProvider` only. Release management is out of scope for this
work, so no GitHub id will be stored there: the column keeps the three tables
uniform for a later deployment path, while the slug and the widening would be
dead weight today. Widening `Releases.projectId` can happen with the work that
needs it.

**The Sequelize model and the Umzug migration move in the same commit.** The
migration follows the shape of the existing initial-schema migration, and the
change is not finished until a development database built by
`sync({ alter: true })` and a fresh database built by running the migrations
describe the same schema.

### Why `BIGINT` rather than a 32-bit id

GitHub's ids do not fit a signed `INTEGER` for much longer. Repositories created
now carry ids around 1.45 billion, against a maximum of 2,147,483,647 — about
two thirds of the space consumed, with roughly 700 million left. The rate is
accelerating: around 785,000 new ids a day a year ago, around 1.29 million a day
over the last month. That space is shared across GitHub object types, not
repositories alone. On those figures the limit is reached around mid-2028.

Storing a GitHub repository id in an `INTEGER` column is therefore not a choice
between widening now and never widening. It is a choice between widening now,
while the tables are small and nothing depends on the column, and widening under
time pressure in about eighteen months.

## Alternatives considered

**Key GitHub rows on the slug (`owner/name`) and avoid widening anything.**
This was the earlier version of this decision. Rejected on measurement:
`full_name` is not stable. Renaming or transferring a repository changes it,
while the numeric id survives both — confirmed against the live API on three
real moves (`GoogleCloudPlatform/kubernetes` → `kubernetes/kubernetes`,
`facebook/jest` → `jestjs/jest`, `vuejs/vue-next` → `vuejs/core`), each still
resolving under its old path to the same id. The old path only redirects; it
does not keep working as an identifier. A slug key would therefore orphan every
row for a renamed repository — shared reviews silently stop updating, with no
error anywhere — and it would buy only the eighteen months described above,
after which the id columns need widening regardless.

**Rename the columns to neutral names (`projectId` → `repoId`, `mergeRequestIid`
→ `changeNumber`).** The resulting schema is the one we would design from
scratch. Rejected: a rename is not backwards compatible, so the old and the new
code cannot both run against the database. Homer is deployed by other
organisations whose rollouts we do not control, and a rename turns a routine
deploy into a coordinated one. The names are worth less than that. Widening is
not in the same category: a widened column answers every query the old code
sends it.

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

**What this buys.** Both providers are keyed the same way, so lookups and
deletes are one query with the provider added, not two shapes to keep in step. A
renamed or transferred GitHub repository keeps working and repairs its own slug
on the next webhook. Old rows keep working with no change in behaviour, nothing
is backfilled, and GitLab-only installations see no difference. The existing
tests continue to pass unchanged, because every existing row and every fixture
reads as a GitLab row.

**What it costs.**

- _Widening is a real migration step, and the plan had ruled it out._ Changing
  `INTEGER` to `BIGINT` rewrites the table in PostgreSQL and takes an exclusive
  lock for the duration. The reason we accept it is that Homer's tables are
  small — rows are deleted fifteen days after their last update — so the rewrite
  is brief. An installation with an unusually large table should expect a pause
  on deploy. This is the one place where the "purely additive" character of the
  rest of the change does not hold.
- _`BIGINT` can come back from the driver as a string._ PostgreSQL's 64-bit
  integers do not fit a JavaScript number, so drivers often return them as
  strings, and a comparison that used to work on numbers can start failing
  silently. How Sequelize behaves for these columns must be checked explicitly
  when the migration lands, not assumed; the lookups that read `projectId` are
  the first place to look if GitLab rows stop matching after the change.
- _The schema records its own history._ `projectId` holds a GitHub repository id
  for GitHub rows and `mergeRequestIid` holds a pull request number, neither of
  which is what the name says. Anyone reading the tables afterwards needs this
  document, and the ER diagram in [the architecture overview](../ARCHITECTURE.md)
  has to say so.
- _Nullable columns weaken the invariant._ The database cannot enforce "every row
  has a provider" or "every GitHub row has a slug"; only the code can. That is
  the price of adding columns to a populated table without a backfill.
- _The model and the migration can silently drift._ Nothing fails loudly when
  they disagree — development uses `sync`, production uses the migration, so a
  mismatch surfaces only in production. Keeping them in one commit and checking
  that both paths converge is a discipline, not a guarantee.
- _`Releases` is deliberately left half-done._ It gains the provider column but
  not the widening, so the deployment path will need its own migration later.

**Open question.** Whether GitHub ever reissues the id of a deleted repository
has not been checked. If it does, a stale row could match a different repository
rather than simply failing to match — the one way the id could be less stable
than the rename and transfer evidence suggests. Worth confirming before the
migration ships.
