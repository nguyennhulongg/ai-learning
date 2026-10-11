import type { UIMessage } from "ai";

export type { UIMessage };

export interface Conversation {
  id: string;
  title: string;
  messages: UIMessage[];
  createdAt: Date;
  isPinned?: boolean;
}
