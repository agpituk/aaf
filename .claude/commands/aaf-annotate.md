# AAF Annotate — Add Agent Accessibility Framework annotations to a web project

You are annotating a web project with AAF (Agent Accessibility Framework) attributes so that browser agents can reliably operate the UI using semantic names instead of CSS selectors.

**Target:** $ARGUMENTS (space-separated paths, globs, or files — default: current directory)

### Path scoping

`$ARGUMENTS` accepts one or more space-separated values:

- **No arguments** — annotate the entire project (full route tree scan, as before)
- **Folder(s)** (e.g., `src/pages/billing`) — only find and annotate UI files in that subtree. Trace routes only for components reachable from those files.
- **File(s)** (e.g., `src/components/InvoiceForm.tsx src/pages/billing/index.tsx`) — annotate only those specific files
- **Globs** (e.g., `src/pages/billing/**/*.tsx`) — expand the glob and annotate matching files

When paths are provided:
1. **Route tracing is scoped** — only trace routes that lead to components under the given paths. Do NOT scan the entire route tree.
2. **Manifest is merged** — if a manifest already exists, merge new action entries into it. Do not remove entries for actions outside the scoped paths.
3. **Pages section** — only add/update page entries for routes whose components are within the scoped paths.

When no arguments are given, behave exactly as before (full site annotation).

## Step 0: Detect project type

Read `package.json` and scan for config files to determine the framework:

| Signal | Type |
|--------|------|
| `vite.config.*` or `next.config.*` + React deps | **React SPA** |
| `.vue` files, `nuxt.config.*` | **Vue SPA** |
| `.svelte` files | **Svelte** |
| Plain `.html` files only | **Static HTML** |

Note the dev server port (check `vite.config.*`, `package.json` scripts, or `.env`).

**No packages need to be installed.** All annotations use standard `data-agent-*` HTML attributes that work natively in every framework. JSX, Vue templates, and Svelte all pass `data-*` attributes through to the DOM.

## Step 1: Trace the route tree to find rendered components

**Do NOT glob for all UI files and annotate them.** Instead, start from the router and trace which components are actually rendered:

1. Find the router entry point (see Step 2 table below)
2. For each route, follow the imports to the page/layout component
3. From each page component, follow imports to the child components that contain forms, tables, buttons, etc.
4. **Also trace layout/shell components** (root layout, navbar, sidebar, footer) for global actions: logout, theme toggle, notification controls, help menus, etc. These are available on every page and need annotation.
5. Only annotate components that are reachable from the route tree

**When paths are scoped** (arguments provided): Only trace routes whose page/layout components live under the given paths. For example, if the argument is `src/pages/billing`, find which routes point to components in `src/pages/billing/` and trace only those routes and their child components. Skip all routes outside the scope.

**CRITICAL — Do not annotate dead or legacy components.** Projects often have old components (e.g., `ChangePassword.tsx`) that are no longer imported anywhere in the route tree — a newer component (e.g., `PasswordEditor.tsx`) replaced them. If you annotate the dead component, the annotations are invisible because the component never renders. Always verify a component is imported and used by a route before annotating it.

## Step 2: Understand the routing

Determine how routes map to pages — this is critical for the manifest `pages` section:

| Router | Where to look |
|--------|--------------|
| **TanStack Router** (file-based) | `src/routes/` — file names are routes. `_layout/projects/index.tsx` → `/projects/`, `_layout/projects/$projectId.tsx` → `/projects/:id` |
| **React Router** | Look for `<Route path="...">` or `createBrowserRouter()` calls |
| **Next.js** | `app/` or `pages/` directory structure |
| **Vue Router** | `router/index.ts` or Nuxt `pages/` directory |
| **Plain HTML** | File paths relative to public root |

List **every navigable route**, including sub-routes. Do NOT group sub-routes under a parent — list each one individually. For example, if settings has tabs for profile, privacy, and appearance, list `/settings/profile`, `/settings/privacy`, `/settings/appearance` as separate pages, not just `/settings`. The manifest `pages` section is the LLM's only source of truth for navigation when sidebar links are collapsed or conditionally rendered.

## Step 3: Add `data-agent-*` attributes

