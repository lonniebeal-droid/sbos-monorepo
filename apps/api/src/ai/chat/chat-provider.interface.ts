export type AssistantKindName =
  | 'RECEPTIONIST'
  | 'SCHEDULING'
  | 'INTAKE'
  | 'CLINICAL'
  | 'KNOWLEDGE'
  | 'GENERAL';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface KnowledgeSnippet {
  title: string;
  body: string;
}

export interface ChatRequest {
  kind: AssistantKindName;
  systemPrompt: string;
  messages: ChatMessage[];
  knowledge?: KnowledgeSnippet[];
}

export interface ChatResult {
  content: string;
  provider: string;
}

/**
 * Jessie's chat-generation contract. The default is an offline, deterministic
 * provider; a hosted LLM (OpenAI/Claude/Gemini) can be bound to
 * {@link CHAT_PROVIDER} without changing the conversation/router services.
 */
export interface ChatProvider {
  generateReply(request: ChatRequest): Promise<ChatResult>;
}

export const CHAT_PROVIDER = Symbol('CHAT_PROVIDER');
