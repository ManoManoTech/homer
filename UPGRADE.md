# Upgrade to 2.x.x

## Database

This version adds a new field to the `Releases` table.

By default, the column will be added automatically by the application. However, if the application's database user lacks the necessary permissions, you will need to execute this SQL script manually:

```postgresql
ALTER TABLE "Releases"  ADD COLUMN ts varchar(255) NULL;
```

## Breaking Change: `DataRelease` Field Structure Update

This is an important notice for all Release Managers.

The data structure for the `successfulDeployments`, `failedDeployments`, and `startedDeployments` fields within the `DataRelease` object has been changed.

**Action Required:** If your code accesses these fields, you must update it to support the new structure.

### Change Details

- **Previous Type**: `string[]`
- **New Type**: `ReleaseDeploymentInfo[]`

The `ReleaseDeploymentInfo` type is an object with the following structure:

```typescript
interface ReleaseDeploymentInfo {
  environment: string;
  date?: string;
}
```

For example, code that previously accessed an environment name directly from the array (e.g., `deployments[0]`) must now access the `environment` property of the object (e.g., `deployments[0].environment`).

# Upgrade to 1.x.x

## BC BREAK: removed default monitoring state exposure

Information exposed under `/api/monitoring/state` are not anymore available. It was unnecessary, [leaking possible private information](https://github.com/ManoManoTech/homer/issues/89) and requiring some dependencies.

## BC BREAK: update to Node v24

Docker Image and projects are now using `node` v24. Please update your related pipelines/actions/based images.