Use raw `data-agent-*` attributes everywhere. They work in HTML, JSX, Vue templates, and Svelte without any imports or dependencies.

**CRITICAL — `data-agent-kind` is REQUIRED on every annotated element.** The runtime discovers elements via `querySelectorAll('[data-agent-kind="action"]')`, `[data-agent-kind="field"]`, `[data-agent-kind="collection"]`, etc. Without `data-agent-kind`, the element is invisible — `data-agent-action` or `data-agent-field` alone do NOTHING.

Every element you annotate must have BOTH:
1. `data-agent-kind="<type>"` — where type is `action`, `field`, `status`, `collection`, `item`, `link`, or `dialog`
2. The type-specific attribute — `data-agent-action`, `data-agent-field`, `data-agent-output`, etc.

**CRITICAL — HTML attribute is `data-agent-danger`, NOT `data-agent-risk`.** The manifest JSON uses `"risk"` as the key name, but the DOM attribute is `data-agent-danger`. Do NOT use `data-agent-risk` — that attribute does not exist and will be silently ignored.

### Actions (forms)

Wrap the outermost form or container with action attributes:

```tsx
{/* React / JSX */}
<form
  data-agent-kind="action"
  data-agent-action="project.create"
  data-agent-scope="projects.write"
  data-agent-danger="low"
  data-agent-confirm="optional"
  onSubmit={handleSubmit(onSubmit)}
>
  {/* fields */}
  <Button type="submit" data-agent-kind="action" data-agent-action="project.create.submit">
    Create
  </Button>
</form>
```

**If the form lives inside a modal** (HeroUI Modal, MUI Dialog, Chakra Modal, etc.), put the action attributes on a wrapper `<div>` around the modal body and footer:

```tsx
<Modal>
  <ModalContent>
    <ModalHeader>Create Project</ModalHeader>
    <div data-agent-kind="action" data-agent-action="project.create" data-agent-scope="projects.write">
      <ModalBody>
        {/* fields */}
      </ModalBody>
      <ModalFooter>
        <Button type="submit" data-agent-kind="action" data-agent-action="project.create.submit">
          Create
        </Button>
      </ModalFooter>
    </div>
  </ModalContent>
</Modal>
```

**Naming rules:**
- Action names use **dot notation**: `<resource>.<verb>` (e.g., `project.create`, `user.update`, `workspace.delete`)
- Submit sub-actions add a third segment: `project.create.submit`
- Scope follows `<resource>.<read|write|delete>` convention

### Fields

The key challenge in React: component libraries wrap `<input>` inside custom components (`<Input>`, `<Select>`, `<Textarea>`).

**Preferred approach: add `data-agent-*` directly to the component library's input.**

Most component libraries (HeroUI, Radix, Headless UI, Chakra) forward `data-*` attributes to the underlying DOM element:

```tsx
<Input
  {...register("name", { required: "Name is required" })}
  data-agent-kind="field"
  data-agent-field="project_name"
/>
```

**If the component strips `data-*` attributes** (check rendered DOM in dev tools), wrap it:

```tsx
<div data-agent-kind="field" data-agent-field="project_name">
  <Input {...register("name", { required: "Name is required" })} />
</div>
```

**MUI special case**: use `inputProps` to reach the DOM element:

```tsx
<TextField
  inputProps={{
    "data-agent-kind": "field",
    "data-agent-field": "project_name",
  }}
/>
```

**Naming rules:**
- Field names are **snake_case**: `customer_email`, `total_amount`, `due_date`
- Fields inside a `data-agent-kind="action"` element are automatically linked to that action
- Fields outside the action's DOM subtree need `data-agent-for-action="project.create"`
- Each (action, field) pair must resolve to exactly **one** DOM element

### Interactive controls (non-form actions)

**Not all actions are form submissions.** Any interactive control that changes what the user sees — dropdowns, toggles, tabs, filters, sort controls — should also be annotated. If a user might ask an agent to interact with it, annotate it.

Wrap the control in an action container and mark the interactive element as a field, just like a form field. The runtime will find the underlying `<select>`, `<input>`, or clickable element and interact with it:

