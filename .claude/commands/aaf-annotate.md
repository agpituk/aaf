# AAF Annotate — Add Agent Accessibility Framework annotations to a web project

You are annotating a web project with AAF (Agent Accessibility Framework) attributes so that browser agents can reliably operate the UI using semantic names instead of CSS selectors.

**Target directory:** $ARGUMENTS (default: current directory)

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

## Step 1: Find all UI files

Glob for `**/*.{html,jsx,tsx,vue,svelte}` in the target directory. Skip `node_modules/`, `dist/`, `build/`, `.next/`.

Focus on files that contain: forms, modals with inputs, data tables/lists, navigation menus, delete/destructive buttons.

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

- `data-agent-danger`: `"low"` | `"high"` (omit for none). **The manifest JSON calls this `"risk"` but the HTML attribute is `data-agent-danger`.**
- `data-agent-confirm`: `"optional"` (auto-submit) | `"review"` (fill only, user submits) | `"required"` (blocked without consent)

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

Create `public/.well-known/agent-manifest.json`.

**Before writing the manifest, read these source-of-truth files.** If running inside the AAF repo, use the local paths. Otherwise, fetch from GitHub:

1. **Schema** — The full JSON Schema defining all required/optional fields, types, and constraints for the manifest.
   - Local: `schemas/agent-manifest.schema.json`
   - GitHub: https://github.com/agpituk/aaf/blob/main/schemas/agent-manifest.schema.json
2. **Reference example** — A complete working manifest showing actions, data views, pages, errors, and `x-semantic` usage.
   - Local: `samples/billing-app/public/.well-known/agent-manifest.json`
   - GitHub: https://github.com/agpituk/aaf/blob/main/samples/billing-app/public/.well-known/agent-manifest.json
3. **Spec** — The full AAF standard including element resolution order (§6.1.1), risk/confirmation tiers, and conformance rules.
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

## Step 5: Self-validate

After annotating, verify correctness by checking these rules yourself (do NOT rely on external tools):

1. **Every annotated element has `data-agent-kind`** — grep the annotated files for `data-agent-action=`, `data-agent-field=`, `data-agent-output=` and confirm each one also has `data-agent-kind=` on the same element. Elements without `data-agent-kind` are invisible to the runtime.
2. **No `data-agent-risk` anywhere** — grep for `data-agent-risk`. If found, replace with `data-agent-danger`. The attribute `data-agent-risk` does not exist.
3. **Every action in the manifest** has a corresponding `data-agent-action` attribute in the UI files
4. **Every field in `inputSchema.properties`** has a corresponding `data-agent-field` attribute in the UI files
5. **Every collection/data view** has `data-agent-kind="collection"` — not just `data-agent-action`
6. **Every action maps to a page** in the manifest `pages` section
7. **No duplicate fields** — each (action, field) pair appears in exactly one place
8. **Action identifiers** use `lowercase.dot.notation` (e.g., `project.create`, not `ProjectCreate`)
9. **Field identifiers** use `snake_case` (e.g., `customer_email`, not `customerEmail`)
10. **Danger attributes are valid**: `data-agent-danger` is `"low"` or `"high"`, `data-agent-confirm` is `"optional"`, `"review"`, or `"required"`
11. **Non-anchor links** (`<button>`, `<div>`) with `data-agent-kind="link"` have a `data-agent-page` attribute

Report any issues found and fix them.

## Step 6: Verify the rendered DOM

After annotation, start the dev server and instruct the user to check in browser dev tools that the rendered HTML contains the expected `data-agent-*` attributes. Component libraries sometimes strip unknown props. If a `data-agent-*` attribute is missing from the DOM:
1. Check if the component forwards `data-*` props (most do — HeroUI, Radix, Headless UI all work)
2. If not, wrap the component in a `<div>` with the agent attributes instead
3. For MUI, use `inputProps` / `slotProps` to reach the DOM element

## Reference

Read these files as needed for authoritative definitions. Use local paths inside the AAF repo, otherwise fetch from GitHub.

| Resource | Local | GitHub |
|----------|-------|--------|
| Manifest JSON Schema | `schemas/agent-manifest.schema.json` | [agent-manifest.schema.json](https://github.com/agpituk/aaf/blob/main/schemas/agent-manifest.schema.json) |
| AAF Standard Spec | `docs/02-standard-spec.md` | [02-standard-spec.md](https://github.com/agpituk/aaf/blob/main/docs/02-standard-spec.md) |
| Reference manifest | `samples/billing-app/public/.well-known/agent-manifest.json` | [agent-manifest.json](https://github.com/agpituk/aaf/blob/main/samples/billing-app/public/.well-known/agent-manifest.json) |
| Form + fields example | `samples/billing-app/invoices-new.html` | [invoices-new.html](https://github.com/agpituk/aaf/blob/main/samples/billing-app/invoices-new.html) |
| Data view example | `samples/billing-app/invoices.html` | [invoices.html](https://github.com/agpituk/aaf/blob/main/samples/billing-app/invoices.html) |
| Dangerous action example | `samples/billing-app/settings.html` | [settings.html](https://github.com/agpituk/aaf/blob/main/samples/billing-app/settings.html) |

## Important constraints

- **NEVER use CSS selectors** in agent contracts — only semantic `data-agent-*` names
- **NEVER modify visual styling** — AAF attributes are invisible to users
- **Preserve all existing functionality** — only add agent annotations, do not restructure components
- **snake_case for fields**, **dot.notation for actions**
- **Nested-first resolution**: fields inside an action element are auto-linked. Use `data-agent-for-action` only for fields outside the action's DOM subtree (spec §6.1.1).
- **No duplicate fields**: each (action, field) pair must resolve to exactly one DOM element
- Every action in the manifest must map to a page in `pages`
- Every field in `inputSchema.properties` must have a corresponding annotated element in the UI
