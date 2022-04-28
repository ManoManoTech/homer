export interface GitlabCiVariable {
  key: string;
  value: any;
  variable_type: 'env_var' | 'file';
}
