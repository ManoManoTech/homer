# Homer

![Homer](./homer256.png)

Homer is a Slack bot intended to help you to **share your merge requests** and
**release your Gitlab projects**.

In the future, it will also allow to manage your releases easily.

## Contents

[[_TOC_]]

## Usage

### Prerequisites

Before being able to use Homer in a Slack channel, you have to follow these
steps:

#### Add a Gitlab project to a Slack channel

- Make sure that [core-bot](https://git.manomano.tech/core-bot) has at least the
  `Developer` role in your project.

- Go in the Slack channel.

- Run the following command: `/homer project add PROJECT_NAME` (Also supports `PROJECT_ID`)

**⚠️ If you want to use Homer in a private channel, you need to invite it to the
channel first.**

#### Make Homer be notified of changes happening in your Gitlab project

To keep up to date the review messages it creates, Homer needs to be notified
when something occurs on the related merge requests.

To do so, you need to set up a webhook in your project:

- Get the Homer's `GITLAB_SECRET` in
  [Vault](https://vault-eu-west-3.int.manomano.com/ui/vault/secrets/int/show/ms/homer/function).

  Use the role matching your feature team in **SSO** tab to log in and go to the
  `int/ms/homer/function` folder.

- Go to the `Webhooks` settings page of your Gitlab project (ex:
  https://git.manomano.tech/solutions/spartacux/hooks).

- Enter the following URL:
  `https://openapi.support.manomano.com/api/v1/homer/gitlab`.

- Enter the value of `GITLAB_SECRET` in `Secret Token` field.

- Check the following checkboxes: `Push events`, `Comments`,
  `Merge request events`.

  _If you want to use Homer to release this project, you must also check
  `Deployment events`._

- Click on the `Add webhook` button on the bottom of the page.

ℹ️ This can be skipped if your Gitlab project is already used in another channel.

#### Configure Homer to release a Gitlab project

- Make sure that the project has been added to the Slack channel where the
  `/homer release` command will be used.

- Make sure that [core-bot](https://git.manomano.tech/core-bot) has the
  `Maintainer` role in your project.

- Make sure the webhook set up in your project has the `Deployment events` checked.

- Add your project in the dedicated
  [Homer configuration file](https://git.manomano.tech/tools/homer/-/blob/master/config/homer/projectReleaseConfigs.ts#L19).

  _This step may be quite complex so don't hesitate to ask for some help on
  `#moes-tavern-homer` Slack channel._

Once all these steps are done, you will be able to use the `/homer release` command
to make Homer release your project.

Homer will:

- Create the release notes automatically with links to MRs and JIRA tickets.

  _To do so, Homer will analyse the commits since the previous release and try to
  find merge commits and Jira references._

- Publish most of the messages automatically in `#it-deploy` and in the channel
  of your choice.

### Display the help

To display the help, run the following command in any Slack channel or
conversation:

```bash
/homer
```

### Sharing merge request on a channel

Homer does not post merge requests to the channel automatically. To post it to
the channel, you should use `/homer review <search>` command.

You can provide merge request ID prefixed with `!`, e.g.: `/homer review !128`.

Command `/homer review list` shows all the ongoing merge requests.

### Make a release

- Run a `/homer release` command. A modal form will appear.
- Provide project to release and a tag.
- Service would be deployed to INT and STG automatically. You need to deploy to PRD manually using Gitlab pipeline.
- Standard projects will be deployed automatically to INT and STG environments but you need to deploy to PRD manually using the Gitlab pipeline.
- Post message about successful deployment manually.

## Contributing

Here are listed all the ways you can contribute to the project.

### Issues

If you encounter an issue, you can either create a
[Gitlab issue](https://git.manomano.tech/tools/homer/-/issues/new) or
describe your problem in `#moes-tavern-homer` Slack channel.

### Develop

#### Monitoring

- [Datadog INT logs](https://app.datadoghq.eu/logs?cols=host%2Cservice&from_ts=1573722380129&index=&live=true&messageDisplay=inline&query=service%3A%2Ahomer%2A%20%40env%3Aint&stream_sort=desc&to_ts=1573723280129)
- [Datadog SUPPORT logs](https://app.datadoghq.eu/logs?cols=host%2Cservice&from_ts=1573722380129&index=&live=true&messageDisplay=inline&query=service%3A%2Ahomer%2A%20%40env%3Asupport&stream_sort=desc&to_ts=1573723280129)

#### Necessary environment variables

- **COREBOT_TOKEN**: to interact with Gitlab API.
- **DB_PASSWORD**: password of the database.
- **DB_USERNAME**: username of the database.
- **GITLAB_SECRET_TOKEN**: from Gitlab project webhooks to validate entering
  Gitlab requests.
- **SLACK_BOT_USER_O_AUTH_ACCESS_TOKEN**: to publish Slack messages.
- **SLACK_SIGNING_SECRET**: to validate entering Slack requests.
- **TOOLS_COMMON_PG_PORT**: port of the database.
- **TOOLS_COMMON_PG_WRITE_HOST**: host of the database.

#### Use Ngrok in DEV env

```bash
ngrok http localhost:3000
```

#### Use Ngrok in INT env

```bash
ngrok http -host-header=ms.homer.int.manomano.com ms.homer.int.manomano.com
```

#### Start DB locally

```bash
docker-compose up -d
```
