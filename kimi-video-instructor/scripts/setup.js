#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== KIMI Video Instructor Setup ===\n');

// Check ffmpeg
console.log('Checking ffmpeg...');
try {
  const version = execSync('ffmpeg -version', { encoding: 'utf-8' }).split('\n')[0];
  console.log(`  OK: ${version}`);
} catch {
  console.error('  ERROR: ffmpeg not found! Please install ffmpeg.');
  console.error('  Ubuntu: sudo apt install ffmpeg');
  console.error('  macOS: brew install ffmpeg');
  process.exit(1);
}

// Check ffprobe
console.log('Checking ffprobe...');
try {
  execSync('ffprobe -version', { encoding: 'utf-8' });
  console.log('  OK');
} catch {
  console.error('  ERROR: ffprobe not found!');
  process.exit(1);
}

// Create workspace directories
console.log('\nCreating workspace directories...');
const dirs = [
  'workspace',
  'workspace/tmp',
];

for (const dir of dirs) {
  const fullPath = path.join(process.cwd(), dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`  Created: ${dir}`);
  } else {
    console.log(`  Exists: ${dir}`);
  }
}

// Check .env.local
console.log('\nChecking .env.local...');
const envPath = path.join(process.cwd(), '.env.local');
if (!fs.existsSync(envPath)) {
  console.log('  Creating .env.local from template...');
  const template = `# OpenRouter
OPENROUTER_API_KEY=sk-or-xxxxxxxxx
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_DEFAULT_MODEL=moonshotai/kimi-k2

# Whisper
WHISPER_PROVIDER=openrouter
OPENAI_API_KEY=sk-xxxxxxxxx

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
WORKSPACE_DIR=./workspace
MAX_VIDEO_SIZE=10737418240
MAX_FRAMES_PER_VIDEO=500
FRAME_QUALITY=85

# FFmpeg
FFMPEG_PATH=/usr/bin/ffmpeg
FFPROBE_PATH=/usr/bin/ffprobe

# Database
DATABASE_URL="file:./prisma/dev.db"
`;
  fs.writeFileSync(envPath, template);
  console.log('  Created .env.local - please update with your API keys!');
} else {
  console.log('  OK');
}

// Initialize database
console.log('\nInitializing database...');
try {
  execSync('npx prisma generate', { stdio: 'inherit' });
  execSync('npx prisma db push', { stdio: 'inherit' });
  console.log('  Database initialized.');
} catch (err) {
  console.error('  Database initialization failed:', err.message);
}

console.log('\n=== Setup Complete ===');
console.log('\nNext steps:');
console.log('1. Edit .env.local with your OpenRouter API key');
console.log('2. Run: npm run dev');
console.log('3. Open: http://localhost:3000');
