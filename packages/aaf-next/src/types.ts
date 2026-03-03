import type { AgentManifest } from '@agent-accessibility-framework/runtime-core';

export interface AgentFormProps {
  action: string;
  risk?: 'none' | 'low' | 'high';
  confirmation?: 'never' | 'optional' | 'review' | 'required';
  scope?: string;
  idempotent?: boolean;
  children: React.ReactNode;
  className?: string;
}

export interface ActionMeta {
  action: string;
  risk?: 'none' | 'low' | 'high';
  confirmation?: 'never' | 'optional' | 'review' | 'required';
  scope?: string;
  idempotent?: boolean;
  inputSchema?: object;
  outputSchema?: object;
}

export type WrappedServerAction = ((...args: any[]) => Promise<any>) & {
  __aaf_meta: ActionMeta;
};

export interface DiscoveredActionSummary {
  action: string;
  title?: string;
  risk?: string;
  confirmation?: string;
  scope?: string;
  fields: Array<{ field: string; tagName: string }>;
}
