export interface OpenRouterModelPricing {
  prompt: string;
  completion: string;
  image?: string;
  request?: string;
}

export interface OpenRouterArchitecture {
  modality: string;
  tokenizer: string;
  instruct_type?: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: OpenRouterModelPricing;
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  architecture?: OpenRouterArchitecture;
  per_request_limits?: Record<string, number>;
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}
