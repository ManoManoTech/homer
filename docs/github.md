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
- `GITHUB_URL` (default `https://github.com`) and `GITHUB_API_URL` (default
  `https://api.github.com`): change them for GitHub Enterprise Server.

## Webhook

In the repository (or organization) settings, add a webhook:

- Payload URL: `https://<homer host><API_BASE_PATH>/github`
- Content type: `application/json`
- Secret: the value of `GITHUB_SECRET`
- Events: pull requests, pull request reviews, pull request review comments,
  issue comments, pushes and deployment statuses.

## Add a repository to a channel

```
/homer project add github <search, owner/repo or repository id>
/homer project add https://github.com/owner/repo
```
