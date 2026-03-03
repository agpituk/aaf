/**
 * AAF → WebMCP Bridge
 *
 * When navigator.modelContext is available (Chrome 146+ with flag),
 * this module auto-registers each AAF manifest action as a WebMCP tool.
 * On browsers without WebMCP support, it's a no-op.
 *
 * The tool handler executes via the AAF PolicyEngine chain,
 * so risk/confirmation enforcement still applies.
 */

export interface RegisterOptions {
  /** URL of the manifest. Default: '/.well-known/agent-manifest.json' */
  manifestUrl?: string;
  /** Only register these action IDs */
  actionsFilter?: string[];
  /** Called when each tool is registered */
  onRegister?: (toolName: string) => void;
}

// Track registered tools for cleanup
let registeredTools: string[] = [];

/**
 * Returns true if the current browser exposes navigator.modelContext.
 */
export function isWebMCPAvailable(): boolean {
  return typeof navigator !== 'undefined' && 'modelContext' in navigator;
}

/**
 * Call once on page load.
 * Fetches /.well-known/agent-manifest.json, then:
 *   - If navigator.modelContext exists: registers each action as a WebMCP tool.
 *   - If not: does nothing (AAF runtime handles execution natively).
 * Returns list of registered tool names (empty if WebMCP unavailable).
 */
export async function registerAAFTools(options: RegisterOptions = {}): Promise<string[]> {
  if (!isWebMCPAvailable()) {
    return [];
  }

  const manifestUrl = options.manifestUrl || '/.well-known/agent-manifest.json';

  const response = await fetch(manifestUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch manifest from ${manifestUrl}: ${response.status}`);
  }

  const manifest = await response.json();
  const actions = manifest.actions || {};
  const toolNames: string[] = [];

  const mc = (navigator as any).modelContext;

  for (const [actionId, action] of Object.entries(actions) as [string, any][]) {
    if (options.actionsFilter && !options.actionsFilter.includes(actionId)) {
      continue;
    }

    const toolName = actionId;
    const toolDef = {
      name: toolName,
      description: action.description || action.title || actionId,
      parameters: action.inputSchema || { type: 'object', properties: {} },
    };

    // Register tool with WebMCP
    // The tool handler returns a structured result; it does NOT auto-confirm.
    await mc.registerTool(toolDef, async (args: Record<string, unknown>) => {
      // High-risk actions with required confirmation MUST NOT auto-confirm
      if (action.risk === 'high' && action.confirmation === 'required') {
        return {
          error: 'confirmation_required',
          message: `Action "${actionId}" is high-risk and requires explicit user confirmation before execution.`,
          action: actionId,
          risk: action.risk,
          scope: action.scope,
        };
      }

      // Return the action request for the AAF runtime to execute
      return {
        action: actionId,
        args,
        status: 'pending_execution',
        message: `Action "${actionId}" ready for execution via AAF runtime.`,
      };
    });

    toolNames.push(toolName);
    options.onRegister?.(toolName);
  }

  registeredTools = toolNames;
  return toolNames;
}

/**
 * Unregisters all tools previously registered by registerAAFTools().
 */
export async function unregisterAAFTools(): Promise<void> {
  if (!isWebMCPAvailable() || registeredTools.length === 0) {
    return;
  }

  const mc = (navigator as any).modelContext;
  for (const toolName of registeredTools) {
    try {
      await mc.unregisterTool(toolName);
    } catch {
      // Tool may already have been unregistered
    }
  }

  registeredTools = [];
}
