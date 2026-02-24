import { describe, it, expect } from 'vitest';
import { SemanticParser } from './semantic-parser.js';

// Minimal mock DOM element for testing
function mockElement(
  tagName: string,
  attrs: Record<string, string>,
  childElements: ReturnType<typeof mockElement>[] = [],
  textContent = ''
) {
  const el = {
    tagName,
    textContent,
    getAttribute(name: string) {
      return attrs[name] ?? null;
    },
    get children() {
      return childElements;
    },
    querySelectorAll(selector: string) {
      return querySelectorAllDeep(el, selector);
    },
  };
  return el;
}

function querySelectorAllDeep(
  root: ReturnType<typeof mockElement>,
  selector: string
): ReturnType<typeof mockElement>[] {
  const results: ReturnType<typeof mockElement>[] = [];
  // Simple selector matcher for [attr="value"][attr2="value2"]
  const attrMatches = [...selector.matchAll(/\[([^=\]]+)(?:="([^"]*)")?\]/g)];

  function matches(el: ReturnType<typeof mockElement>): boolean {
    return attrMatches.every(([, attr, val]) => {
      const actual = el.getAttribute(attr);
      if (val !== undefined) return actual === val;
      return actual !== null;
    });
  }

  function walk(el: ReturnType<typeof mockElement>) {
    for (let i = 0; i < el.children.length; i++) {
      const child = el.children[i];
      if (matches(child)) results.push(child);
      walk(child);
    }
  }

  walk(root);
  return results;
}

describe('SemanticParser', () => {
  const parser = new SemanticParser();

  it('parses an action element', () => {
    const el = mockElement('FORM', {
      'data-agent-kind': 'action',
      'data-agent-action': 'invoice.create',
      'data-agent-scope': 'invoices.write',
      'data-agent-danger': 'low',
      'data-agent-confirm': 'optional',
    });

    const result = parser.parseElement(el);
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('action');
    expect(result!.action).toBe('invoice.create');
    expect(result!.scope).toBe('invoices.write');
    expect(result!.danger).toBe('low');
    expect(result!.confirm).toBe('optional');
  });

  it('returns null for elements without data-agent-kind', () => {
    const el = mockElement('DIV', {});
    expect(parser.parseElement(el)).toBeNull();
  });

  it('returns null for invalid kind values', () => {
    const el = mockElement('DIV', { 'data-agent-kind': 'invalid' });
    expect(parser.parseElement(el)).toBeNull();
  });

  it('discovers actions from a root element', () => {
    const emailField = mockElement('INPUT', {
      'data-agent-kind': 'field',
      'data-agent-field': 'customer_email',
    });
    const amountField = mockElement('INPUT', {
      'data-agent-kind': 'field',
      'data-agent-field': 'amount',
    });
    const submitBtn = mockElement('BUTTON', {
      'data-agent-kind': 'action',
      'data-agent-action': 'invoice.create.submit',
    });
    const statusDiv = mockElement('DIV', {
      'data-agent-kind': 'status',
      'data-agent-output': 'invoice.create.status',
    });
    const form = mockElement(
      'FORM',
      {
        'data-agent-kind': 'action',
        'data-agent-action': 'invoice.create',
        'data-agent-scope': 'invoices.write',
        'data-agent-danger': 'low',
        'data-agent-confirm': 'optional',
      },
      [emailField, amountField, submitBtn, statusDiv]
    );
    const root = mockElement('DIV', {}, [form]);

    const actions = parser.discoverActions(root);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('invoice.create');
    expect(actions[0].fields).toHaveLength(2);
    expect(actions[0].fields[0].field).toBe('customer_email');
    expect(actions[0].fields[1].field).toBe('amount');
    expect(actions[0].statuses).toHaveLength(1);
    expect(actions[0].statuses[0].output).toBe('invoice.create.status');
    expect(actions[0].submitAction).toBe('invoice.create.submit');
  });

  it('discovers fields linked via data-agent-for-action', () => {
    const deleteBtn = mockElement('BUTTON', {
      'data-agent-kind': 'action',
      'data-agent-action': 'workspace.delete',
      'data-agent-danger': 'high',
      'data-agent-confirm': 'required',
    });
    const confirmInput = mockElement('INPUT', {
      'data-agent-kind': 'field',
      'data-agent-field': 'delete_confirmation_text',
      'data-agent-for-action': 'workspace.delete',
    });
    const root = mockElement('DIV', {}, [deleteBtn, confirmInput]);

    const actions = parser.discoverActions(root);
    expect(actions).toHaveLength(1);
    expect(actions[0].action).toBe('workspace.delete');
    expect(actions[0].fields).toHaveLength(1);
    expect(actions[0].fields[0].field).toBe('delete_confirmation_text');
    expect(actions[0].fields[0].forAction).toBe('workspace.delete');
  });
});
