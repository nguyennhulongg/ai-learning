export interface Session {
  id: string;
  title: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionInput {
  title: string;
}

export interface UpdateSessionInput {
  title?: string;
  isPinned?: boolean;
}
