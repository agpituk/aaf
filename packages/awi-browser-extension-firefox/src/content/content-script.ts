import { DomAdapter } from './dom-adapter.js';
// Import directly to avoid pulling in AJV via barrel export.
// AJV uses new Function() which is blocked by Firefox extension CSP.
import { buildSystemPrompt, buildUserPrompt } from '@agent-native-web/planner-local/prompt-builder';
import { MSG } from '../shared/messages.js';
import type {
  ExtensionMessage,
  PlanAndExecuteMessage,
  ExecuteConfirmedMessage,
  PlanAndExecuteResult,
} from '../shared/messages.js';

const adapter = new DomAdapter();

const OLLAMA_URL = 'http://localhost:11434';
const OLLAMA_MODEL = 'llama3.2';

/** Direct Ollama fetch — avoids importing OllamaClient which may pull in AJV chain */
async function ollamaGenerate(prompt: string, systemPrompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      system: systemPrompt,
      format: 'json',
      stream: false,
      options: { temperature: 0.1, num_predict: 512 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.response;
}

/** Parse LLM JSON response — lightweight, no AJV */
function parseResponse(raw: string): { action: string; args: Record<string, unknown>; confirmed?: boolean } {
  // Extract JSON from markdown code blocks or raw text
  const mdMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  let json = mdMatch ? mdMatch[1].trim() : null;
  if (!json) {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end > start) json = raw.slice(start, end + 1);
  }
  if (!json) throw new Error(`No JSON in LLM response: ${raw.slice(0, 200)}`);

  const parsed = JSON.parse(json);
  if (!parsed.action || typeof parsed.action !== 'string') {
    throw new Error(`Invalid planner response: missing "action" field`);
  }
  if (parsed.action === 'none') {
    throw new Error(parsed.error || 'LLM could not map request to an action');
  }
  return { action: parsed.action, args: parsed.args || {}, confirmed: parsed.confirmed };
}

const MAX_RETRIES = 2;

/**
 * Content script: injected into web pages.
 * Orchestrates the full discover → plan (Harbor) → execute flow.
 * Planning happens here (not in sidebar) because both DOM access
 * and the Harbor bridge live in the content script context.
 */
browser.runtime.onMessage.addListener(
  (message: unknown): Promise<unknown> | void => {
    const msg = message as ExtensionMessage;
    // Only handle known message types
    if (
      msg.type === MSG.PLAN_AND_EXECUTE ||
      msg.type === MSG.EXECUTE_CONFIRMED ||
      msg.type === MSG.DISCOVER_ACTIONS ||
      msg.type === MSG.DETECT_AWI
    ) {
      return handleMessage(msg);
    }
  }
);

async function handleMessage(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case MSG.DETECT_AWI: {
      const detected = await adapter.detect();
      return { type: MSG.DETECTION_RESULT, payload: { detected } };
    }

    case MSG.DISCOVER_ACTIONS: {
      const catalog = await adapter.discover();
      return { type: MSG.DISCOVERY_RESULT, payload: catalog };
    }

    case MSG.PLAN_AND_EXECUTE: {
      return handlePlanAndExecute(message as PlanAndExecuteMessage);
    }

    case MSG.EXECUTE_CONFIRMED: {
      return handleExecuteConfirmed(message as ExecuteConfirmedMessage);
    }

    default:
      return { error: `Unknown message type: ${(message as ExtensionMessage).type}` };
  }
}

async function handlePlanAndExecute(
  message: PlanAndExecuteMessage
): Promise<PlanAndExecuteResult> {
  const { userMessage } = message.payload;

  try {
    // 1. Discover available actions
    const catalog = await adapter.discover();
    if (catalog.actions.length === 0) {
      return { error: 'No AWI actions found on this page.' };
    }

    // 2. Build prompts
    const systemPrompt = buildSystemPrompt(catalog);
    const userPrompt = buildUserPrompt(userMessage);

    // 3. Call Ollama directly with retry on parse failures
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const raw = await ollamaGenerate(userPrompt, systemPrompt);

        // 4. Parse LLM response into PlannerRequest
        const request = parseResponse(raw);

        // 5. Execute
        const result = await adapter.execute({
          actionName: request.action,
          args: request.args,
          confirmed: request.confirmed,
        });

        return {
          planned: { action: request.action, args: request.args },
          execution: result,
        };
      } catch (err) {
        lastError = err as Error;
        // Only retry on parse/validation errors, not on Ollama API errors
        if (lastError.message.includes('Ollama API error')) {
          break;
        }
      }
    }

    return { error: lastError?.message || 'Planning failed' };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

async function handleExecuteConfirmed(
  message: ExecuteConfirmedMessage
): Promise<PlanAndExecuteResult> {
  const { actionName, args } = message.payload;

  try {
    const result = await adapter.execute({
      actionName,
      args,
      confirmed: true,
    });

    return {
      planned: { action: actionName, args },
      execution: result,
    };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

// Notify background on load if AWI elements detected
adapter.detect().then((detected) => {
  if (detected) {
    browser.runtime.sendMessage({ type: MSG.AWI_DETECTED, payload: { url: window.location.href } });
  }
});
