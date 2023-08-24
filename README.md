# Homer

![Homer](./homer256.png)

Homer is a Slack bot intended to help you to **share your Gitlab merge requests**.

## Usage

### Prerequisites

Before being able to use Homer in a Slack channel, you have to follow these
steps:

#### Add a Gitlab project to a Slack channel

- Make sure that the Gitlab user linked to your `GITLAB_TOKEN` has at least the
  `Developer` role in your project.

- Go in the Slack channel.

- Run one of the following commands:
  - `/homer project add PROJECT_ID`
  - `/homer project add PROJECT_NAME`

**⚠️ If you want to use Homer in a private channel, you need to invite it to the
channel first.**

#### Make Homer notified of changes happening in your Gitlab project

To keep up to date the review messages it creates, Homer needs to be notified
when something occurs on the related merge requests.

To do so, you need to set up a webhook in your project:

- Ask for Homer's `GITLAB_SECRET` to the person that manages Homer in your
  organisation.

- Go to the `Webhooks` settings page of your Gitlab project.

- Enter the following URL: `HOMER_BASE_URL/api/v1/homer/gitlab`.

  HOMER_BASE_URL should also be provided by the person that manages Homer in
  your organisation.

- Enter the value of `GITLAB_SECRET` in `Secret Token` field.

- Check the following checkboxes: `Push events`, `Comments`,
  `Merge request events`.

- Click on the `Add webhook` button on the bottom of the page.

ℹ️ This can be skipped if your Gitlab project is already used in another channel.

### Display the help

To display the help, run the following command in any Slack channel or
conversation:

```bash
/homer
```

### Sharing merge requests on a channel

Homer does not post merge requests to the channel automatically. To post it to
the channel, you should use `/homer review <search>` command.

You can provide a merge request ID prefixed with `!`, e.g.: `/homer review !128`.

If you want to get an overview of merge requests that are still being reviewed
(meaning they are not merged yet), use `/homer review list`.

## Install

### Prerequisites

- [Docker Compose](https://docs.docker.com/compose/install/).
- [Ngrok](https://ngrok.com/download).
- [Node.js@18](https://nodejs.org/en/). You can use a version manager like [nvm](https://github.com/nvm-sh/nvm).
- [Yarn@1](https://classic.yarnpkg.com/lang/en/).

### Install and run

```bash
# Clone the repo
git clone https://github.com/ManoManoTech/homer.git

# Go to directory that was just created
cd homer

# Install yarn dependencies
yarn install

# Start the database Docker container
docker compose up -d

# Build Homer
yarn build

# Start Homer
yarn start

# Open a bridge for external HTTP calls to reach your local Homer instance
ngrok http localhost:3000
```

### Create the Slack app

- Go to https://api.slack.com/apps/.
- Click on `Create New App`.
- Select `From an app manifest`.
- Select the right workspace and click on `Next`.
- In [manifest.json](./manifest.json), replace `HOMER_BASE_URL` with the URL provided by the `ngrok`.
- Copy the content of `manifest.json` file and paste it in the Slack webapp
  modal.
- Create the app and enjoy.

### Add Slack emojis

Homer uses custom emojis when posting messages. To have them properly
displayed, you will need to add all the emojis under [emojis](./emojis) to your
Slack organisation.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).
