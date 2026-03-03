import React from 'react';
import type { AgentFormProps } from './types.js';

/**
 * React Server Component: wraps children in an AAF-annotated <form>.
 * Injects data-agent-* attributes for agent discovery.
 */
export function AgentForm({
  action,
  risk,
  confirmation,
  scope,
  idempotent,
  children,
  className,
  ...rest
}: AgentFormProps & Record<string, unknown>) {
  const attrs: Record<string, string> = {
    'data-agent-kind': 'action',
    'data-agent-action': action,
  };
  if (risk) attrs['data-agent-danger'] = risk;
  if (confirmation) attrs['data-agent-confirm'] = confirmation;
  if (scope) attrs['data-agent-scope'] = scope;
  if (idempotent !== undefined) attrs['data-agent-idempotent'] = String(idempotent);

  return React.createElement('form', { ...attrs, className, ...rest }, children);
}
