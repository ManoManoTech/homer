## Contributing

Here are listed all the ways you can contribute to the project.

### Issues

If you encounter an issue, you can create a
[Github issue](https://github.com/ManoManoTech/homer/issues/new).

### Develop

#### Necessary environment variables

- **GITLAB_SECRET_TOKEN**: from Gitlab project webhooks, to validate incoming
  Gitlab requests.
- **GITLAB_TOKEN**: to interact with the Gitlab API.
- **POSTGRES_HOST**: host of the PostgreSQL database.
- **POSTGRES_PASSWORD**: password used when connecting to the PostgreSQL
  database.
- **POSTGRES_PORT**: port where the PostgreSQL database listens.
- **POSTGRES_USER**: username used when connecting to the PostgreSQL database.
- **SLACK_BOT_USER_O_AUTH_ACCESS_TOKEN**: to publish Slack messages.
- **SLACK_SIGNING_SECRET**: to validate incoming Slack requests.

#### Use Ngrok

```bash
ngrok http localhost:3000
```

#### Start the database locally

```bash
docker compose up -d
```
