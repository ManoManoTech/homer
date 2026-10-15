# Plugin System for User Identity Resolvers

## Introduction

Homer shows who did what on a merge request (author, assignees, reviewers, approvers, comment authors) as Slack users. To do that it has to find the Slack user behind each Gitlab user.

By default, the built-in `emailDomainConvention` resolver tries `<gitlab username>@<domain>` for each domain of `EMAIL_DOMAINS`. This only works when your Gitlab usernames match the local part of your company emails. When they don't, you can write your own resolver, for instance one that queries your company directory or reads a mapping file, and load it as a plugin.

A resolver only says **who the person is** (their emails, or their Slack user id if you already know it). Homer then finds that person on Slack itself, so a resolver doesn't need Slack credentials or the Slack API.

## Writing a resolver

Create a JavaScript file in a `plugins/identity` directory, for instance `plugins/identity/companyDirectory.js`. It must export an object with a `resolve` function, either with `module.exports = { resolve }` as below, or as the `export default` of a TypeScript file compiled to CommonJS (the types are not published as a package yet, but you can find the interface [here](./src/core/typings/UserIdentity.ts)).

`resolve` receives the Gitlab user and returns, or resolves to, one of:

- `{ emails: ['first.choice@my-domain.com', 'second.choice@my-domain.com'] }`: Homer tries each email in order.
- `{ chatUserId: 'U0XXXXXXXXX' }`: Homer uses this Slack user id directly.
- `undefined` or `null`: this resolver doesn't know the user, and Homer moves on to the next resolver.

Anything else (for instance `emails` that isn't an array of strings) is treated as a failure, see below.

```js
// plugins/identity/companyDirectory.js
const emailsByGitlabUsername = {
  jdoe: 'jane.doe@my-domain.com',
};

module.exports = {
  async resolve({ provider, username }) {
    // `provider` is always 'gitlab' for now.
    const email = emailsByGitlabUsername[username];
    return email === undefined ? undefined : { emails: [email] };
  },
};
```

## Configuring the resolvers

List the resolvers to use, in order, in the `USER_IDENTITY_RESOLVERS` environment variable. Each entry is either `emailDomainConvention` or the file name of a plugin in `plugins/identity/` (without the extension):

```
USER_IDENTITY_RESOLVERS=companyDirectory,emailDomainConvention
```

For each Gitlab user, Homer asks the resolvers one after the other and stops at the first answer that matches a Slack user. With the configuration above, users missing from `companyDirectory`, or whose email isn't a Slack user, still get the default behaviour.

Homer only moves on to the next resolver when the current one has a clear answer that doesn't lead to a Slack user. When something fails, it stops and leaves the person out rather than falling back to a later, possibly less reliable resolver: if `companyDirectory` is down, guessing `jdoe@my-domain.com` could name somebody else.

| Situation                                                                                            | What Homer does                                                                   |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| The resolver returns `undefined` or `null`                                                           | Asks the next resolver                                                            |
| None of the returned emails is a Slack user                                                          | Asks the next resolver                                                            |
| The returned Slack user id doesn't exist (`user_not_found`)                                          | Logs a warning (the resolver's data is probably stale) and asks the next resolver |
| The resolver throws an error                                                                         | Logs the error with the resolver name and leaves the person out                   |
| The resolver returns something that isn't a valid answer                                             | Logs the error with the resolver name and the answer, and leaves the person out   |
| Slack fails to look up the returned emails or id (rate limit, outage…)                               | Logs a warning and leaves the person out                                          |
| No resolver finds a Slack user                                                                       | Leaves the person out, as Homer always did when a user isn't found                |
| A listed resolver can't be loaded (unknown name, or a file that doesn't export a `resolve` function) | Doesn't start, and the error names the resolver                                   |

Leaving a person out has the same effect as when Homer can't find them on Slack: author, assignees, reviewers and approvers are simply missing from the message, and for an approve, close, merge or similar event, Homer doesn't post the "has approved this merge request" style reply or update the message when it can't tell who acted.

When the variable is not set, only `emailDomainConvention` is used, which is Homer's historical behaviour.

## Deploying

As for [release manager plugins](./PLUGIN_RELEASE.md), build a Docker image based on Homer's where your `plugins` directory is copied to `dist/plugins`. See the [deploy example](./examples/deploy/Dockerfile).

Resolvers run on every merge request event, several times per message (one call per person shown). If yours calls a remote service, keep it fast and consider caching its answers.

Please only **add your own resolvers or resolvers from trusted sources**: they run inside Homer with access to its configuration.
