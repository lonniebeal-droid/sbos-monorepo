import { Injectable } from '@nestjs/common';

import type {
  ChatProvider,
  ChatRequest,
  ChatResult,
  KnowledgeSnippet,
} from './chat-provider.interface';

/**
 * Offline, deterministic Jessie chat provider. It produces genuinely useful,
 * on-role replies from the latest user message, the assistant kind, and any
 * grounding knowledge — with no external API dependency. A hosted LLM provider
 * implements the same interface for production-grade generation.
 */
@Injectable()
export class HeuristicChatProvider implements ChatProvider {
  readonly provider = 'heuristic-chat-v1';

  async generateReply(request: ChatRequest): Promise<ChatResult> {
    const lastUser = [...request.messages]
      .reverse()
      .find((m) => m.role === 'user');
    const message = (lastUser?.content ?? '').trim();
    const grounding = this.matchKnowledge(message, request.knowledge);

    let content: string;
    switch (request.kind) {
      case 'RECEPTIONIST':
        content = this.receptionist(message, grounding);
        break;
      case 'SCHEDULING':
        content = this.scheduling(message);
        break;
      case 'INTAKE':
        content = this.intake(request.messages.filter((m) => m.role === 'user').length);
        break;
      case 'CLINICAL':
        content = this.clinical(message);
        break;
      case 'KNOWLEDGE':
        content = this.knowledge(message, grounding);
        break;
      case 'GENERAL':
      default:
        content = this.general(message, grounding);
        break;
    }

    return { content, provider: this.provider };
  }

  private matchKnowledge(
    message: string,
    knowledge?: KnowledgeSnippet[],
  ): KnowledgeSnippet | undefined {
    if (!knowledge || knowledge.length === 0 || !message) return undefined;
    const terms = message.toLowerCase().split(/\W+/).filter((t) => t.length > 3);
    let best: { snippet: KnowledgeSnippet; score: number } | undefined;
    for (const snippet of knowledge) {
      const haystack = `${snippet.title} ${snippet.body}`.toLowerCase();
      const score = terms.reduce(
        (sum, term) => sum + (haystack.includes(term) ? 1 : 0),
        0,
      );
      if (score > 0 && (!best || score > best.score)) {
        best = { snippet, score };
      }
    }
    return best?.snippet;
  }

  private summarize(body: string): string {
    const firstSentence = body.split(/(?<=[.!?])\s/)[0];
    return firstSentence.length > 280
      ? `${firstSentence.slice(0, 277)}…`
      : firstSentence;
  }

  private receptionist(message: string, grounding?: KnowledgeSnippet): string {
    if (!message) {
      return "Hi, I'm Jessie. How can I help you today — scheduling an appointment, a question about our services, or getting started as a new client?";
    }
    if (grounding) {
      return `Thanks for reaching out. ${this.summarize(grounding.body)} Is there anything else I can help you with, or would you like me to connect you with our team?`;
    }
    if (/appointment|schedule|book|reschedul|cancel/i.test(message)) {
      return "I'd be happy to help with scheduling. What day works best for you, and do you have a preferred clinician? I can check availability and get you booked.";
    }
    if (/new|intake|start|register/i.test(message)) {
      return 'Welcome! I can start your intake. To begin, may I have your full name and date of birth?';
    }
    return "Thanks for your message. I can help with appointments, new-client intake, and general questions. Could you tell me a little more about what you need? For anything urgent, I'll connect you with our team right away.";
  }

  private scheduling(message: string): string {
    const hasDate = /\b(mon|tue|wed|thu|fri|sat|sun|today|tomorrow|\d{1,2}[:/])/i.test(message);
    if (hasDate) {
      return 'Got it. Let me check the clinician’s availability for that time. If the slot is open I’ll reserve it; if not, I’ll offer the closest alternatives. Which appointment type is this — individual, intake, or telehealth?';
    }
    return 'I can book that for you. What date and time would you prefer, and with which clinician? I’ll confirm availability before reserving the slot.';
  }

  private intake(userTurns: number): string {
    const steps = [
      'Thank you for starting your intake with us. First, could you share your full legal name?',
      'Thank you. What is your date of birth?',
      'Great. What is the best phone number and email to reach you?',
      'What brings you in today — briefly, what would you like support with?',
      'Lastly, do you have insurance you’d like to use? If so, which carrier and member ID?',
      'Thank you — that’s everything I need to get you started. A team member will follow up to confirm your first appointment.',
    ];
    return steps[Math.min(userTurns, steps.length - 1)];
  }

  private clinical(message: string): string {
    if (!message) {
      return 'Share the key points from the session and I’ll help you structure them into a note (BIRP, DAP, or SOAP). Which format would you like?';
    }
    return `Here’s a structured starting point based on what you shared:\n\n• Presentation: ${this.summarize(message)}\n• Intervention: (document techniques used)\n• Response: (client’s response and engagement)\n• Plan: (next steps and homework)\n\nWould you like this formatted as a BIRP, DAP, or SOAP note?`;
  }

  private knowledge(message: string, grounding?: KnowledgeSnippet): string {
    if (grounding) {
      return `${grounding.title}: ${this.summarize(grounding.body)}`;
    }
    return "I couldn’t find that in our knowledge base. I can connect you with a team member who can help — would you like that?";
  }

  private general(message: string, grounding?: KnowledgeSnippet): string {
    if (grounding) return this.summarize(grounding.body);
    if (!message) return "Hi, I'm Jessie. How can I help?";
    return `I understand you’re asking about “${this.summarize(message)}”. I can help with scheduling, intake, documentation, and general questions — could you tell me a bit more so I can point you in the right direction?`;
  }
}
