export type DeploymentState =
  | 'deploying'
  | 'failed'
  | 'monitoring'
  | 'completed';

export type ReleaseEnvironment =
  | 'integration'
  | 'staging'
  | 'production'
  | 'support';

export interface ReleaseStateUpdate {
  environment: ReleaseEnvironment;
  deploymentState: DeploymentState;
  projectDisplayName?: string;
}
