<script lang="ts">
  import type { AgentFieldProps } from './types.js';
  import type { Snippet } from 'svelte';

  let {
    name,
    forAction,
    children,
    ...rest
  }: AgentFieldProps & { children?: Snippet; [key: string]: unknown } = $props();
</script>

<div
  data-agent-kind="field"
  data-agent-field={name}
  data-agent-for-action={forAction}
  {...rest}
>
  {@render children?.()}
</div>
