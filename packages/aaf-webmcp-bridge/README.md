# @agent-accessibility-framework/webmcp-bridge

Bridges AAF manifest actions to WebMCP tool registrations. When `navigator.modelContext` is available (Chrome 146+), this package auto-registers each AAF action as a WebMCP tool. On browsers without WebMCP support, it's a no-op.

## Usage

```html
<script type="module">
  import { registerAAFTools } from '@agent-accessibility-framework/webmcp-bridge';
  const tools = await registerAAFTools();
  console.log('Registered WebMCP tools:', tools);
</script>
```

## API

- `registerAAFTools(options?)` — Fetches manifest and registers tools
- `unregisterAAFTools()` — Removes all registered tools
- `isWebMCPAvailable()` — Checks for `navigator.modelContext`
