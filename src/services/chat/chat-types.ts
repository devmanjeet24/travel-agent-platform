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
};

export type SendChatVariables = {
  message: string;
  history: ChatHistoryItem[];
  conversationId?: string;
  tripId?: string;
  attachments?: ChatAttachment[];
  tripContext?: {
    destination?: string;
    origin?: string;
    startDate?: string;
    endDate?: string;
    /** Budget in INR. */
    budgetInr?: number;
    travelers?: number;
  };
  stream?: boolean;
};
