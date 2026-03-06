import { describe, it, expect } from 'vitest';
import { lintHTML } from './html-linter.js';
import { lintManifest } from './manifest-linter.js';
import { checkAlignment, checkPageAlignment } from './alignment-checker.js';
import schema from '../../../schemas/agent-manifest.schema.json';

describe('lintHTML', () => {
  it('returns no errors for valid HTML', () => {
    const html = `
      <form data-agent-kind="action" data-agent-action="invoice.create" data-agent-danger="low" data-agent-confirm="optional">
        <input data-agent-kind="field" data-agent-field="customer_email" />
        <button data-agent-kind="action" data-agent-action="invoice.create.submit">Submit</button>
      </form>
    `;
    const results = lintHTML(html);
    expect(results).toHaveLength(0);
  });

  it('reports error for invalid data-agent-kind', () => {
    const html = `<div data-agent-kind="invalid_kind">test</div>`;
    const results = lintHTML(html);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('error');
    expect(results[0].message).toContain('invalid_kind');
  });

  it('reports error for invalid data-agent-danger', () => {
    const html = `<button data-agent-kind="action" data-agent-danger="extreme">Delete</button>`;
    const results = lintHTML(html);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('error');
    expect(results[0].message).toContain('extreme');
  });

  it('reports error for invalid data-agent-confirm', () => {
    const html = `<button data-agent-kind="action" data-agent-confirm="always">Submit</button>`;
    const results = lintHTML(html);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('error');
    expect(results[0].message).toContain('always');
  });

  it('accepts data-agent-confirm="review" as valid', () => {
    const html = `<form data-agent-kind="action" data-agent-confirm="review">Submit</form>`;
    const results = lintHTML(html);
    expect(results).toHaveLength(0);
  });

  it('reports error for invalid data-agent-idempotent', () => {
    const html = `<form data-agent-kind="action" data-agent-idempotent="yes">Submit</form>`;
    const results = lintHTML(html);
    expect(results).toHaveLength(1);
    expect(results[0].severity).toBe('error');
    expect(results[0].message).toContain('yes');
  });

  it('warns about invalid action identifier format', () => {
    const html = `<button data-agent-kind="action" data-agent-action="InvalidAction">Click</button>`;
    const results = lintHTML(html);
    expect(results.some((r) => r.severity === 'warning' && r.message.includes('InvalidAction'))).toBe(true);
  });

  it('warns about invalid field identifier format', () => {
    const html = `<input data-agent-kind="field" data-agent-field="CamelCase" />`;
    const results = lintHTML(html);
    expect(results.some((r) => r.severity === 'warning' && r.message.includes('CamelCase'))).toBe(true);
  });

  it('accepts data-agent-kind="link" as valid', () => {
    const html = `<a href="/invoices/" data-agent-kind="link">Invoices</a>`;
    const results = lintHTML(html);
    expect(results).toHaveLength(0);
  });

  it('validates data-agent-page path format', () => {
    const html = `<button data-agent-kind="link" data-agent-page="invoices">Go</button>`;
    const results = lintHTML(html);
    expect(results.some((r) => r.severity === 'warning' && r.message.includes('data-agent-page'))).toBe(true);
  });

  it('accepts data-agent-page starting with /', () => {
    const html = `<button data-agent-kind="link" data-agent-page="/invoices/">Go</button>`;
    const results = lintHTML(html);
    expect(results).toHaveLength(0);
  });

  it('accepts data-agent-page starting with http', () => {
    const html = `<button data-agent-kind="link" data-agent-page="https://docs.example.com">Docs</button>`;
    const results = lintHTML(html);
    expect(results).toHaveLength(0);
  });

  it('errors on non-<a> with kind="link" without data-agent-page', () => {
    const html = `<button data-agent-kind="link">Go</button>`;
    const results = lintHTML(html);
    expect(results.some((r) => r.severity === 'error' && r.message.includes('non-<a>'))).toBe(true);
  });

  it('passes <a> with kind="link" without data-agent-page', () => {
    const html = `<a href="/invoices/" data-agent-kind="link">Invoices</a>`;
    const results = lintHTML(html);
    expect(results).toHaveLength(0);
  });

  it('passes non-<a> with kind="link" and JSX expression data-agent-page={...}', () => {
    const tsx = `<span data-agent-kind="link" data-agent-page={"/projects/" + id}>Project</span>`;
    const results = lintHTML(tsx, 'Card.tsx');
    expect(results.filter((r) => r.message.includes('non-<a>'))).toHaveLength(0);
  });

  it('passes multi-line JSX with data-agent-page on next line', () => {
    const tsx = `<TableCell\n  data-agent-kind="link"\n  data-agent-page={\`/projects/\${id}\`}\n>`;
    const results = lintHTML(tsx, 'List.tsx');
    expect(results.filter((r) => r.message.includes('non-<a>'))).toHaveLength(0);
  });

  it('passes HeroUI <Link href="..."> with kind="link"', () => {
    const tsx = `<Link\n  href="https://github.com/example"\n  isExternal\n  data-agent-kind="link"\n>`;
    const results = lintHTML(tsx, 'Sidebar.tsx');
    expect(results.filter((r) => r.message.includes('non-<a>'))).toHaveLength(0);
  });

  it('passes Button with kind="link" and data-agent-page on next line', () => {
    const tsx = `<Button\n  onPress={() => navigate({ to: "/login" })}\n  data-agent-kind="link"\n  data-agent-page="/login"\n>`;
    const results = lintHTML(tsx, 'CheckEmail.tsx');
    expect(results.filter((r) => r.message.includes('non-<a>'))).toHaveLength(0);
  });

  it('passes <RouterLink to="..."> with kind="link" without data-agent-page', () => {
    const html = `<RouterLink to="/dashboard" data-agent-kind="link">Dashboard</RouterLink>`;
    const results = lintHTML(html, 'Sidebar.tsx');
    // Should not error about missing data-agent-page (RouterLink renders as <a> in DOM)
    expect(results.filter((r) => r.message.includes('non-<a>'))).toHaveLength(0);
    // Should not warn about missing data-agent-kind (it's present)
    expect(results.filter((r) => r.message.includes('router link'))).toHaveLength(0);
  });

  it('passes <Link to="..."> with kind="link" without data-agent-page', () => {
    const html = `<Link to="/settings" data-agent-kind="link">Settings</Link>`;
    const results = lintHTML(html, 'Nav.tsx');
    expect(results.filter((r) => r.message.includes('non-<a>'))).toHaveLength(0);
  });

  it('passes multi-line <RouterLink to="..."> with kind="link" without data-agent-page', () => {
    const html = `<RouterLink\n  key={item.path}\n  to={item.path}\n  onClick={onClose}\n  data-agent-kind="link"\n>`;
    const results = lintHTML(html, 'Sidebar.tsx');
    expect(results.filter((r) => r.message.includes('non-<a>'))).toHaveLength(0);
  });

  it('includes line numbers in results', () => {
    const html = `line1\n<div data-agent-kind="invalid">test</div>\nline3`;
    const results = lintHTML(html, 'test.html');
    expect(results[0].line).toBe(2);
    expect(results[0].source).toBe('test.html');
  });

  describe('ambiguous field resolution (§6.1.1)', () => {
    it('warns when the same field appears twice inside the same action', () => {
      const html = `
        <form data-agent-kind="action" data-agent-action="invoice.create">
          <input data-agent-kind="field" data-agent-field="amount" />
          <input data-agent-kind="field" data-agent-field="amount" />
        </form>
      `;
      const results = lintHTML(html);
      expect(results.some((r) =>
        r.severity === 'warning' && r.message.includes('Ambiguous') && r.message.includes('amount')
      )).toBe(true);
    });

    it('warns when the same field has multiple for-action bindings to the same action', () => {
      const html = `
        <form data-agent-kind="action" data-agent-action="invoice.create">
        </form>
        <input data-agent-kind="field" data-agent-field="memo" data-agent-for-action="invoice.create" />
        <textarea data-agent-kind="field" data-agent-field="memo" data-agent-for-action="invoice.create"></textarea>
      `;
      const results = lintHTML(html);
      expect(results.some((r) =>
        r.severity === 'warning' && r.message.includes('Ambiguous') && r.message.includes('memo') && r.message.includes('for-action')
      )).toBe(true);
    });

    it('warns when a field is both nested and bound via for-action to the same action', () => {
      const html = `
        <form data-agent-kind="action" data-agent-action="invoice.create">
          <input data-agent-kind="field" data-agent-field="amount" />
        </form>
        <input data-agent-kind="field" data-agent-field="amount" data-agent-for-action="invoice.create" />
      `;
      const results = lintHTML(html);
      expect(results.some((r) =>
        r.severity === 'warning' && r.message.includes('nested') && r.message.includes('for-action') && r.message.includes('amount')
      )).toBe(true);
    });

    it('does not warn when different fields are in the same action', () => {
      const html = `
        <form data-agent-kind="action" data-agent-action="invoice.create">
          <input data-agent-kind="field" data-agent-field="amount" />
          <input data-agent-kind="field" data-agent-field="currency" />
        </form>
      `;
      const results = lintHTML(html);
      expect(results.filter((r) => r.message.includes('Ambiguous'))).toHaveLength(0);
    });

    it('does not warn when the same field name is in different actions', () => {
      const html = `
        <form data-agent-kind="action" data-agent-action="invoice.create">
          <input data-agent-kind="field" data-agent-field="amount" />
        </form>
        <form data-agent-kind="action" data-agent-action="payment.create">
          <input data-agent-kind="field" data-agent-field="amount" />
        </form>
      `;
      const results = lintHTML(html);
      expect(results.filter((r) => r.message.includes('Ambiguous'))).toHaveLength(0);
    });
  });

  describe('SPA router link detection', () => {
    it('warns when <Link to="..."> is missing data-agent-kind="link"', () => {
      const tsx = `<Link to="/dashboard" onClick={onClose}>Dashboard</Link>`;
      const results = lintHTML(tsx, 'Sidebar.tsx');
      expect(results.some((r) => r.severity === 'warning' && r.message.includes('<Link to='))).toBe(true);
    });

    it('warns when <RouterLink to="..."> is missing data-agent-kind="link"', () => {
      const tsx = `<RouterLink to="/settings">Settings</RouterLink>`;
      const results = lintHTML(tsx, 'Nav.tsx');
      expect(results.some((r) => r.severity === 'warning' && r.message.includes('<RouterLink to='))).toBe(true);
    });

    it('warns when <NavLink to="..."> is missing data-agent-kind="link"', () => {
      const tsx = `<NavLink to="/projects">Projects</NavLink>`;
      const results = lintHTML(tsx, 'Nav.tsx');
      expect(results.some((r) => r.severity === 'warning' && r.message.includes('<NavLink to='))).toBe(true);
    });

    it('does not warn when <Link to="..."> has data-agent-kind="link"', () => {
      const tsx = `<Link to="/dashboard" data-agent-kind="link">Dashboard</Link>`;
      const results = lintHTML(tsx, 'Sidebar.tsx');
      expect(results.filter((r) => r.message.includes('router link'))).toHaveLength(0);
    });

    it('does not warn for <Link href="..."> (non-router, no to prop)', () => {
      const tsx = `<Link href="https://example.com" isExternal>Example</Link>`;
      const results = lintHTML(tsx, 'Footer.tsx');
      expect(results.filter((r) => r.message.includes('router link'))).toHaveLength(0);
    });

    it('does not check router links in .html files', () => {
      const html = `<Link to="/dashboard">Dashboard</Link>`;
      const results = lintHTML(html, 'page.html');
      expect(results.filter((r) => r.message.includes('router link'))).toHaveLength(0);
    });

    it('handles multi-line JSX Link tags', () => {
      const tsx = `<Link\n  to="/dashboard"\n  onClick={onClose}\n>\n  Dashboard\n</Link>`;
      const results = lintHTML(tsx, 'Sidebar.tsx');
      expect(results.some((r) => r.severity === 'warning' && r.message.includes('<Link to='))).toBe(true);
    });

    it('handles JSX expression props in Link tags', () => {
      const tsx = `<Link to={\`/projects/\${id}\`} data-agent-kind="link">Project</Link>`;
      const results = lintHTML(tsx, 'List.tsx');
      expect(results.filter((r) => r.message.includes('router link'))).toHaveLength(0);
    });

    it('does not warn when child element inside <Link> has data-agent-kind="link"', () => {
      const tsx = `<Link to="/projects/$projectId" params={{ projectId }}>\n  <Card>\n    <span data-agent-kind="link" data-agent-page={"/projects/" + id}>{name}</span>\n  </Card>\n</Link>`;
      const results = lintHTML(tsx, 'Dashboard.tsx');
      expect(results.filter((r) => r.message.includes('missing data-agent-kind'))).toHaveLength(0);
    });
  });

  describe('JSX/TSX support', () => {
    it('validates data-agent-* attributes in JSX files', () => {
      const tsx = `<input data-agent-kind="field" data-agent-field="customer_email" />`;
      const results = lintHTML(tsx, 'Form.tsx');
      expect(results).toHaveLength(0);
    });

    it('validates aaf-react AgentAction component props', () => {
      const tsx = `<AgentAction action="invoice.create" danger="low" confirm="optional">`;
      const results = lintHTML(tsx, 'Form.tsx');
      expect(results).toHaveLength(0);
    });

    it('reports error for invalid danger prop on AgentAction', () => {
      const tsx = `<AgentAction action="test.action" danger="extreme">`;
      const results = lintHTML(tsx, 'Form.tsx');
      expect(results.some((r) => r.severity === 'error' && r.message.includes('extreme'))).toBe(true);
    });

    it('reports warning for invalid action name on AgentAction', () => {
      const tsx = `<AgentAction action="BadName">`;
      const results = lintHTML(tsx, 'Form.tsx');
      expect(results.some((r) => r.severity === 'warning' && r.message.includes('BadName'))).toBe(true);
    });

    it('reports warning for invalid field name on AgentField', () => {
      const tsx = `<AgentField field="CamelCase" />`;
      const results = lintHTML(tsx, 'Form.tsx');
      expect(results.some((r) => r.severity === 'warning' && r.message.includes('CamelCase'))).toBe(true);
    });

    it('does not check component props on .html files', () => {
      // AgentAction doesn't exist in HTML, but the linter shouldn't try to parse it
      const html = `<AgentAction action="BadName">`;
      const results = lintHTML(html, 'page.html');
      expect(results.filter((r) => r.message.includes('BadName'))).toHaveLength(0);
    });

    it('validates AgentField with valid snake_case name', () => {
      const tsx = `<AgentField field="customer_email" />`;
      const results = lintHTML(tsx, 'Form.tsx');
      expect(results).toHaveLength(0);
    });
  });

  describe('unannotated native form controls', () => {
    it('warns on <select> without data-agent-field', () => {
      const html = `<select name="currency"><option>USD</option></select>`;
      const results = lintHTML(html);
      expect(results.some((r) => r.severity === 'warning' && r.message.includes('<select> missing data-agent-field'))).toBe(true);
    });

    it('warns on <textarea> without data-agent-field', () => {
      const html = `<textarea name="notes"></textarea>`;
      const results = lintHTML(html);
      expect(results.some((r) => r.severity === 'warning' && r.message.includes('<textarea> missing data-agent-field'))).toBe(true);
    });

    it('warns on <input type="text"> without data-agent-field', () => {
      const html = `<input type="text" name="email" />`;
      const results = lintHTML(html);
      expect(results.some((r) => r.severity === 'warning' && r.message.includes('<input> missing data-agent-field'))).toBe(true);
    });

    it('does not warn on <input type="hidden">', () => {
      const html = `<input type="hidden" name="csrf" value="token" />`;
      const results = lintHTML(html);
      expect(results.filter((r) => r.message.includes('<input> missing'))).toHaveLength(0);
    });

    it('does not warn on <input type="submit">', () => {
      const html = `<input type="submit" value="Go" />`;
      const results = lintHTML(html);
      expect(results.filter((r) => r.message.includes('<input> missing'))).toHaveLength(0);
    });

    it('does not warn on <input type="checkbox">', () => {
      const html = `<input type="checkbox" name="agree" />`;
      const results = lintHTML(html);
      expect(results.filter((r) => r.message.includes('<input> missing'))).toHaveLength(0);
    });

    it('does not warn on annotated <select>', () => {
      const html = `<select data-agent-kind="field" data-agent-field="currency"><option>USD</option></select>`;
      const results = lintHTML(html);
      expect(results.filter((r) => r.message.includes('<select> missing'))).toHaveLength(0);
    });

    it('does not warn on annotated <input>', () => {
      const html = `<input data-agent-kind="field" data-agent-field="email" type="email" />`;
      const results = lintHTML(html);
      expect(results.filter((r) => r.message.includes('<input> missing'))).toHaveLength(0);
    });
  });
});

