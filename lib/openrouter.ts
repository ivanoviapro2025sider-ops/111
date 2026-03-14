import type { Settings } from "@/lib/types";

type MessageContentPart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image_url";
      image_url: {
        url: string;
      };
    };

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string | MessageContentPart[];
}

interface CompletionOverrides {
  model?: string;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
}

function normalizeAssistantContent(content: unknown) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (typeof part === "object" && part !== null && "text" in part && typeof part.text === "string") {
          return part.text;
        }

        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
}

export async function createCompletion(
  messages: OpenRouterMessage[],
  settings: Settings,
  overrides: CompletionOverrides = {}
) {
  const url = `${settings.openRouter.baseUrl.replace(/\/$/, "")}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${settings.openRouter.apiKey}`,
      "HTTP-Referer": settings.openRouter.siteUrl,
      "X-Title": settings.openRouter.siteName
    },
    body: JSON.stringify({
      model: overrides.model ?? settings.openRouter.defaultModel,
      messages,
      temperature: overrides.temperature ?? settings.openRouter.temperature,
      top_p: overrides.top_p ?? settings.openRouter.topP,
      max_tokens: overrides.max_tokens ?? settings.openRouter.maxTokens
    })
  });

  const payload = (await response.json()) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: unknown } }>;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `OpenRouter request failed with status ${response.status}.`);
  }

  const content = normalizeAssistantContent(payload.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error("OpenRouter returned an empty response.");
  }

  return content;
}
