export function checkEnv(env: NodeJS.ProcessEnv = process.env): void {
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    process.stderr.write(
      "FATAL: JWT_SECRET must be set and at least 32 characters\n",
    );
    process.exit(1);
  }
}
