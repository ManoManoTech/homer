# GitHub setup

Homer can follow GitHub pull requests next to GitLab merge requests. GitHub
support is optional: without `GITHUB_TOKEN`, Homer runs GitLab only.

See the [support matrix](github-support.md) for what works on GitHub.

## Environment variables

- `GITHUB_TOKEN`: token used to call the GitHub API. A fine-grained token
  scoped to the repositories Homer follows needs these repository permissions:
  - Metadata: read
  - Pull requests: read and write (update branch)
  - Contents: read and write (releases and tags)
  - Commit statuses, Checks: read
  - Actions: read and write (re-run and cancel workflow runs)
  - Deployments: read
  - Administration: read (optional, to read the required approvals of classic
    branch protection; rulesets only need Metadata)
- `GITHUB_SECRET`: any value. Use the same value as the webhook secret so
  Homer can verify that GitHub→Homer calls are authentic.
- `GITHUB_LOGIN_MATCHES_EMAIL` (default `false`): see [Slack users](#slack-users).
- `GITHUB_URL` (default `https://github.com`) and `GITHUB_API_URL` (default
  `https://api.github.com`): change them for GitHub Enterprise Server.

## Webhook

In the repository (or organization) settings, add a webhook:

- Payload URL: `https://<homer host><API_BASE_PATH>/github`
- Content type: `application/json`
- Secret: the value of `GITHUB_SECRET`
- Events: pull requests, pull request reviews, pull request review comments,
  issue comments, pushes and deployment statuses.

## Slack users

Homer mentions people on Slack, so it needs the Slack account of each GitHub
user. It tries, in order:

1. `config/homer/githubUsers.json`, which maps GitHub logins to Slack emails:

   ```json
   {
     "octocat": "john.doe@my-domain.com"
   }
   ```

   Like `projects.json`, this file is bundled at build time: override it when
   building your image.

2. The user identity resolvers of `USER_IDENTITY_RESOLVERS` (see
   [PLUGIN_USER_IDENTITY.md](PLUGIN_USER_IDENTITY.md)), called with
   `provider: 'github'`. The built-in `emailDomainConvention` tries
   `<login>@<domain>` only when `GITHUB_LOGIN_MATCHES_EMAIL=true`. Keep it off on
   github.com: anyone can register a login that matches a colleague's email and
   be shown as them.
3. The public email of the GitHub profile, which GitHub verifies.

`/homer review list` puts GitHub pull requests waiting for you first only when
`githubUsers.json` maps your Slack email to your login.

Users who match none of them are not mentioned, and their actions are not
posted in review threads.

## Releases

Declare the repository in `config/homer/projects.json` with
`"provider": "github"` and its numeric repository id as `projectId`. The
`githubReleaseManager` plugin waits for every workflow run of the default
branch head to succeed before creating the release, then follows
`deployment_status` events with the same environments as
`defaultReleaseManager` (`staging*`, `production*`, `support*`).

Homer creates the tag through a GitHub release on the default branch head.
Canceling a release renames it `[NOT DEPLOYED] <name>` and cancels the
workflow runs of the tag.

## Add a repository to a channel

```
/homer project add github <search, owner/repo or repository id>
/homer project add https://github.com/owner/repo
```
