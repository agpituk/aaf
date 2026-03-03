import { describe, it, expect } from 'vitest';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { AgentForm } from './components.js';

describe('AgentForm', () => {
  it('renders a form with data-agent-kind="action"', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(AgentForm, { action: 'invoice.create' },
        React.createElement('input', { type: 'text' })
      )
    );
    expect(html).toContain('data-agent-kind="action"');
    expect(html).toContain('data-agent-action="invoice.create"');
    expect(html).toContain('<form');
  });

  it('renders risk and confirmation attributes', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(AgentForm, {
        action: 'workspace.delete',
        risk: 'high',
        confirmation: 'required',
        scope: 'workspace.admin',
      },
        React.createElement('span', null, 'delete')
      )
    );
    expect(html).toContain('data-agent-danger="high"');
    expect(html).toContain('data-agent-confirm="required"');
    expect(html).toContain('data-agent-scope="workspace.admin"');
  });

  it('passes className through', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(AgentForm, { action: 'test', className: 'my-form' },
        React.createElement('div')
      )
    );
    expect(html).toContain('class="my-form"');
  });

  it('renders idempotent attribute', () => {
    const html = ReactDOMServer.renderToStaticMarkup(
      React.createElement(AgentForm, { action: 'test', idempotent: true },
        React.createElement('div')
      )
    );
    expect(html).toContain('data-agent-idempotent="true"');
  });
});
