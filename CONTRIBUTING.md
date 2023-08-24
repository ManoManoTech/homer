## Contributing

Here are listed all the ways you can contribute to the project.

### Issues

If you encounter an issue, you can either create a
[Github issue](https://github.com/ManoManoTech/homer/issues/new).

### Develop

#### Necessary environment variables

- **DB_PASSWORD**: password of the database.
- **DB_USERNAME**: username of the database.
- **GITLAB_SECRET_TOKEN**: from Gitlab project webhooks to validate entering
  Gitlab requests.
- **GITLAB_TOKEN**: to interact with Gitlab API.
- **SLACK_BOT_USER_O_AUTH_ACCESS_TOKEN**: to publish Slack messages.
- **SLACK_SIGNING_SECRET**: to validate entering Slack requests.
- **TOOLS_COMMON_PG_PORT**: port of the PostgreSQL database.
- **TOOLS_COMMON_PG_WRITE_HOST**: host of the PostgreSQL database.

#### Use Ngrok

```bash
ngrok http localhost:3000
```

#### Start database locally

```bash
docker compose up -d
```