```tsx
{/* A dropdown that changes page state (no form, no submit button) */}
<div
  data-agent-kind="action"
  data-agent-action="chart.change_metric"
  data-agent-scope="analytics.read"
  data-agent-danger="none"
  data-agent-confirm="never"
>
  <div data-agent-kind="field" data-agent-field="metric_type">
    <Select onSelectionChange={handleChange}>
      <SelectItem key="cost">Cost</SelectItem>
      <SelectItem key="tokens">Tokens</SelectItem>
    </Select>
  </div>
</div>
```

**Key differences from form actions:**
- Use `data-agent-danger="none"` and `data-agent-confirm="never"` for read-only view controls
- No submit button — the runtime triggers the control's change event directly
- In the manifest, use `"risk": "none"` and `"confirmation": "never"`, and mark as `"idempotent": true`
- Use `enum` in `inputSchema` to list valid values so the LLM picks correctly

**What to scan for during annotation:** When tracing a page's components, look for `<Select>`, `<Dropdown>`, `<Switch>`, `<Tabs>`, `<RadioGroup>`, `<ToggleGroup>`, date pickers, sort controls, and similar interactive elements that are NOT inside forms. If changing the control changes what data is displayed or how it's rendered, annotate it.

### Danger and confirmation

For destructive or risky actions, add `data-agent-danger` and `data-agent-confirm`:

```tsx
{/* Dangerous action — note: HTML attribute is "danger", NOT "risk" */}
<button
  data-agent-kind="action"
  data-agent-action="workspace.delete"
  data-agent-danger="high"
  data-agent-confirm="required"
>
  Delete Workspace
</button>
```

- `data-agent-danger`: `"none"` | `"low"` | `"high"`. **The manifest JSON calls this `"risk"` but the HTML attribute is `data-agent-danger`.**
- `data-agent-confirm`: `"never"` | `"optional"` (auto-submit) | `"review"` (fill only, user submits) | `"required"` (blocked without consent)

### Data tables and lists

Wrap the table or list container with collection attributes. If you can't add attributes to the component library's `<Table>` directly, wrap it in a `<div>`:

```tsx
<div data-agent-kind="collection" data-agent-action="project.list" data-agent-scope="projects.read">
  <Table>
    <TableBody>
      {projects.map(p => (
        <TableRow key={p.id} data-agent-kind="item">
          <TableCell>{p.name}</TableCell>
          <TableCell>{p.status}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

### Status elements

Add a status element near the form that reflects mutation state:

```tsx
<div
  data-agent-kind="status"
  data-agent-output="project.create.status"
  role="status"
  aria-live="polite"
>
  {mutation.isSuccess ? 'Project created successfully' : ''}
  {mutation.isError ? mutation.error.message : ''}
</div>
```

### Global actions (navbar, layout)

Actions that live in persistent layout elements (navbar, sidebar, footer) and are available on every page. Common examples: **logout**, **theme toggle**, **notification dismiss**, **help toggle**.

```tsx
{/* Logout button in navbar */}
<Button
  onPress={logout}
  data-agent-kind="action"
  data-agent-action="session.logout"
  data-agent-scope="session.write"
  data-agent-confirm="never"
  data-agent-idempotent="true"
>
  Logout
</Button>
```

**What to scan for:** When tracing the route tree, also check layout/shell components (root layout, navbar, sidebar, footer). Look for logout buttons, theme switchers, notification controls, user menu actions, and any other interactive elements that appear on every page.

**Manifest rules for global actions:**
- Add the action to the manifest `actions` section like any other action
- No need to add it to every page's `actions` array — the semantic parser discovers it from the DOM on whatever page the user is currently on
- Use `"risk": "none"`, `"confirmation": "never"`, `"idempotent": true` for session/toggle actions
- Use `"additionalProperties": false` with empty `properties` for zero-field actions (like logout)

### Navigation links

```tsx
{/* Link component — href/to becomes the target */}
<Link to="/projects" data-agent-kind="link">Projects</Link>

{/* Non-anchor navigation (button that calls navigate()) */}
<Button
  onClick={() => navigate({ to: '/settings' })}
  data-agent-kind="link"
  data-agent-page="/settings/"