describe('lintManifest', () => {
  it('returns no errors for a valid manifest', () => {
    const manifest = {
      version: '0.1',
      site: { name: 'Test', origin: 'https://test.com' },
      actions: {
        'test.action': {
          title: 'Test',
          scope: 'test.scope',
          risk: 'low',
          confirmation: 'optional',
          idempotent: false,
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
        },
      },
    };
    const results = lintManifest(manifest, schema);
    expect(results).toHaveLength(0);
  });

  it('returns no errors for a manifest with @context', () => {
    const manifest = {
      '@context': 'https://aaf.dev/context.jsonld',
      version: '0.1',
      site: { name: 'Test', origin: 'https://test.com' },
      actions: {
        'test.action': {
          title: 'Test',
          scope: 'test.scope',
          risk: 'low',
          confirmation: 'optional',
          idempotent: false,
          inputSchema: { type: 'object', properties: {} },
          outputSchema: { type: 'object', properties: {} },
        },
      },
    };
    const results = lintManifest(manifest, schema);
    expect(results).toHaveLength(0);
  });

  it('reports errors for invalid manifest', () => {
    const manifest = { version: 'bad', site: {} };
    const results = lintManifest(manifest, schema);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].severity).toBe('error');
  });

  it('accepts a data view with inputSchema (queryable)', () => {
    const manifest = {
      version: '0.1',
      site: { name: 'Test', origin: 'https://test.com' },
      actions: {},
      data: {
        'invoice.list': {
          title: 'List invoices',
          scope: 'invoices.read',
          inputSchema: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['draft', 'sent', 'paid'] },
            },
          },
          outputSchema: { type: 'object', properties: {} },
        },
      },
    };
    const results = lintManifest(manifest, schema);
    expect(results).toHaveLength(0);
  });
});

