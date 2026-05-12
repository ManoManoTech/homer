# Homer — Architectural Overview

A Node.js/Express + Sequelize Slack bot that bridges **Slack** ↔ **GitLab** for sharing/tracking merge requests, generating changelogs, and managing project releases.

Entry: `src/index.ts` → `src/start.ts` → `src/app.ts` → `src/router.ts`.

---

## 1. High-level dataflow

```mermaid
flowchart LR
    subgraph SLACK[Slack]
      U[Users]
      SC[Slash commands<br/>/homer ...]
      SI[Interactive payloads]
      SE[Events / app_home]
    end

    subgraph GITLAB[GitLab]
      MR[Merge requests]
      DEP[Deployments]
      WH[Project webhooks]
    end

    subgraph HOMER[Homer Express app]
      MW[securityMiddleware<br/>HMAC + secret]
      R[router.ts]
      CMD[commandRequestHandler]
      INT[interactiveRequestHandler]
      EVT[eventRequestHandler]
      GH[gitlabHookHandler]
      DB[(PostgreSQL<br/>Sequelize)]
      WC[slackBotWebClient]
      GC[gitlab.ts<br/>REST v4 client]
    end

    U --> SC --> MW
    U --> SI --> MW
    SE --> MW
    WH --> MW
    MW --> R
    R --> CMD
    R --> INT
    R --> EVT
    R --> GH
    CMD --> DB
    INT --> DB
    GH --> DB
    CMD --> WC --> SLACK
    INT --> WC
    GH --> WC
    GH --> GC --> GITLAB
    CMD --> GC
```

- **Slack → Homer**: slash commands (`/homer …`), interactive payloads, events, app-home opens.
- **GitLab → Homer**: project webhooks (`merge_request`, `note`, `push`, `deployment`).
- **Homer → Slack**: `@slack/web-api` `WebClient` (`slackBotWebClient`) posts/updates messages, opens modals, posts ephemerals.
- **Homer → GitLab**: REST v4 calls in `src/core/services/gitlab.ts` using `GITLAB_TOKEN`.

---

## 2. Critical security boundary

`src/core/middlewares/securityMiddleware.ts` — every request to the API router must validate as either GitLab or Slack, otherwise `401`.

```mermaid
flowchart TD
    REQ[Incoming request] --> CHK{Path}
    CHK -->|/api/monitoring/*| HC[Health/readiness<br/>no auth]
    CHK -->|/api/v1/homer/*| SEC[securityMiddleware]
    SEC --> ISGL{X-Gitlab-Event<br/>header?}
    ISGL -->|yes| TOK{X-Gitlab-Token<br/>== GITLAB_SECRET?}
    TOK -->|yes| OK[next]
    TOK -->|no| DENY[401 Unauthorized]
    ISGL -->|no| ISSK{User-Agent<br/>contains Slackbot?}
    ISSK -->|no| DENY
    ISSK -->|yes| TS{Timestamp<br/><= 5 min old?}
    TS -->|no| DENY
    TS -->|yes| HMAC{HMAC SHA256<br/>v0:ts:rawBody<br/>== X-Slack-Signature?}
    HMAC -->|yes| OK
    HMAC -->|no| DENY
```

> ⚠️ `app.ts:14-16` captures `rawBody` on the request — required for the Slack signature check. Don't refactor body parsing without preserving it.

---

## 3. Routing surface

All under `CONFIG.apiBasePath` (default `/api/v1/homer`):

| Route                             | Handler                     | Purpose                                                               |
| --------------------------------- | --------------------------- | --------------------------------------------------------------------- |
| `POST /command`                   | `commandRequestHandler`     | dispatches `changelog \| project \| release \| review` slash commands |
| `POST /event`                     | `eventRequestHandler`       | Slack events incl. `app_home_opened`                                  |
| `POST /interactive`               | `interactiveRequestHandler` | block actions, view submissions, etc.                                 |
| `POST /gitlab`                    | `gitlabHookHandler`         | dispatched by `object_kind`                                           |
| `POST /release`                   | `helpRequestHandler`        | help passthrough                                                      |
| `POST /review`                    | `helpRequestHandler`        | help passthrough                                                      |
| `GET /api/monitoring/healthcheck` | `healthCheckRequestHandler` | liveness — returns `🍩`                                               |
| `GET /api/monitoring/readiness`   | `readinessRequestHandler`   | DB-backed readiness — `200`/`503`                                     |

