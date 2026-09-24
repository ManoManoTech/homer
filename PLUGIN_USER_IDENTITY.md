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
- `undefined`: this resolver doesn't know the user, and Homer moves on to the next resolver.

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

- If no resolver finds a Slack user, Homer behaves as it does today when a user isn't found: the person is left out of the message.
- If a resolver throws an error (for instance your directory service is down), Homer logs the error with the resolver name and moves on to the next resolver. The notification is still sent.
- If a Slack user id returned by a resolver doesn't exist on Slack, Homer logs a warning and moves on to the next resolver.
- If a listed resolver can't be loaded (unknown name, or a file that doesn't export a `resolve` function), Homer doesn't start, and the error names the resolver.

When the variable is not set, only `emailDomainConvention` is used, which is Homer's historical behaviour.

## Deploying

As for [release manager plugins](./PLUGIN_RELEASE.md), build a Docker image based on Homer's where your `plugins` directory is copied to `dist/plugins`. See the [deploy example](./examples/deploy/Dockerfile).

Resolvers run on every merge request event, several times per message (one call per person shown). If yours calls a remote service, keep it fast and consider caching its answers.

Please only **add your own resolvers or resolvers from trusted sources**: they run inside Homer with access to its configuration.
