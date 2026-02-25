import { describe, it, expect } from 'vitest';
import rule from './danger-requires-confirm.js';

describe('danger-requires-confirm', () => {
  it('exports a rule with correct meta', () => {
    expect(rule.meta?.type).toBe('problem');
    expect(rule.meta?.messages).toHaveProperty('missingConfirm');
  });

  it('has a create function that returns visitor', () => {
    const mockContext = { report: () => {} } as any;
    const visitor = rule.create(mockContext);
    expect(visitor).toHaveProperty('JSXOpeningElement');
  });

  it('reports when danger=high without confirm=required', () => {
    const reports: any[] = [];
    const mockContext = {
      report(arg: any) { reports.push(arg); },
    } as any;
    const visitor = rule.create(mockContext);

    // Simulate a JSX node with danger="high" but no confirm
    const mockNode = {
      attributes: [
        {
          type: 'JSXAttribute',
          name: { name: 'data-agent-danger' },
          value: { type: 'Literal', value: 'high' },
        },
      ],
    };

    (visitor as any).JSXOpeningElement(mockNode);
    expect(reports).toHaveLength(1);
    expect(reports[0].messageId).toBe('missingConfirm');
  });

  it('does not report when danger=high with confirm=required', () => {
    const reports: any[] = [];
    const mockContext = {
      report(arg: any) { reports.push(arg); },
    } as any;
    const visitor = rule.create(mockContext);

    const mockNode = {
      attributes: [
        {
          type: 'JSXAttribute',
          name: { name: 'data-agent-danger' },
          value: { type: 'Literal', value: 'high' },
        },
        {
          type: 'JSXAttribute',
          name: { name: 'data-agent-confirm' },
          value: { type: 'Literal', value: 'required' },
        },
      ],
    };

    (visitor as any).JSXOpeningElement(mockNode);
    expect(reports).toHaveLength(0);
  });

  it('does not report when danger=low', () => {
    const reports: any[] = [];
    const mockContext = {
      report(arg: any) { reports.push(arg); },
    } as any;
    const visitor = rule.create(mockContext);

    const mockNode = {
      attributes: [
        {
          type: 'JSXAttribute',
          name: { name: 'data-agent-danger' },
          value: { type: 'Literal', value: 'low' },
        },
      ],
    };

    (visitor as any).JSXOpeningElement(mockNode);
    expect(reports).toHaveLength(0);
  });
});