```mermaid
flowchart TD
    GH[POST /gitlab<br/>gitlabHookHandler] --> OK{object_kind}
    OK -->|deployment| RH[releaseHookHandler] --> DH[deploymentHookHandler]
    OK -->|merge_request| MRH[reviewHookHandler] --> MRHH[mergeRequestHookHandler]
    OK -->|note| NRH[reviewHookHandler] --> NHH[noteHookHandler]
    OK -->|push| PRH[reviewHookHandler] --> PHH[pushHookHandler]
    OK -->|other| NC[204 No Content]
```

---

## 4. Feature mind map

```mermaid
mindmap
  root((Homer))
    Review
      /homer review search
      /homer review list
      Labels
        homer-review
        homer-mergeable
      Webhooks
        merge_request
        note
        push
      DB Reviews
    Release
      /homer release
      /homer release cancel
      /homer release end
      Plugin system
        ReleaseManager
        ReleaseTagManager
          semantic
          federation
          stableDate
      Webhooks
        deployment
      DB Releases
    Project
      /homer project add
      /homer project list
      /homer project remove
      DB Projects
    Changelog
      /homer changelog
      Modal selectors
    Home
      app_home_opened
    Core
      Security middleware
      Sequelize + umzug
      Slack WebClient
      GitLab REST v4
      Logger
```

---

## 5. GitLab review flow

`src/review/`

- **Triggers**: `/homer review <search>`, `/homer review list`, or labels `homer-review` / `homer-mergeable` on the MR.
- **Webhook entry**: `mergeRequestHookHandler.ts` — only acts on actions `approved | close | merge | reopen | update | open | unapproved`.

```mermaid
sequenceDiagram
    participant GL as GitLab
    participant H as Homer
    participant DB as PostgreSQL
    participant SL as Slack

    GL->>H: webhook merge_request (action, labels, iid, projectId, user)
    H->>H: securityMiddleware
    H->>DB: getReviewsByMergeRequestIid(projectId, iid)
    alt no existing review
        H->>H: check labels (homer-review / homer-mergeable + status)
        opt label triggers
            H->>DB: getChannelsByProjectId(projectId)
            alt channels > SLACK_CHANNEL_NOTIFICATION_THRESHOLD
                H->>H: log warn, skip
            else within threshold
                loop each linked channel
                    H->>SL: chat.postMessage(buildReviewMessage)
                    H->>DB: addReviewToChannel(channel, mr, ts)
                end
            end
        end
    else existing review
        H->>SL: lookup user by gitlab username + EMAIL_DOMAINS
        loop each existing review row
            H->>SL: chat.update main message
            opt approved/close/merge/unapproved
                H->>SL: chat.postMessage thread reply
            end
        end
        opt action in {close, merge}
            H->>DB: removeReviewsByMergeRequestIid
        end
    end
```

> Guard at `mergeRequestHookHandler.ts:111` — if linked-channels count exceeds `SLACK_CHANNEL_NOTIFICATION_THRESHOLD` (default 3), notifications are skipped to prevent spam.

---

## 6. Release manager

The most stateful part of the system.

### Configuration

`config/homer/projects.json`, validated by Ajv in `src/release/utils/configBuilder.ts`. Each project entry maps to a `ProjectReleaseConfig`:

- `projectId`, `releaseChannelId`, `notificationChannelIds[]`
- `releaseManager` (string → resolved via `ReleasePluginManager`)
- `releaseTagManager` (one of `semantic | federation | stableDate`)
- `hasReleasePipeline?`

### Plugin system