>
  Settings
</Button>
```

For `<a>` tags, the target is derived from `href`. For non-anchor elements, `data-agent-page` is required.

**CRITICAL — Keep link text clean for LLM matching.** Place `data-agent-kind="link"` on the element whose `textContent` is the item's name, NOT on a wrapper that includes extra stats or metadata. The LLM matches user requests like "go to my default project" against the link's text. Noisy text (e.g., "default 1,234 tokens 100% 50 events") makes matching unreliable for small models.

```tsx
{/* GOOD — link text is just the project name */}
<Link to={`/projects/${id}`}>
  <Card>
    <span data-agent-kind="link" data-agent-page={`/projects/${id}`}>
      {project.name}
    </span>
    <span>{project.stats}</span>  {/* not included in link text */}
  </Card>
</Link>

{/* BAD — link text includes all card content */}
<Link to={`/projects/${id}`} data-agent-kind="link">
  <Card>
    <span>{project.name}</span>
    <span>{project.stats}</span>  {/* pollutes link text */}
  </Card>
</Link>
```

### Plain HTML example (for reference)

```html
<form data-agent-kind="action" data-agent-action="invoice.create" data-agent-scope="invoices.write">
  <input data-agent-kind="field" data-agent-field="customer_email" type="email" required aria-label="Customer email" />
  <input data-agent-kind="field" data-agent-field="amount" type="number" min="0" step="0.01" required />
  <select data-agent-kind="field" data-agent-field="currency" aria-label="Currency">
    <option value="EUR">EUR</option>
    <option value="USD">USD</option>
  </select>
  <button data-agent-kind="action" data-agent-action="invoice.create.submit">Create Invoice</button>
  <div data-agent-kind="status" data-agent-output="invoice.create.status"></div>
</form>
```

## Step 4: Generate the manifest

Create or update `public/.well-known/agent-manifest.json`.

**When paths are scoped:** If a manifest already exists, read it first and merge. Add/update entries for actions discovered in the scoped files, but leave existing entries for other actions untouched. This enables incremental annotation — annotate one section at a time without losing previous work.

**Before writing the manifest, read these source-of-truth files.** If running inside the AAF repo, use the local paths. Otherwise, fetch from GitHub:

1. **Schema** — The full JSON Schema defining all required/optional fields, types, and constraints for the manifest.
   - Local: `schemas/agent-manifest.schema.json`
   - GitHub: https://github.com/agpituk/aaf/blob/main/schemas/agent-manifest.schema.json
2. **Reference example (simple)** — A small working manifest with 2 actions and 1 data view.
   - Local: `samples/billing-app/public/.well-known/agent-manifest.json`
   - GitHub: https://github.com/agpituk/aaf/blob/main/samples/billing-app/public/.well-known/agent-manifest.json
3. **Reference example (comprehensive)** — A full manifest with 5 actions, 3 data views, 5 pages, handoff, and `x-semantic` usage.
   - Local: `samples/real-world-app/public/.well-known/agent-manifest.json`
   - GitHub: https://github.com/agpituk/aaf/blob/main/samples/real-world-app/public/.well-known/agent-manifest.json
4. **Spec** — The full AAF standard including element resolution order (§6.1.1), risk/confirmation tiers, and conformance rules.
   - Local: `docs/02-standard-spec.md`
   - GitHub: https://github.com/agpituk/aaf/blob/main/docs/02-standard-spec.md

**Derive routes from the router**, not from file paths. Each page entry maps a route to its available actions and data views.

**CRITICAL — List every navigable sub-route individually.** Do NOT collapse sub-routes under a parent. If `/settings` has child routes `/settings/profile`, `/settings/privacy`, `/settings/appearance`, each one needs its own entry in `pages`. The manifest is the LLM's primary navigation source — missing sub-routes cause the LLM to hallucinate incorrect paths (e.g., `/profile` instead of `/settings/profile`).

**Schema rules:**
- `inputSchema` must list every annotated field as a property with correct JSON Schema type
- Use `x-semantic` for known types: `schema.org/email`, `schema.org/telephone`, `schema.org/URL`, `schema.org/price`, `schema.org/name`, `schema.org/Date`, etc.
- Infer `required` from: react-hook-form validation rules (`{ required: ... }`), Zod schemas (`.min(1)`, no `.optional()`), HTML `required` attribute
- Number fields: include `minimum`, `maximum`, `multipleOf` where validation rules exist
- String fields: include `pattern`, `minLength`, `maxLength` from validation rules
- For modal forms: the action belongs to the page route where the modal trigger lives

**Cross-site handoff (optional):** If an action completes by handing off to an external service (e.g., creating a Stripe checkout session), add the `handoff` property:
```json
{
  "handoff": {
    "target": "https://checkout.stripe.com",
    "targetAction": "checkout.complete",
    "fieldMap": { "session_id": "session_id" }
  }
}
```
See `docs/09-multi-agent-handoff.md` for the full protocol and `schemas/agent-manifest.schema.json` for the schema.

## Step 4b: Generate llms.txt (optional but recommended)

Generate a `llms.txt` file so AI crawlers and agents can discover the site's capabilities:

```bash
# Inside the AAF repo:
npx tsx packages/agentgen/src/cli.ts \
  --manifest <project>/public/.well-known/agent-manifest.json \
  --llms-txt \
  --output <project>/public/
