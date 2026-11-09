import type { ChatToolEffect } from '@/utils/chat-trip-sync';

export type ChatRole = 'user' | 'assistant';

export type ChatAttachment = {
  url: string;
  name: string;
  type: string;
};

export type ChatHistoryItem = {
  role: ChatRole;
  content: string;
};

export type ChatMessage = ChatHistoryItem & {
  id: string;
  timestamp: string;
  attachments?: ChatAttachment[];
  streaming?: boolean;
};

export type ChatResult = {
  reply: string | null;
  error: string | null;
  conversationId?: string;
  warning?: string;
  tripId?: string;
  openTripId?: string;
  effects?: ChatToolEffect[];
};

export type SendChatVariables = {
  message: string;
  history: ChatHistoryItem[];
  conversationId?: string;
  /** Stable per send — prevents duplicate trips on retries. */
  clientRequestId?: string;
  tripId?: string;
  attachments?: ChatAttachment[];
  tripContext?: {
    destination?: string;
    origin?: string;
    startDate?: string;
    endDate?: string;
    tripDurationDays?: number;
    /** Budget in INR. */
    budgetInr?: number;
    travelers?: number;
  };
  stream?: boolean;
};
