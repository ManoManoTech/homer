export function getEnvVariable(name: string): string {
  const variable = process.env[name];

  if (variable === undefined) {
    throw new Error(`Environment variable ${name} not found`);
  }
  return variable;
}
