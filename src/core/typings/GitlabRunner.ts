export interface GitlabRunner {
  active: boolean;
  description: string;
  id: number;
  is_shared: boolean;
  runner_type: string;
  tags: string[];
}