describe('checkAlignment', () => {
  it('reports no warnings when DOM matches manifest', () => {
    const html = `
      <form data-agent-kind="action" data-agent-action="invoice.create">
        <input data-agent-kind="field" data-agent-field="customer_email" />
        <input data-agent-kind="field" data-agent-field="amount" />
      </form>
    `;
    const manifest = {
      actions: {
        'invoice.create': {
          inputSchema: {
            properties: { customer_email: {}, amount: {} },
          },
        },
      },
    };
    const results = checkAlignment(html, manifest);
    expect(results).toHaveLength(0);
  });

  it('warns when manifest action missing from DOM', () => {
    const html = `<div>No actions here</div>`;
    const manifest = {
      actions: {
        'invoice.create': {
          inputSchema: { properties: {} },
        },
      },
    };
    const results = checkAlignment(html, manifest);
    expect(results.some((r) => r.message.includes('invoice.create') && r.message.includes('no corresponding'))).toBe(true);
  });

  it('validates page.data references against manifest.data', () => {
    const html = `<div data-agent-kind="collection" data-agent-action="invoice.list"></div>`;
    const manifest = {
      actions: {},
      data: { 'invoice.list': {} },
      pages: { '/invoices/': { title: 'Invoices', data: ['invoice.list'] } },
    };
    const results = checkAlignment(html, manifest);
    expect(results).toHaveLength(0);
  });

  it('warns when page.data references undefined data view', () => {
    const html = `<div></div>`;
    const manifest = {
      actions: {},
      pages: { '/invoices/': { title: 'Invoices', data: ['invoice.list'] } },
    };
    const results = checkAlignment(html, manifest);
    expect(results.some((r) => r.message.includes('invoice.list') && r.message.includes('data view'))).toBe(true);
  });

  it('handles pages with only data (no actions)', () => {
    const html = `<div data-agent-kind="collection" data-agent-action="invoice.list"></div>`;
    const manifest = {
      actions: {},
      data: { 'invoice.list': {} },
      pages: { '/invoices/': { title: 'Invoices', data: ['invoice.list'] } },
    };
    const results = checkAlignment(html, manifest);
    expect(results).toHaveLength(0);
  });

  it('warns when internal link target does not match manifest pages', () => {
    const html = `<a href="/unknown/" data-agent-kind="link">Unknown</a>`;
    const manifest = {
      actions: {},
      pages: { '/invoices/': { title: 'Invoices' } },
    };
    const results = checkAlignment(html, manifest);
    expect(results.some((r) => r.message.includes('/unknown/') && r.message.includes('manifest page route'))).toBe(true);
  });

  it('passes when internal link target matches manifest pages', () => {
    const html = `<a href="/invoices/" data-agent-kind="link">Invoices</a>`;
    const manifest = {
      actions: {},
      pages: { '/invoices/': { title: 'Invoices' } },
    };
    const results = checkAlignment(html, manifest);
    expect(results).toHaveLength(0);
  });

  it('checks data-agent-page targets against manifest pages', () => {
    const html = `<button data-agent-kind="link" data-agent-page="/missing/">Go</button>`;
    const manifest = {
      actions: {},
      pages: { '/invoices/': { title: 'Invoices' } },
    };
    const results = checkAlignment(html, manifest);
    expect(results.some((r) => r.message.includes('/missing/'))).toBe(true);
  });

  it('skips external link targets in manifest alignment', () => {
    const html = `<a href="https://docs.example.com" data-agent-kind="link">Docs</a>`;
    const manifest = {
      actions: {},
      pages: { '/invoices/': { title: 'Invoices' } },
    };
    const results = checkAlignment(html, manifest);
    expect(results).toHaveLength(0);
  });

  it('normalizes trailing slashes when matching link targets', () => {
    const html = `<a href="/invoices" data-agent-kind="link">Invoices</a>`;
    const manifest = {
      actions: {},
      pages: { '/invoices/': { title: 'Invoices' } },
    };
    const results = checkAlignment(html, manifest);
    expect(results).toHaveLength(0);
  });

  it('warns when manifest field not found in DOM', () => {
    const html = `
      <form data-agent-kind="action" data-agent-action="invoice.create">
        <input data-agent-kind="field" data-agent-field="customer_email" />
      </form>
    `;
    const manifest = {
      actions: {
        'invoice.create': {
          inputSchema: {
            properties: { customer_email: {}, missing_field: {} },
          },
        },
      },
    };
    const results = checkAlignment(html, manifest);
    expect(results.some((r) => r.message.includes('missing_field'))).toBe(true);
  });
});

