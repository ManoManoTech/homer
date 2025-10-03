export function getEnvVariable(name: string, defaultValue?: string): string {
  const variable = process.env[name];

  if (variable === undefined && defaultValue === undefined) {
    throw new Error(`Environment variable ${name} not found`);
  }
  return variable || defaultValue!;
}
