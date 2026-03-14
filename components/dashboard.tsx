"use client";

import { useEffect, useMemo, useState } from "react";

import { agentToolOptions, type ChatResult, type Settings, type SwarmAgent, type UploadRecord } from "@/lib/types";

type Message = {
  role: "user" | "assistant";
  content: string;
  meta?: ChatResult;
};

type HealthStatus = {
  status: "ok";
  service: string;
  configured: {
    openRouterApiKey: boolean;
  };
  runtime: {
    storage: string;
  };
};

const fallbackSettings: Settings = {
  openRouter: {
    apiKey: "",
    baseUrl: "https://openrouter.ai/api/v1",
    siteUrl: "http://localhost:3000",
    siteName: "KIMI Swarm Studio",
    defaultModel: "moonshotai/kimi-k2",
    temperature: 0.4,
    topP: 0.9,
    maxTokens: 4000
  },
  swarm: {
    name: "KIMI Swarm",
    orchestrationMode: "hybrid",
    plannerModel: "moonshotai/kimi-k2",
    synthesisModel: "moonshotai/kimi-k2",
    maxWorkerIterations: 4,
    fileSamplingBytes: 512 * 1024,
    maxDocumentReadBytes: 12 * 1024 * 1024,
    maxInlineImageBytes: 4 * 1024 * 1024,
    allowImages: true,
    allowBinaryMetadata: true,
    agents: [
      {
        id: "researcher",
        name: "Researcher",
        goal: "Find supporting facts.",
        systemPrompt: "Extract evidence and constraints from the provided context.",
        model: "moonshotai/kimi-k2",
        temperature: 0.2,
        topP: 0.9,
        maxTokens: 2500,
        useFileContext: true,
        enabled: true,
        tools: ["file-search", "summarization"]
      }
    ]
  }
};

function humanSize(bytes: number) {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function createAgent(): SwarmAgent {
  const id = `agent-${crypto.randomUUID().slice(0, 8)}`;

  return {
    id,
    name: "New Agent",
    goal: "Describe the objective for this worker.",
    systemPrompt: "You are a configurable KIMI swarm worker. Produce useful intermediate results.",
    model: "moonshotai/kimi-k2",
    temperature: 0.3,
    topP: 0.9,
    maxTokens: 2500,
    useFileContext: true,
    enabled: true,
    tools: ["summarization"]
  };
}

async function parseJsonResponse<T>(response: Response) {
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }
  return payload;
}

