## Contributing

Here are listed all the ways you can contribute to the project.

### Issues

If you encounter an issue, you can create a
[Github issue](https://github.com/ManoManoTech/homer/issues/new).

### Develop

#### Necessary environment variables

- **DB_PASSWORD**: password used when connecting to the database.
- **DB_USERNAME**: username used when connecting to the database.
- **GITLAB_SECRET_TOKEN**: from Gitlab project webhooks, to validate incoming
  Gitlab requests.
- **GITLAB_TOKEN**: to interact with the Gitlab API.
- **SLACK_BOT_USER_O_AUTH_ACCESS_TOKEN**: to publish Slack messages.
- **SLACK_SIGNING_SECRET**: to validate incoming Slack requests.
- **TOOLS_COMMON_PG_PORT**: port where the PostgreSQL database listens.
- **TOOLS_COMMON_PG_WRITE_HOST**: host of the PostgreSQL database.

#### Use Ngrok

```bash
ngrok http localhost:3000
```

#### Start the database locally

```bash
docker compose up -d
```
