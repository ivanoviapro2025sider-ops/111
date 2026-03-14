export interface OpenRouterPricing {
  prompt: string;
  completion: string;
  image?: string;
  request?: string;
}

export interface OpenRouterArchitecture {
  modality?: string;
  tokenizer?: string;
  instruct_type?: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  max_completion_tokens?: number;
  pricing?: OpenRouterPricing;
  architecture?: OpenRouterArchitecture;
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  per_request_limits?: {
    prompt_tokens?: string;
    completion_tokens?: string;
  };
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}
