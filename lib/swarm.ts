import { buildFileContext } from "@/lib/file-processing";
import { createCompletion, type OpenRouterMessage } from "@/lib/openrouter";
import { getSettings } from "@/lib/storage";
import { getUploadsByIds } from "@/lib/uploads";
import type { ChatRequest, ChatResult, Settings, SwarmAgent } from "@/lib/types";

function formatHistory(history: ChatRequest["history"]) {
  if (history.length === 0) {
    return "No previous conversation.";
  }

  return history
    .slice(-6)
    .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
    .join("\n\n");
}

function formatArtifacts(settings: Settings, result: Awaited<ReturnType<typeof buildFileContext>>) {
  if (result.artifacts.length === 0) {
    return "No uploaded file context was attached.";
  }

  return result.artifacts
    .map((artifact, index) => {
      const lines = [`[Attachment ${index + 1}] ${artifact.title}`, artifact.content];

      if (result.inlineImages.length > 0 && settings.swarm.allowImages) {
        lines.push("Inline images were attached for multimodal reasoning where applicable.");
      }

      return lines.join("\n");
    })
    .join("\n\n---\n\n");
}

function planMessages(
  settings: Settings,
  request: ChatRequest,
  fileContextText: string,
  inlineImages: Awaited<ReturnType<typeof buildFileContext>>["inlineImages"]
): OpenRouterMessage[] {
  const userText = [
    `Swarm name: ${settings.swarm.name}`,
    `Orchestration mode: ${settings.swarm.orchestrationMode}`,
    "",
    "Conversation history:",
    formatHistory(request.history),
    "",
    "User task:",
    request.prompt,
    "",
    "Uploaded context:",
    fileContextText,
    "",
    "Return a concise execution plan with task allocation across the enabled agents."
  ].join("\n");

  return [
    {
      role: "system",
      content:
        "You are the planner for a KIMI swarm running through OpenRouter. Produce a practical plan, decide what each agent should focus on, and identify any missing information."
    },
    {
      role: "user",
      content: [{ type: "text", text: userText }, ...inlineImages]
    }
  ];
}

function workerMessages(agent: SwarmAgent, request: ChatRequest, plan: string, fileContextText: string): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content: [
        agent.systemPrompt,
        "",
        `Agent name: ${agent.name}`,
        `Goal: ${agent.goal}`,
        `Tools: ${agent.tools.join(", ") || "none"}`
      ].join("\n")
    },
    {
      role: "user",
      content: [
        "Planner output:",
        plan,
        "",
        "Conversation history:",
        formatHistory(request.history),
        "",
        "User request:",
        request.prompt,
        "",
        agent.useFileContext ? `Relevant files:\n${fileContextText}` : "This agent was configured without file context."
      ].join("\n")
    }
  ];
}

async function runWorker(agent: SwarmAgent, request: ChatRequest, plan: string, fileContextText: string, settings: Settings) {
  const output = await createCompletion(workerMessages(agent, request, plan, fileContextText), settings, {
    model: agent.model,
    temperature: agent.temperature,
    top_p: agent.topP,
    max_tokens: agent.maxTokens
  });

  return {
    agentId: agent.id,
    agentName: agent.name,
    output
  };
}

async function runWorkers(
  request: ChatRequest,
  plan: string,
  fileContextText: string,
  settings: Settings,
  agents: SwarmAgent[]
) {
  if (settings.swarm.orchestrationMode === "sequential") {
    const outputs: ChatResult["workerOutputs"] = [];
    for (const agent of agents) {
      outputs.push(await runWorker(agent, request, plan, fileContextText, settings));
    }
    return outputs;
  }

  if (settings.swarm.orchestrationMode === "parallel") {
    return Promise.all(agents.map((agent) => runWorker(agent, request, plan, fileContextText, settings)));
  }

  const critiqueAgents = agents.filter((agent) => agent.tools.includes("verification"));
  const primaryAgents = agents.filter((agent) => !agent.tools.includes("verification"));
  const primaryOutputs = await Promise.all(primaryAgents.map((agent) => runWorker(agent, request, plan, fileContextText, settings)));

  const critiqueOutputs: ChatResult["workerOutputs"] = [];

  for (const agent of critiqueAgents) {
    const critiquePrompt = [
      fileContextText,
      "",
      "Peer agent outputs:",
      primaryOutputs.map((output) => `### ${output.agentName}\n${output.output}`).join("\n\n")
    ].join("\n");

    critiqueOutputs.push(
      await runWorker(
        agent,
        request,
        `${plan}\n\nCritique the following peer outputs before synthesis:\n${critiquePrompt}`,
        fileContextText,
        settings
      )
    );
  }

  return [...primaryOutputs, ...critiqueOutputs];
}

function synthesisMessages(
  request: ChatRequest,
  plan: string,
  fileContextText: string,
  workerOutputs: ChatResult["workerOutputs"]
): OpenRouterMessage[] {
  return [
    {
      role: "system",
      content:
        "You are the final synthesizer for a KIMI swarm. Produce a direct, high-signal final answer. Cite which uploaded files influenced the answer when relevant, and mention limitations when context is partial or sampled."
    },
    {
      role: "user",
      content: [
        "Original request:",
        request.prompt,
        "",
        "Planner output:",
        plan,
        "",
        "Conversation history:",
        formatHistory(request.history),
        "",
        "Uploaded file digest:",
        fileContextText,
        "",
        "Worker outputs:",
        workerOutputs.map((output) => `## ${output.agentName}\n${output.output}`).join("\n\n")
      ].join("\n")
    }
  ];
}

export async function runSwarm(request: ChatRequest): Promise<ChatResult> {
  const settings = await getSettings();

  if (!settings.openRouter.apiKey.trim()) {
    throw new Error("OpenRouter API key is empty. Save it in the settings panel before running the swarm.");
  }

  const uploads = await getUploadsByIds(request.uploadIds);
  const fileContext = await buildFileContext(uploads, settings);
  const fileContextText = formatArtifacts(settings, fileContext);
  const plan = await createCompletion(
    planMessages(settings, request, fileContextText, fileContext.inlineImages),
    settings,
    {
      model: settings.swarm.plannerModel,
      temperature: 0.2,
      max_tokens: Math.min(settings.openRouter.maxTokens, 2500)
    }
  );

  const enabledAgents = settings.swarm.agents.filter((agent) => agent.enabled).slice(0, settings.swarm.maxWorkerIterations);

  const workerOutputs =
    enabledAgents.length === 0
      ? []
      : await runWorkers(request, plan, fileContextText, settings, enabledAgents);

  const answer = await createCompletion(synthesisMessages(request, plan, fileContextText, workerOutputs), settings, {
    model: settings.swarm.synthesisModel,
    temperature: settings.openRouter.temperature,
    top_p: settings.openRouter.topP,
    max_tokens: settings.openRouter.maxTokens
  });

  return {
    answer,
    plan,
    workerOutputs,
    files: fileContext.artifacts
  };
}
