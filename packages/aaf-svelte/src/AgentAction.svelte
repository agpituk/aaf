<script lang="ts">
  import type { AgentActionProps } from './types.js';
  import type { Snippet } from 'svelte';

  let {
    action,
    danger,
    confirm,
    scope,
    idempotent,
    children,
    ...rest
  }: AgentActionProps & { children?: Snippet; [key: string]: unknown } = $props();
</script>

<form
  data-agent-kind="action"
  data-agent-action={action}
  data-agent-danger={danger}
  data-agent-confirm={confirm}
  data-agent-scope={scope}
  data-agent-idempotent={idempotent !== undefined ? String(idempotent) : undefined}
  {...rest}
>
  {@render children?.()}
</form>
