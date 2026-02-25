import { describe, it, expect } from 'vitest';
import rule from './field-linked-to-action.js';

describe('field-linked-to-action', () => {
  it('exports a rule with correct meta', () => {
    expect(rule.meta?.type).toBe('problem');
    expect(rule.meta?.messages).toHaveProperty('fieldNotLinked');
  });

  it('does not report for non-field elements', () => {
    const reports: any[] = [];
    const mockContext = {
      report(arg: any) { reports.push(arg); },
    } as any;
    const visitor = rule.create(mockContext);

    const mockNode = {
      attributes: [
        {
          type: 'JSXAttribute',
          name: { name: 'data-agent-kind' },
          value: { type: 'Literal', value: 'action' },
        },
      ],
      parent: null,
    };

    (visitor as any).JSXOpeningElement(mockNode);
    expect(reports).toHaveLength(0);
  });

  it('does not report when field has forAction', () => {
    const reports: any[] = [];
    const mockContext = {
      report(arg: any) { reports.push(arg); },
    } as any;
    const visitor = rule.create(mockContext);

    const mockNode = {
      attributes: [
        {
          type: 'JSXAttribute',
          name: { name: 'data-agent-kind' },
          value: { type: 'Literal', value: 'field' },
        },
        {
          type: 'JSXAttribute',
          name: { name: 'data-agent-for-action' },
          value: { type: 'Literal', value: 'invoice.create' },
        },
      ],
      parent: null,
    };

    (visitor as any).JSXOpeningElement(mockNode);
    expect(reports).toHaveLength(0);
  });

  it('reports when field has no parent action and no forAction', () => {
    const reports: any[] = [];
    const mockContext = {
      report(arg: any) { reports.push(arg); },
    } as any;
    const visitor = rule.create(mockContext);

    const mockNode = {
      attributes: [
        {
          type: 'JSXAttribute',
          name: { name: 'data-agent-kind' },
          value: { type: 'Literal', value: 'field' },
        },
      ],
      parent: null,
    };

    (visitor as any).JSXOpeningElement(mockNode);
    expect(reports).toHaveLength(1);
    expect(reports[0].messageId).toBe('fieldNotLinked');
  });

  it('does not report when field is nested in action element', () => {
    const reports: any[] = [];
    const mockContext = {
      report(arg: any) { reports.push(arg); },
    } as any;
    const visitor = rule.create(mockContext);

    const parentActionElement = {
      type: 'JSXElement',
      openingElement: {
        attributes: [
          {
            type: 'JSXAttribute',
            name: { name: 'data-agent-kind' },
            value: { type: 'Literal', value: 'action' },
          },
        ],
      },
      parent: null,
    };

    const mockNode = {
      attributes: [
        {
          type: 'JSXAttribute',
          name: { name: 'data-agent-kind' },
          value: { type: 'Literal', value: 'field' },
        },
      ],
      parent: parentActionElement,
    };

    (visitor as any).JSXOpeningElement(mockNode);
    expect(reports).toHaveLength(0);
  });
});
