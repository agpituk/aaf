import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Returns the full AGENTS.md prompt content for AWI annotation.
 */
export function getAgentSkillPrompt(): string {
  return readFileSync(join(__dirname, 'AGENTS.md'), 'utf-8');
}

/**
 * Returns a concise set of rules for AWI annotation.
 */
export function getAnnotationRules(): string[] {
  return [
    'Use data-agent-kind="action" on forms/buttons with data-agent-action="service.verb"',
    'Use data-agent-kind="field" on inputs with data-agent-field="snake_case_name"',
    'Pair danger="high" with confirm="required"',
    'Fields must be nested in an action or have data-agent-for-action',
    'Action names use dot.notation, field names use snake_case',
    'Submit buttons get sub-action: data-agent-action="parent.submit"',
    'Status elements need data-agent-kind="status" + data-agent-output',
    'Never reference CSS selectors in agent contracts',
  ];
}

/**
 * Validates an action name follows AWI conventions.
 */
export function isValidActionName(name: string): boolean {
  return /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(name);
}

/**
 * Validates a field name follows AWI conventions.
 */
export function isValidFieldName(name: string): boolean {
  return /^[a-z][a-z0-9]*(_[a-z][a-z0-9]*)*$/.test(name);
}