export function Dashboard() {
  const [settings, setSettings] = useState<Settings>(fallbackSettings);
  const [uploads, setUploads] = useState<UploadRecord[]>([]);
  const [selectedUploadIds, setSelectedUploadIds] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [info, setInfo] = useState("Loading settings and uploads...");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [health, setHealth] = useState<HealthStatus | null>(null);

  const selectedUploads = useMemo(
    () => uploads.filter((upload) => selectedUploadIds.includes(upload.id)),
    [selectedUploadIds, uploads]
  );
  const isConfigured = settings.openRouter.apiKey.trim().length > 0;

  useEffect(() => {
    async function bootstrap() {
      try {
        const [settingsResponse, uploadsResponse, healthResponse] = await Promise.all([
          fetch("/api/settings", { cache: "no-store" }),
          fetch("/api/uploads", { cache: "no-store" }),
          fetch("/api/health", { cache: "no-store" })
        ]);

        const nextSettings = await parseJsonResponse<Settings>(settingsResponse);
        const nextUploads = await parseJsonResponse<UploadRecord[]>(uploadsResponse);
        const nextHealth = await parseJsonResponse<HealthStatus>(healthResponse);
        setSettings(nextSettings);
        setUploads(nextUploads);
        setHealth(nextHealth);
        setInfo(
          nextHealth.configured.openRouterApiKey
            ? "Service is online and ready."
            : "Service is online. Add and save your OpenRouter API key to enable chat."
        );
      } catch (error) {
        setInfo(error instanceof Error ? error.message : "Failed to load dashboard state.");
      }
    }

    void bootstrap();
  }, []);

  function updateSettingsSection<
    TSection extends keyof Settings,
    TKey extends keyof Settings[TSection]
  >(section: TSection, key: TKey, value: Settings[TSection][TKey]) {
    setSettings((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [key]: value
      }
    }));
  }

  function updateAgent(index: number, patch: Partial<SwarmAgent>) {
    setSettings((current) => ({
      ...current,
      swarm: {
        ...current.swarm,
        agents: current.swarm.agents.map((agent, agentIndex) =>
          agentIndex === index ? { ...agent, ...patch } : agent
        )
      }
    }));
  }

  function toggleAgentTool(index: number, tool: (typeof agentToolOptions)[number]) {
    const agent = settings.swarm.agents[index];
    const enabled = agent.tools.includes(tool);
    const nextTools = enabled ? agent.tools.filter((item) => item !== tool) : [...agent.tools, tool];
    updateAgent(index, { tools: nextTools });
  }

  async function refreshUploads() {
    const response = await fetch("/api/uploads", { cache: "no-store" });
    const payload = await parseJsonResponse<UploadRecord[]>(response);
    setUploads(payload);
  }

  async function saveSettings() {
    setIsSaving(true);
    setInfo("Saving swarm settings...");

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(settings)
      });
      const payload = await parseJsonResponse<Settings>(response);
      setSettings(payload);
      setHealth((current) =>
        current
          ? {
              ...current,
              configured: {
                ...current.configured,
                openRouterApiKey: payload.openRouter.apiKey.trim().length > 0
              }
            }
          : current
      );
      setInfo(
        payload.openRouter.apiKey.trim()
          ? "Settings saved. Swarm chat is enabled."
          : "Settings saved. Add an OpenRouter API key to enable chat."
      );
    } catch (error) {
      setInfo(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    setIsUploading(true);
    setInfo(`Uploading ${fileList.length} file(s)...`);

    try {
      for (const file of Array.from(fileList)) {
        if (file.size > 10 * 1024 * 1024 * 1024) {
          throw new Error(`${file.name} exceeds the 10 GB limit.`);
        }

        const startResponse = await fetch("/api/uploads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            originalName: file.name,
            size: file.size,
            mimeType: file.type || "application/octet-stream"
          })
        });

        const startPayload = await parseJsonResponse<{ uploadId: string; chunkSize: number }>(startResponse);
        const totalChunks = Math.max(1, Math.ceil(file.size / startPayload.chunkSize));

        for (let partNumber = 0; partNumber < totalChunks; partNumber += 1) {
          const start = partNumber * startPayload.chunkSize;
          const end = Math.min(file.size, start + startPayload.chunkSize);
          const chunk = file.slice(start, end);

          const chunkResponse = await fetch(`/api/uploads/${startPayload.uploadId}/chunk?partNumber=${partNumber}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/octet-stream"
            },
            body: chunk
          });

          await parseJsonResponse(chunkResponse);
          const progress = Math.round(((partNumber + 1) / totalChunks) * 100);
          setUploadProgress((current) => ({
            ...current,
            [file.name]: progress
          }));
        }

        const completeResponse = await fetch(`/api/uploads/${startPayload.uploadId}/complete`, {
          method: "POST"
        });
        await parseJsonResponse(completeResponse);
      }

      await refreshUploads();
      setInfo("Uploads completed.");
    } catch (error) {
      setInfo(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  }

  async function runSwarm() {
    if (!isConfigured) {
      setInfo("Save a valid OpenRouter API key before running the swarm.");
      return;
    }

    if (!prompt.trim()) {
      setInfo("Enter a prompt for the swarm.");
      return;
    }

    const userMessage: Message = {
      role: "user",
      content: prompt
    };

    setMessages((current) => [...current, userMessage]);
    setIsRunning(true);
    setInfo("Running swarm agents through OpenRouter...");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          uploadIds: selectedUploadIds,
          history: messages.map((message) => ({
            role: message.role,
            content: message.content
          }))
        })
      });

      const payload = await parseJsonResponse<ChatResult>(response);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: payload.answer,
          meta: payload
        }
      ]);
      setPrompt("");
      setInfo("Swarm response received.");
    } catch (error) {
      setInfo(error instanceof Error ? error.message : "Failed to run swarm.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-card">
        <div>
          <p className="eyebrow">OpenRouter + KIMI + Swarm</p>
          <h1>KIMI Swarm Studio</h1>
          <p className="hero-copy">
            Control planner and worker agents, upload files up to 10 GB in chunks, and route analysis through OpenRouter from a single dashboard.
          </p>
          <div className="status-grid">
            <div className="status-item">
              <span className={`status-dot ${health ? "ok" : ""}`} />
              <span>{health?.service ?? "Service status pending"}</span>
            </div>
            <div className="status-item">
              <span className={`status-dot ${isConfigured ? "ok" : "warn"}`} />
              <span>{isConfigured ? "OpenRouter configured" : "OpenRouter API key required"}</span>
            </div>
          </div>
        </div>
        <div className="status-pill">{info}</div>
      </section>

      <section className="grid-layout">
        <div className="column">
          {!isConfigured ? (
            <div className="notice warning">
              <strong>Chat is currently disabled.</strong>
              <p>
                The local service is running correctly, but OpenRouter requests are blocked until you paste an API key and click
                {" "}
                <strong>Save settings</strong>.
              </p>
            </div>
          ) : null}

          <div className="card">
            <div className="card-header">
              <div>
                <h2>OpenRouter settings</h2>
                <p>Configure transport, model defaults, and the KIMI entrypoint.</p>
              </div>
              <button className="button primary" onClick={() => void saveSettings()} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save settings"}
              </button>
            </div>

            <div className="form-grid">
              <label>
                API key
                <input
                  type="password"
                  value={settings.openRouter.apiKey}
                  onChange={(event) => updateSettingsSection("openRouter", "apiKey", event.target.value)}
                  placeholder="sk-or-v1-..."
                />
              </label>
              <label>
                Base URL
                <input
                  value={settings.openRouter.baseUrl}
                  onChange={(event) => updateSettingsSection("openRouter", "baseUrl", event.target.value)}
                />
              </label>
              <label>
                Site URL
                <input
                  value={settings.openRouter.siteUrl}
                  onChange={(event) => updateSettingsSection("openRouter", "siteUrl", event.target.value)}
                />
              </label>
              <label>
                Site name
                <input
                  value={settings.openRouter.siteName}
                  onChange={(event) => updateSettingsSection("openRouter", "siteName", event.target.value)}
                />
              </label>
              <label>
                Default model
                <input
                  value={settings.openRouter.defaultModel}
                  onChange={(event) => updateSettingsSection("openRouter", "defaultModel", event.target.value)}
                />
              </label>
              <label>
                Temperature
                <input
                  type="number"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.openRouter.temperature}
                  onChange={(event) => updateSettingsSection("openRouter", "temperature", Number(event.target.value))}
                />
              </label>
              <label>
                Top P
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.openRouter.topP}
                  onChange={(event) => updateSettingsSection("openRouter", "topP", Number(event.target.value))}
                />
              </label>
              <label>
                Max tokens
                <input
                  type="number"
                  min="128"
                  max="64000"
                  step="1"
                  value={settings.openRouter.maxTokens}
                  onChange={(event) => updateSettingsSection("openRouter", "maxTokens", Number(event.target.value))}
                />
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h2>Swarm orchestration</h2>
                <p>Manage planner, synthesis, worker iteration caps, and ingestion limits.</p>
              </div>
            </div>

            <div className="form-grid">
              <label>
                Swarm name
                <input
                  value={settings.swarm.name}
                  onChange={(event) => updateSettingsSection("swarm", "name", event.target.value)}
                />
              </label>
              <label>
                Mode
                <select
                  value={settings.swarm.orchestrationMode}
                  onChange={(event) =>
                    updateSettingsSection(
                      "swarm",
                      "orchestrationMode",
                      event.target.value as Settings["swarm"]["orchestrationMode"]
                    )
                  }
                >
                  <option value="sequential">Sequential</option>
                  <option value="parallel">Parallel</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </label>
              <label>
                Planner model
                <input
                  value={settings.swarm.plannerModel}
                  onChange={(event) => updateSettingsSection("swarm", "plannerModel", event.target.value)}
                />
              </label>
              <label>
                Synthesis model
                <input
                  value={settings.swarm.synthesisModel}
                  onChange={(event) => updateSettingsSection("swarm", "synthesisModel", event.target.value)}
                />
              </label>
              <label>
                Max worker iterations
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={settings.swarm.maxWorkerIterations}
                  onChange={(event) => updateSettingsSection("swarm", "maxWorkerIterations", Number(event.target.value))}
                />
              </label>
              <label>
                Sample bytes per text file
                <input
                  type="number"
                  min="65536"
                  step="65536"
                  value={settings.swarm.fileSamplingBytes}
                  onChange={(event) => updateSettingsSection("swarm", "fileSamplingBytes", Number(event.target.value))}
                />
              </label>
              <label>
                Max document parse size
                <input
                  type="number"
                  min={1024 * 1024}
                  step={1024 * 1024}
                  value={settings.swarm.maxDocumentReadBytes}
                  onChange={(event) =>
                    updateSettingsSection("swarm", "maxDocumentReadBytes", Number(event.target.value))
                  }
                />
              </label>
              <label>
                Max inline image size
                <input
                  type="number"
                  min={256 * 1024}
                  step={256 * 1024}
                  value={settings.swarm.maxInlineImageBytes}
                  onChange={(event) =>
                    updateSettingsSection("swarm", "maxInlineImageBytes", Number(event.target.value))
                  }
                />
              </label>
            </div>

            <div className="toggle-row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.swarm.allowImages}
                  onChange={(event) => updateSettingsSection("swarm", "allowImages", event.target.checked)}
                />
                Allow inline image reasoning
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={settings.swarm.allowBinaryMetadata}
                  onChange={(event) => updateSettingsSection("swarm", "allowBinaryMetadata", event.target.checked)}
                />
                Include binary/audio/video metadata
              </label>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h2>Worker agents</h2>
                <p>Edit every swarm worker parameter, prompts, and tool flags.</p>
              </div>
              <button
                className="button secondary"
                onClick={() =>
                  setSettings((current) => ({
                    ...current,
                    swarm: {
                      ...current.swarm,
                      agents: [...current.swarm.agents, createAgent()]
                    }
                  }))
                }
              >
                Add agent
              </button>
            </div>

            <div className="stack">
              {settings.swarm.agents.map((agent, index) => (
                <article className="agent-card" key={agent.id}>
                  <div className="agent-header">
                    <div>
                      <h3>{agent.name}</h3>
                      <p>{agent.id}</p>
                    </div>
                    <div className="agent-actions">
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={agent.enabled}
                          onChange={(event) => updateAgent(index, { enabled: event.target.checked })}
                        />
                        Enabled
                      </label>
                      <button
                        className="button danger"
                        onClick={() =>
                          setSettings((current) => ({
                            ...current,
                            swarm: {
                              ...current.swarm,
                              agents: current.swarm.agents.filter((_, agentIndex) => agentIndex !== index)
                            }
                          }))
                        }
                        disabled={settings.swarm.agents.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div className="form-grid">
                    <label>
                      Agent ID
                      <input value={agent.id} onChange={(event) => updateAgent(index, { id: event.target.value })} />
                    </label>
                    <label>
                      Name
                      <input value={agent.name} onChange={(event) => updateAgent(index, { name: event.target.value })} />
                    </label>
                    <label>
                      Model
                      <input value={agent.model} onChange={(event) => updateAgent(index, { model: event.target.value })} />
                    </label>
                    <label>
                      Goal
                      <input value={agent.goal} onChange={(event) => updateAgent(index, { goal: event.target.value })} />
                    </label>
                    <label>
                      Temperature
                      <input
                        type="number"
                        min="0"
                        max="2"
                        step="0.1"
                        value={agent.temperature}
                        onChange={(event) => updateAgent(index, { temperature: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      Top P
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={agent.topP}
                        onChange={(event) => updateAgent(index, { topP: Number(event.target.value) })}
                      />
                    </label>
                    <label>
                      Max tokens
                      <input
                        type="number"
                        min="128"
                        max="64000"
                        step="1"
                        value={agent.maxTokens}
                        onChange={(event) => updateAgent(index, { maxTokens: Number(event.target.value) })}
                      />
                    </label>
                    <label className="checkbox inline">
                      <input
                        type="checkbox"
                        checked={agent.useFileContext}
                        onChange={(event) => updateAgent(index, { useFileContext: event.target.checked })}
                      />
                      Use uploaded file context
                    </label>
                  </div>

                  <label>
                    System prompt
                    <textarea
                      rows={5}
                      value={agent.systemPrompt}
                      onChange={(event) => updateAgent(index, { systemPrompt: event.target.value })}
                    />
                  </label>

                  <div className="tool-grid">
                    {agentToolOptions.map((tool) => (
                      <label className="checkbox" key={tool}>
                        <input
                          type="checkbox"
                          checked={agent.tools.includes(tool)}
                          onChange={() => toggleAgentTool(index, tool)}
                        />
                        {tool}
                      </label>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="column">
          <div className="card">
            <div className="card-header">
              <div>
                <h2>Large file ingestion</h2>
                <p>Chunked uploads support files up to 10 GB without loading them fully into server memory.</p>
              </div>
              <label className="button primary file-input-button">
                {isUploading ? "Uploading..." : "Select files"}
                <input
                  type="file"
                  multiple
                  onChange={(event) => void uploadFiles(event.target.files)}
                  disabled={isUploading}
                />
              </label>
            </div>

            <div className="hint-list">
              <p>Supported ingestion modes: text, markdown, JSON, CSV, PDF, DOCX, XLSX, images, and generic binary metadata.</p>
              <p>Each file is created as an upload session, streamed in 8 MB chunks, then merged server-side.</p>
            </div>

            {Object.keys(uploadProgress).length > 0 ? (
              <div className="stack compact">
                {Object.entries(uploadProgress).map(([fileName, progress]) => (
                  <div key={fileName}>
                    <div className="progress-label">
                      <span>{fileName}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="progress-bar">
                      <span style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="upload-list">
              {uploads.map((upload) => (
                <label className="upload-row" key={upload.id}>
                  <input
                    type="checkbox"
                    checked={selectedUploadIds.includes(upload.id)}
                    onChange={(event) =>
                      setSelectedUploadIds((current) =>
                        event.target.checked
                          ? [...current, upload.id]
                          : current.filter((uploadId) => uploadId !== upload.id)
                      )
                    }
                    disabled={upload.status !== "ready"}
                  />
                  <div>
                    <strong>{upload.originalName}</strong>
                    <p>
                      {upload.mode} • {humanSize(upload.size)} • {upload.status}
                    </p>
                  </div>
                </label>
              ))}
              {uploads.length === 0 ? <p className="empty-state">No files uploaded yet.</p> : null}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h2>Swarm chat</h2>
                <p>Send tasks to the configured KIMI swarm and optionally bind the selected uploads as context.</p>
              </div>
              <button className="button primary" onClick={() => void runSwarm()} disabled={isRunning || !isConfigured}>
                {!isConfigured ? "Configure OpenRouter" : isRunning ? "Running..." : "Run swarm"}
              </button>
            </div>

            {!isConfigured ? (
              <div className="notice subtle">
                <strong>Action required:</strong> save an OpenRouter API key above, then return here to run the swarm.
              </div>
            ) : null}

            <label>
              Prompt
              <textarea
                rows={6}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ask the swarm to analyze the selected files, create an action plan, summarize, compare, or prepare an answer."
              />
            </label>

            <div className="selection-summary">
              <strong>Attached uploads:</strong>{" "}
              {selectedUploads.length > 0
                ? selectedUploads.map((upload) => upload.originalName).join(", ")
                : "No uploads selected."}
            </div>

            <div className="chat-log">
              {messages.map((message, index) => (
                <article className={`message ${message.role}`} key={`${message.role}-${index}`}>
                  <div className="message-role">{message.role === "user" ? "User" : "Swarm"}</div>
                  <div className="message-content">{message.content}</div>

                  {message.meta ? (
                    <details className="details-block">
                      <summary>Execution trace</summary>
                      <div className="details-content">
                        <h4>Planner output</h4>
                        <pre>{message.meta.plan}</pre>

                        <h4>Worker outputs</h4>
                        {message.meta.workerOutputs.length > 0 ? (
                          message.meta.workerOutputs.map((worker) => (
                            <div className="worker-output" key={worker.agentId}>
                              <strong>{worker.agentName}</strong>
                              <pre>{worker.output}</pre>
                            </div>
                          ))
                        ) : (
                          <p>No worker agents were enabled for this run.</p>
                        )}

                        <h4>File artifacts used</h4>
                        {message.meta.files.length > 0 ? (
                          message.meta.files.map((artifact) => (
                            <div className="worker-output" key={artifact.title}>
                              <strong>{artifact.title}</strong>
                              <pre>{artifact.content}</pre>
                            </div>
                          ))
                        ) : (
                          <p>No file artifacts were attached.</p>
                        )}
                      </div>
                    </details>
                  ) : null}
                </article>
              ))}
              {messages.length === 0 ? <p className="empty-state">No conversation yet.</p> : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
