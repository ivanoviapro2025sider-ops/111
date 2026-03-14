const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('[seed] Creating demo agents...');

  const triage = await prisma.agent.upsert({
    where: { name: 'Triage Agent' },
    update: {},
    create: {
      name: 'Triage Agent',
      description: 'Main triage agent that analyzes user requests and routes to specialist agents',
      model: 'moonshotai/kimi-k2',
      instructions: `You are a helpful triage agent named "Triage". Your job is to understand the user's request and either answer directly or route to the appropriate specialist agent.

Available specialists:
- Analyst: for data analysis, code review, and technical questions
- Writer: for content generation, creative writing, and text formatting

User name: {user_name}

If the request is straightforward, answer it yourself. If it requires specialized expertise, use the transfer function to hand off to the right agent.`,
      isActive: true,
      avatar: 'bot',
      color: '#6366f1',
      temperature: 0.7,
      topP: 0.9,
      maxTokens: 4096,
      stream: true,
      executeTools: true,
      toolChoice: 'auto',
      contextVariables: JSON.stringify({ user_name: 'User' }),
    },
  });

  const analyst = await prisma.agent.upsert({
    where: { name: 'Analyst' },
    update: {},
    create: {
      name: 'Analyst',
      description: 'Data analysis, code review, and technical problem-solving specialist',
      model: 'moonshotai/kimi-k2',
      instructions: `You are a data analysis and technical specialist named "Analyst". You excel at:
- Analyzing data and creating insights
- Reviewing and explaining code
- Solving technical problems step by step
- Working with files and extracting information

Be precise, use code blocks when relevant, and provide structured analysis.`,
      isActive: true,
      avatar: 'bot',
      color: '#10b981',
      temperature: 0.3,
      topP: 0.95,
      maxTokens: 8192,
      stream: true,
      executeTools: true,
      toolChoice: 'auto',
    },
  });

  const writer = await prisma.agent.upsert({
    where: { name: 'Writer' },
    update: {},
    create: {
      name: 'Writer',
      description: 'Content generation, creative writing, and text formatting specialist',
      model: 'moonshotai/kimi-k2',
      instructions: `You are a creative writing specialist named "Writer". You excel at:
- Generating engaging content
- Creative writing and storytelling
- Rewriting and improving text
- Formatting documents and reports

Be creative, expressive, and adapt your tone to the user's needs.`,
      isActive: true,
      avatar: 'bot',
      color: '#f59e0b',
      temperature: 1.0,
      topP: 0.95,
      maxTokens: 4096,
      stream: true,
      executeTools: true,
      toolChoice: 'auto',
    },
  });

  // Set up handoffs: Triage → Analyst, Triage → Writer, Analyst → Triage, Writer → Triage
  await prisma.agent.update({
    where: { id: triage.id },
    data: { handoffTargets: JSON.stringify([analyst.id, writer.id]) },
  });
  await prisma.agent.update({
    where: { id: analyst.id },
    data: { handoffTargets: JSON.stringify([triage.id, writer.id]) },
  });
  await prisma.agent.update({
    where: { id: writer.id },
    data: { handoffTargets: JSON.stringify([triage.id, analyst.id]) },
  });

  console.log(`[seed] Created agents:`);
  console.log(`  - ${triage.name} (${triage.color})`);
  console.log(`  - ${analyst.name} (${analyst.color})`);
  console.log(`  - ${writer.name} (${writer.color})`);

  // Default settings
  const defaults = {
    theme: 'dark',
    language: 'en',
    defaultModel: 'moonshotai/kimi-k2',
    defaultMaxTurns: '10',
    defaultChunkSize: '4000',
    maxFileSize: '10737418240',
  };

  for (const [key, value] of Object.entries(defaults)) {
    await prisma.settings.upsert({
      where: { key },
      create: { id: key, key, value },
      update: { value },
    });
  }

  console.log('[seed] Default settings applied.');
  console.log('[seed] Done!');
}

main()
  .catch((e) => {
    console.error('[seed] Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
