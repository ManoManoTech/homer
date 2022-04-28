# Homer

![Homer](./homer256.png)

Homer is a Slack bot intended to help you to **share your merge requests** and
**release your Gitlab projects**.

In the future, it will also allow to manage your releases easily.

## Usage

### Prerequisites

Before being able to use Homer in a Slack channel, you have to follow these
steps:

#### Add a Gitlab project to a Slack channel

- Make sure that [core-bot](https://git.manomano.tech/core-bot) has at least the
  `Developer` role in your project.

- Go in the Slack channel.

- Run the following command: `/homer project add PROJECT_NAME` (Also supports `PROJECT_ID`)

**⚠️ Homer does not manage yet private channels.**

#### Make Homer be notified of changes happening in your Gitlab project

To keep up to date the review messages it creates, Homer needs to be notified
when something occurs on the related merge requests.

To do so, you need to set up a webhook in your project:

- Get the Homer's `GITLAB_SECRET` in
  [Vault](https://vault.manomano.tech/ui/vault/secrets/int/show/ms/homer/web).

  Use `dev` role in **SSO** tab to login.

- Go to the `Webhooks` settings page of your Gitlab project (ex:
  https://git.manomano.tech/solutions/spartacux/hooks).

- Click on `Add webhook` button on the bottom of the page.

- Enters the following URL:
  `https://openapi.support.manomano.com/api/v1/homer/gitlab`.

- Enters the value of `GITLAB_SECRET` in `Secret Token` field.

- Check the following checkboxes: `Push events`, `Comments`,
  `Merge request events`.

  _If you want to use Homer to release this project, you must also check
  `Job events`._

- Click on `Add webhook` button on the bottom of the page.

ℹ️ This can be skipped if your Gitlab project is already used in another channel.

#### Configure Homer to release a Gitlab project

- Make sure that the project has been added to the Slack channel where the
  `/release` command will be used.

- Make sure that [core-bot](https://git.manomano.tech/core-bot) has the
  `Maintainer` role in your project.

- Make sure the webhook set up in your project has the `Job events` checked.

- Add your project in the dedicated
  [Homer configuration file](https://git.manomano.tech/tools/homer/-/blob/master/config/homer/projectReleaseConfigs.ts#L19).

  _This step may be quite complex so don't hesitate to ask for some help on
  `#moes-tavern` Slack channel._

Once all these steps are done, you will be able to use the `/release` command
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

## Contributing

Here are listed all the ways you can contribute to the project.

### Issues

If you encounter an issue, you can either create a
[Gitlab issue](https://git.manomano.tech/spartacux-front/homer/-/issues/new) or
describe your problem in `#moes-tavern` Slack channel.

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
- **SLACK_AUTH_TOKEN**: to interact with Slack API.
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
