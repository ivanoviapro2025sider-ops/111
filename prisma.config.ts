import { existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

if (existsSync('.env.local')) {
  loadEnv({ path: '.env.local', override: true });
} else {
  loadEnv();
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