```mermaid
classDiagram
    class ReleasePluginManager {
      -Map releaseManagers
      -Map releaseTagManagers
      +loadReleaseManagerPlugin(path)
      +getReleaseManager(name)
      +getReleaseTagManager(name)
    }
    class ReleaseManager {
      <<interface>>
      +isReadyToRelease()
      +getReleaseStateUpdate()
      +buildReleaseModalView()?
      +filterChangelog()?
      +filterReleasesToClean()?
      +blockActionsHandler()?
    }
    class ReleaseTagManager {
      <<interface>>
      +createReleaseTag(prev?)
      +isReleaseTag(tag)
      +extractAppName(tag)?
    }
    class semanticReleaseTagManager
    class federationReleaseTagManager
    class stableDateReleaseTagManager
    class CustomPlugin {
      from plugins/release/&lt;name&gt;
    }

    ReleasePluginManager o-- ReleaseManager
    ReleasePluginManager o-- ReleaseTagManager
    ReleaseTagManager <|.. semanticReleaseTagManager
    ReleaseTagManager <|.. federationReleaseTagManager
    ReleaseTagManager <|.. stableDateReleaseTagManager
    ReleaseManager <|.. CustomPlugin
```

`ReleasePluginManager` is a singleton. Built-in _tag managers_ are registered in the constructor. Custom _release managers_ are dynamically `import()`-ed from `@root/plugins/release/<name>` on first use. Loading rejects the same manager twice.

### State machine

```mermaid
stateDiagram-v2
    [*] --> notYetReady: createRelease<br/>(modal submit)
    notYetReady --> notYetReady: poll isReadyToRelease<br/>every 30s
    notYetReady --> created: ready &amp; startRelease<br/>creates GitLab release
    notYetReady --> [*]: 45 min timeout<br/>row removed
    created --> created: deployment hooks<br/>updateRelease (TX + LOCK)
    created --> monitoring: prod/support reaches<br/>monitoring state
    monitoring --> [*]: prod/support reaches<br/>completed (row removed)
    created --> [*]: prod/support reaches<br/>completed (row removed)
```

### Lifecycle (sequence)

```mermaid
sequenceDiagram
    participant U as User
    participant SL as Slack
    participant H as Homer
    participant DB as PostgreSQL
    participant GL as GitLab

    U->>SL: /homer release
    SL->>H: POST /command
    H->>SL: views.open (loading modal)
    H->>SL: views.update (release modal)
    U->>SL: submit modal
    SL->>H: POST /interactive (view_submission)
    H->>GL: generateChangelog
    H->>DB: createRelease(state=notYetReady)
    H->>H: waitForReadinessAndStartRelease
    loop until ready / 45 min
        H->>GL: releaseManager.isReadyToRelease(pipelineId)
    end
    alt ready
        H->>GL: POST /projects/:id/releases (tag)
        opt hasReleasePipeline
            H->>GL: waitForReleasePipeline
        end
        H->>SL: chat.postMessage release card
        H->>DB: updateRelease(state=created, ts)
    else timeout
        H->>DB: removeRelease
        H->>SL: ephemeral "timeout, please retry"
    end

    Note over GL,H: deployment webhooks
    GL->>H: webhook deployment (status)
    H->>GL: fetchDeploymentById
    H->>DB: updateRelease (TX + row lock)
    H->>H: releaseManager.getReleaseStateUpdate
    par notify
        H->>SL: chat.postMessage on each notificationChannelId
    and update card
        H->>SL: chat.update on releaseChannelId
    end
    opt prod/support completed
        H->>DB: removeRelease
    end
    opt prod/support monitoring
        H->>DB: updateRelease(state=monitoring)
    end
```

### Crash recovery

`start.ts:27` calls `waitForNonReadyReleases()` after DB connect → re-runs the readiness loop for every `Release` still in state `notYetReady`. If you rename state values, update this function too.

---

## 7. Database access

`src/core/services/data.ts`

```mermaid
erDiagram
    PROJECTS ||--o{ REVIEWS : "linked via projectId"
    PROJECTS ||--o{ RELEASES : "linked via projectId"

    PROJECTS {
        int id PK
        string channelId
        int projectId
        timestamptz createdAt
        timestamptz updatedAt
    }
    REVIEWS {
        int id PK
        string channelId
        int projectId
        int mergeRequestIid
        string ts
        timestamptz createdAt
        timestamptz updatedAt
    }
    RELEASES {
        int id PK
        int projectId
        string tagName
        string state
        text description
        text slackAuthor "JSON"
        text startedDeployments "JSON"
        text successfulDeployments "JSON"
        text failedDeployments "JSON"
        string ts
        timestamptz createdAt
        timestamptz updatedAt
    }
```