```

This creates `public/llms.txt` with action summaries, data view descriptions, and a link to the manifest. Deploy it at the site root (`/llms.txt`). See `packages/agentgen/src/llms-txt-generator.ts` for the format.

## Step 5: Automated verification loop

After annotating all files and generating the manifest, verify against the **rendered DOM** using the AAF linter. This catches issues that source-code inspection misses: component libraries stripping `data-*` attributes, unannotated interactive elements, and missing manifest entries.

1. **Ensure the dev server is running** (or start it with the project's dev command).

2. **Run the per-page audit.** If running inside the AAF repo, use the local linter path. Otherwise, use the path to wherever `aaf-lint` is installed:
   ```bash
   npx tsx packages/aaf-lint/src/cli.ts \
     --audit-pages <dev-server-url> \
     --manifest <project>/public/.well-known/agent-manifest.json \
     --safety
   ```
   This renders each static page from the manifest with Playwright, runs the accessibility audit on the rendered HTML, and checks that every action/field listed in the manifest for that page actually exists in the DOM.

3. **For each page with issues, fix the root cause:**
   - **Unannotated fields** (`<select>`, `<input>`, `<textarea>` without `data-agent-field`): Add `data-agent-*` annotations. If the component library strips `data-*` props (the source looks correct but the rendered DOM has nothing), wrap the component in a `<div>` with the attributes instead.
   - **Missing manifest entries**: Add actions/fields to the manifest's `pages` section, or remove stale entries that reference actions no longer on that page.
   - **Unannotated links** (`<a>` without `data-agent-kind="link"`): Add `data-agent-kind="link"` and `data-agent-page` where needed.
   - **Safety issues** (dangerous buttons without `data-agent-danger` + `data-agent-confirm`): Add both attributes.

4. **Re-run step 2.** Repeat until all pages pass (or only parameterized routes remain, which are skipped).

5. **Final sanity check** — grep for common mistakes that the linter may not catch:
   - `data-agent-risk` (should be `data-agent-danger`)
   - `data-agent-action` without `data-agent-kind` on the same element
   - Duplicate `data-agent-field` values within the same action scope

## Step 6: Verify the rendered DOM

Step 5's `--audit-pages` mode already renders each page with Playwright and checks the DOM programmatically. If all pages pass, no further manual verification is needed.

For **parameterized routes** (e.g., `/projects/:projectId`) that `--audit-pages` skips, or if you want to spot-check a specific page, you can audit a single rendered URL:
```bash
npx tsx packages/aaf-lint/src/cli.ts \
  --audit <url> --render --safety \
  --manifest <project>/public/.well-known/agent-manifest.json
