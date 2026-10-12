export class RuntimeConfigError extends Error {}
export function validateRuntimeConfig(env: NodeJS.ProcessEnv) {
  const secret = env.JWT_SECRET ?? '';
  if (secret.length < 32 || /replace-|YOUR_|changeme|placeholder/i.test(secret))
    throw new RuntimeConfigError('Set JWT_SECRET to an external random secret of at least 32 characters.');
  const production = env.NODE_ENV === 'production';
  if (production && new Set(secret).size < 12)
    throw new RuntimeConfigError('JWT_SECRET must not be a repeated or low-diversity placeholder.');
  const origin = (env.FRONTEND_URL ?? (production ? '' : 'http://localhost:3000')).trim();
  let parsed: URL;
  try { parsed = new URL(origin); } catch { throw new RuntimeConfigError('Set FRONTEND_URL to a valid frontend origin.'); }
  if (!['', '/'].includes(parsed.pathname) || parsed.search || parsed.hash || parsed.username || parsed.password ||
      (production ? parsed.protocol !== 'https:' : !['http:', 'https:'].includes(parsed.protocol)))
    throw new RuntimeConfigError('FRONTEND_URL must contain only the frontend origin; HTTPS is required in production.');
  if (production) {
    let database: URL;
    try { database = new URL(env.DATABASE_URL ?? ''); } catch { throw new RuntimeConfigError('Set DATABASE_URL to the production MySQL connection.'); }
    if (database.protocol !== 'mysql:' || !database.username || !database.password || !database.pathname || database.pathname === '/' || /_test$/.test(database.pathname))
      throw new RuntimeConfigError('DATABASE_URL must identify a credentialed non-test MySQL database in production.');
    if (env.VERCEL === '1' && ['mysql', 'localhost', '127.0.0.1', '[::1]'].includes(database.hostname))
      throw new RuntimeConfigError('Vercel requires a hosted MySQL DATABASE_URL; local Docker and localhost addresses are not reachable.');
  }
  return { origin: parsed.origin };
}