- **PostgreSQL via Sequelize**, connection pool tunable via `POSTGRES_POOL_*`.
- Three models defined inline in `data.ts:34-56`.
- **Migrations**: `NODE_ENV=production` runs `umzug` against `src/core/migrations/*.js` (`migrator.ts`). Non-prod uses `sequelize.sync({ alter: true })` for convenience. The single existing migration (`2026.04.02T00.00.00.initial-schema.ts`) is intentionally idempotent (`CREATE TABLE IF NOT EXISTS`) so DBs that were previously sync-managed don't break. CLI: `pnpm migrate{,:down,:status}` via `src/migrate.ts`.
- **Cleanup**: on startup and every 24 h, rows whose `updatedAt` is older than 15 days are deleted (`cleanOldEntries`).
- **Concurrency**: `updateRelease` wraps the read-modify-write in a transaction with `LOCK.UPDATE` to avoid races between concurrent deployment hooks (`data.ts:276`).
- **Quirk**: deployment lists are stored as **stringified JSON in TEXT columns**. `getReleaseDeployments` (`data.ts:336`) transparently migrates the legacy `["staging","production"]` shape to `[{environment, date}]` on read.
- **Readiness probe** (`/api/monitoring/readiness`) calls `checkDatabaseConnection()` (`sequelize.authenticate()`), so it reflects DB health.

---

## 8. Configuration & environment

```mermaid
flowchart LR
    ENV[.env / process.env] --> CFG[CONFIG in src/config.ts]
    CFG --> PG[postgres.*]
    CFG --> GL[gitlab.url / token / secret]
    CFG --> SK[slack.signingSecret / accessToken<br/>emailDomains / supportChannel<br/>channelNotificationThreshold]
    CFG --> TKT[ticketManagementUrlPattern]
    JSON[config/homer/projects.json] --> CB[configBuilder + Ajv]
    CB --> PRC[ProjectReleaseConfig list]
    PM[ReleasePluginManager] --> PRC
```

Auth/secrets:

- `GITLAB_SECRET`, `GITLAB_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_BOT_USER_O_AUTH_ACCESS_TOKEN`

Mapping/config:

- `EMAIL_DOMAINS` — used to derive Slack user from GitLab username
- `GITLAB_URL`, `TICKET_MANAGEMENT_URL_PATTERN`
- `SLACK_SUPPORT_CHANNEL_{ID,NAME}`
- `SLACK_CHANNEL_NOTIFICATION_THRESHOLD` (default 3)
- `REQUEST_BODY_SIZE_LIMIT` — applied to `express.json` and `express.urlencoded` (default `5mb`); a payload above the limit is rejected by the parser before any handler runs, and `errorMiddleware` emits a structured `request body exceeded size limit` log with the request's `Content-Length` for observability

DB: `POSTGRES_HOST/USER/PASSWORD/PORT/DATABASE_NAME/POOL_*`.

---

## 9. Critical points

- The **security middleware** is the only thing protecting the bot. Anything mounted under `CONFIG.apiBasePath` must trust those headers. Health endpoints are deliberately above it.
- **`rawBody` capture in `app.ts`** is required for Slack signature verification — preserve it across body-parser refactors.
- **`REQUEST_BODY_SIZE_LIMIT`** caps the parsed body size for both JSON and URL-encoded requests (default `5mb`). Requests above the limit are dropped at the parser and never reach a handler; bump the env var if production logs show recurring `request body exceeded size limit` entries.
- **`SLACK_CHANNEL_NOTIFICATION_THRESHOLD`** silently drops MR notifications above the limit; tune per project noise.
- **GitLab `Maintainer` role** is required on the token, otherwise releases/tag operations fail.
- **Release race conditions** are guarded by Sequelize transactions + row-level locks; any change to release state must go through `updateRelease`.
- **Plugin loading is one-shot** — `ReleasePluginManager.loadReleaseManagerPlugin` rejects re-loading the same manager.
- **Crash-resilient releases** rely on `Release.state === 'notYetReady'`; renaming this value breaks `waitForNonReadyReleases`.
- **Production migrations**: only files matching `src/core/migrations/*.js` (compiled output) are picked up by umzug — make sure migrations are built before `pnpm migrate`.