```

If a `data-agent-*` attribute is present in source but missing from the rendered DOM:
1. Check if the component forwards `data-*` props (most do — HeroUI, Radix, Headless UI all work)
2. If not, wrap the component in a `<div>` with the agent attributes instead
3. For MUI, use `inputProps` / `slotProps` to reach the DOM element

## Reference

Read these files as needed for authoritative definitions. Use local paths inside the AAF repo, otherwise fetch from GitHub.

| Resource | Local | GitHub |
|----------|-------|--------|
| Manifest JSON Schema | `schemas/agent-manifest.schema.json` | [agent-manifest.schema.json](https://github.com/agpituk/aaf/blob/main/schemas/agent-manifest.schema.json) |
| AAF Standard Spec | `docs/02-standard-spec.md` | [02-standard-spec.md](https://github.com/agpituk/aaf/blob/main/docs/02-standard-spec.md) |
| Security Threat Model | `docs/06-security-threat-model.md` | [06-security-threat-model.md](https://github.com/agpituk/aaf/blob/main/docs/06-security-threat-model.md) |
| Reference manifest (simple) | `samples/billing-app/public/.well-known/agent-manifest.json` | [agent-manifest.json](https://github.com/agpituk/aaf/blob/main/samples/billing-app/public/.well-known/agent-manifest.json) |
| Reference manifest (full) | `samples/real-world-app/public/.well-known/agent-manifest.json` | [agent-manifest.json](https://github.com/agpituk/aaf/blob/main/samples/real-world-app/public/.well-known/agent-manifest.json) |
| Form + fields example | `samples/billing-app/invoices-new.html` | [invoices-new.html](https://github.com/agpituk/aaf/blob/main/samples/billing-app/invoices-new.html) |
| Data view example | `samples/billing-app/invoices.html` | [invoices.html](https://github.com/agpituk/aaf/blob/main/samples/billing-app/invoices.html) |
| Dangerous action example | `samples/billing-app/settings.html` | [settings.html](https://github.com/agpituk/aaf/blob/main/samples/billing-app/settings.html) |
| Multi-page app (5 pages, refactored) | `samples/real-world-app/` | [real-world-app](https://github.com/agpituk/aaf/tree/main/samples/real-world-app) |
| Handoff protocol | `docs/09-multi-agent-handoff.md` | [09-multi-agent-handoff.md](https://github.com/agpituk/aaf/blob/main/docs/09-multi-agent-handoff.md) |
| WebMCP bridge | `packages/aaf-webmcp-bridge/` | [aaf-webmcp-bridge](https://github.com/agpituk/aaf/tree/main/packages/aaf-webmcp-bridge) |

## Important constraints

- **NEVER use CSS selectors** in agent contracts — only semantic `data-agent-*` names
- **NEVER modify visual styling** — AAF attributes are invisible to users
- **Preserve all existing functionality** — only add agent annotations, do not restructure components
- **snake_case for fields**, **dot.notation for actions**
- **Nested-first resolution**: fields inside an action element are auto-linked. Use `data-agent-for-action` only for fields outside the action's DOM subtree (spec §6.1.1).
- **No duplicate fields**: each (action, field) pair must resolve to exactly one DOM element
- Every action in the manifest must map to a page in `pages`
- Every field in `inputSchema.properties` must have a corresponding annotated element in the UI

## Optional: WebMCP bridge

For sites targeting Chrome 146+ with `navigator.modelContext` (WebMCP), the AAF-to-WebMCP bridge auto-registers all manifest actions as MCP tools. Add the bridge script after the widget:

```html
<script type="module">
  import { registerAAFTools } from '@agent-accessibility-framework/webmcp-bridge';
  const manifest = await fetch('/.well-known/agent-manifest.json').then(r => r.json());
  registerAAFTools(manifest);
</script>
```

See `packages/aaf-webmcp-bridge/` for the API.

## Conformance levels

AAF defines three conformance tiers (see `docs/06-security-threat-model.md`):

1. **Annotated (Level 1)** — `data-agent-*` attributes on all interactive elements. No manifest required.
2. **Manifested (Level 2)** — Full `/.well-known/agent-manifest.json` with schemas, pages, and risk/confirmation metadata.
3. **Certified (Level 3)** — Passes `aaf-lint --audit-pages --safety`, has `llms.txt`, origin trust configured.

After completing annotation, the project should be at least Level 2. Run the linter audit (Step 5) to verify.