describe('checkPageAlignment', () => {
  it('reports missing actions for a page', () => {
    const html = `<div>No actions here</div>`;
    const manifest = {
      actions: {
        'project.create': { inputSchema: { properties: { name: {} } } },
      },
      pages: {
        '/projects/': { title: 'Projects', actions: ['project.create'] },
      },
    };
    const results = checkPageAlignment(html, manifest, '/projects/');
    expect(results.some((r) =>
      r.message.includes('project.create') && r.message.includes('not found in rendered DOM'),
    )).toBe(true);
  });

  it('reports missing fields for a page action', () => {
    const html = `
      <form data-agent-action="project.create">
        <button data-agent-action="project.create.submit">Create</button>
      </form>
    `;
    const manifest = {
      actions: {
        'project.create': {
          inputSchema: { properties: { name: {}, description: {} } },
        },
      },
      pages: {
        '/projects/': { title: 'Projects', actions: ['project.create'] },
      },
    };
    const results = checkPageAlignment(html, manifest, '/projects/');
    expect(results.some((r) => r.message.includes('field "name"'))).toBe(true);
    expect(results.some((r) => r.message.includes('field "description"'))).toBe(true);
  });

  it('passes when all page actions and fields are present', () => {
    const html = `
      <form data-agent-action="project.create">
        <input data-agent-field="name" />
        <input data-agent-field="description" />
        <button data-agent-action="project.create.submit">Create</button>
      </form>
    `;
    const manifest = {
      actions: {
        'project.create': {
          inputSchema: { properties: { name: {}, description: {} } },
        },
      },
      pages: {
        '/projects/': { title: 'Projects', actions: ['project.create'] },
      },
    };
    const results = checkPageAlignment(html, manifest, '/projects/');
    expect(results).toHaveLength(0);
  });

  it('returns empty for unknown page route', () => {
    const manifest = {
      actions: {},
      pages: { '/projects/': { title: 'Projects' } },
    };
    const results = checkPageAlignment('<div></div>', manifest, '/unknown/');
    expect(results).toHaveLength(0);
  });

  it('accepts sub-actions matching the page action', () => {
    const html = `
      <button data-agent-action="project.create.submit">Create</button>
    `;
    const manifest = {
      actions: {
        'project.create': { inputSchema: { properties: {} } },
      },
      pages: {
        '/projects/': { title: 'Projects', actions: ['project.create'] },
      },
    };
    const results = checkPageAlignment(html, manifest, '/projects/');
    expect(results).toHaveLength(0);
  });
});
