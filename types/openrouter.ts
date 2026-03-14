export interface OpenRouterPricing {
  prompt?: string;
  completion?: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  architecture?: { modality?: string; tokenizer?: string };
  pricing?: OpenRouterPricing;
  top_provider?: { max_completion_tokens?: number; is_moderated?: boolean };
  per_request_limits?: Record<string, unknown>;
}
