# API & React-Query Usage Guide

## Architecture

The application follows a feature-based architecture for API and React-Query organization:

### Directory Structure:
```
src/
├── lib/
│   ├── axios.ts              # Centralized axios instance
│   ├── api-error.ts          # Error handling utilities
│   └── API_GUIDE.md          # This guide
├── components/
│   └── providers/
│       └── query-provider.tsx   # QueryClientProvider wrapper
└── features/
    ├── sessions/
    │   ├── sessions.types.ts   # TypeScript types
    │   ├── sessions.api.ts     # API functions
    │   ├── sessions.keys.ts    # Query keys
    │   ├── sessions.queries.ts # Query hooks
    │   └── sessions.mutations.ts # Mutation hooks
    └── upload/
        ├── upload.types.ts
        ├── upload.api.ts
        ├── upload.keys.ts
        └── upload.mutations.ts
```

## Creating a New Feature

### 1. Define Types (`features/[feature]/[feature].types.ts`)
```typescript
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
```

### 2. Define API Functions (`features/[feature]/[feature].api.ts`)
```typescript
import { apiClient } from "@/lib/axios";
import type { Session, CreateSessionInput, UpdateSessionInput } from "./sessions.types";

export const sessionsApi = {
  create: (data: CreateSessionInput) =>
    apiClient.post<Session>('/api/sessions', data),

  getAll: () =>
    apiClient.get<Session[]>('/api/sessions'),

  getById: (id: string) =>
    apiClient.get<Session>(`/api/sessions/${id}`),

  update: (id: string, data: UpdateSessionInput) =>
    apiClient.put<Session>(`/api/sessions/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/api/sessions/${id}`),
};
```

### 3. Define Query Keys (`features/[feature]/[feature].keys.ts`)
```typescript
export const sessionsKeys = {
  all: ['sessions'] as const,
  lists: () => [...sessionsKeys.all, 'list'] as const,
  list: (filters?: string) => [...sessionsKeys.lists(), { filters }] as const,
  details: () => [...sessionsKeys.all, 'detail'] as const,
  detail: (id: string) => [...sessionsKeys.details(), id] as const,
};
```

### 4. Create Query Hooks (`features/[feature]/[feature].queries.ts`)
```typescript
import { useQuery } from "@tanstack/react-query";
import { sessionsApi } from "./sessions.api";
import { sessionsKeys } from "./sessions.keys";

export const useSessions = () => {
  return useQuery({
    queryKey: sessionsKeys.lists(),
    queryFn: () => sessionsApi.getAll().then((res) => res.data),
  });
};

export const useSession = (id: string) => {
  return useQuery({
    queryKey: sessionsKeys.detail(id),
    queryFn: () => sessionsApi.getById(id).then((res) => res.data),
    enabled: !!id,
  });
};
```

### 5. Create Mutation Hooks (`features/[feature]/[feature].mutations.ts`)
```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionsApi } from "./sessions.api";
import { sessionsKeys } from "./sessions.keys";
import { getApiErrorMessage } from "@/lib/api-error";
import type { CreateSessionInput, UpdateSessionInput } from "./sessions.types";

export const useCreateSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSessionInput) =>
      sessionsApi.create(data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    },
  });
};

export const useUpdateSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSessionInput }) =>
      sessionsApi.update(id, data).then((res) => res.data),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(id) });
    },
  });
};

export const useDeleteSession = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    },
  });
};
```

## Usage in Components

### Import and use hooks:
```typescript
import { useSessions, useDeleteSession, useUpdateSession } from "@/features/sessions/sessions.mutations";

function MyComponent() {
  const { data: sessions, isLoading } = useSessions();
  const deleteSession = useDeleteSession();
  const updateSession = useUpdateSession();

  const handleDelete = (id: string) => {
    deleteSession.mutate(id, {
      onSuccess: () => {
        console.log('Deleted successfully');
      },
    });
  };

  const handleUpdate = (id: string, data: any) => {
    updateSession.mutate({ id, data });
  };

  return <div>{/* JSX */}</div>;
}
```

## Benefits

1. **Feature-based organization**: All related files for a feature are grouped together
2. **Separation of concerns**: Types, API, queries, and mutations are separated
3. **Type safety**: Full TypeScript support with proper typing
4. **Consistent query keys**: Centralized key management for cache invalidation
5. **Reusability**: Hooks can be easily reused across components
6. **Testability**: Each file can be tested independently
7. **Scalability**: Easy to add new features following the same pattern

## Error Handling

Use the provided error utilities:

```typescript
import { getApiErrorMessage } from "@/lib/api-error";

try {
  // API call
} catch (error) {
  const message = getApiErrorMessage(error);
  console.error(message);
}
```

## FormData Uploads

For file uploads, use FormData - the axios instance automatically handles the correct Content-Type:

```typescript
const formData = new FormData();
formData.append('file', file);
formData.append('purpose', 'knowledge_base');

const uploadMutation = useUploadFile();
await uploadMutation.mutateAsync(formData);
```
