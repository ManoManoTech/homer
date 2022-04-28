export interface GitlabProject {
  avatar_url: string | null;
  created_at: string;
  default_branch: string;
  description: string | null;
  forks_count: number;
  http_url_to_repo: string;
  id: number;
  last_activity_at: string;
  name: string;
  name_with_namespace: string;
  path: string;
  path_with_namespace: string;
  readme_url: string;
  ssh_url_to_repo: string;
  star_count: number;
  tag_list: string[];
  web_url: string;
}

export interface GitlabProjectDetails extends GitlabProject {
  allow_merge_on_skipped_pipeline: boolean;
  archived: boolean;
  auto_devops_deploy_strategy: string;
  auto_devops_enabled: boolean;
  autoclose_referenced_issues: boolean;
  approvals_before_merge: number;
  can_create_merge_request_in: boolean;
  ci_default_git_depth: number;
  ci_forward_deployment_enabled: boolean;
  compliance_frameworks: string[];
  container_expiration_policy: {
    cadence: string;
    enabled: boolean;
    keep_n: string | null;
    older_than: string | null;
    name_regex: string | null;
    name_regex_delete: string | null;
    name_regex_keep: string | null;
    next_run_at: string;
  };
  container_registry_enabled: boolean;
  creator_id: number;
  external_authorization_classification_label: string | null;
  import_error: string | null;
  import_status: string;
  issues_enabled: boolean;
  license_url: string;
  license: {
    key: string;
    name: string;
    nickname: string;
    html_url: string;
    source_url: string;
  };
  jobs_enabled: boolean;
  marked_for_deletion_at: string;
  marked_for_deletion_on: string;
  merge_method: string;
  mirror: boolean;
  mirror_overwrites_diverged_branches: boolean;
  mirror_trigger_builds: boolean;
  mirror_user_id: number;
  merge_requests_enabled: boolean;
  namespace: {
    id: number;
    name: string;
    path: string;
    kind: string;
    full_path: string;
    avatar_url: string;
    web_url: string;
  };
  only_allow_merge_if_all_discussions_are_resolved: boolean;
  only_allow_merge_if_pipeline_succeeds: boolean;
  open_issues_count: 1;
  only_mirror_protected_branches: boolean;
  owner: {
    id: number;
    name: string;
    created_at: string;
  };
  packages_enabled: boolean;
  permissions: {
    project_access: {
      access_level: 10;
      notification_level: number;
    };
    group_access: {
      access_level: 50;
      notification_level: number;
    };
  };
  printing_merge_requests_link_enabled: boolean;
  public_jobs: boolean;
  remove_source_branch_after_merge: boolean;
  repository_storage: string;
  request_access_enabled: boolean;
  resolve_outdated_diff_discussions: boolean;
  runners_token: string;
  service_desk_address: string | null;
  service_desk_enabled: boolean;
  shared_runners_enabled: boolean;
  shared_with_groups: {
    group_id: number;
    group_name: string;
    group_full_path: string;
    group_access_level: number;
  }[];
  statistics: {
    commit_count: number;
    storage_size: number;
    repository_size: number;
    wiki_size: number;
    lfs_objects_size: number;
    job_artifacts_size: number;
    packages_size: number;
    snippets_size: number;
  };
  snippets_enabled: boolean;
  suggestion_commit_message: string | null;
  visibility: string;
  wiki_enabled: boolean;
}
