# AAF Annotate — Linter-Driven Agent Accessibility Annotation

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

## Step 0: Detect project type, trace routes, and start dev server

### Framework detection

Read `package.json` and scan for config files to determine the framework:

| Signal | Type |
|--------|------|
| `vite.config.*` or `next.config.*` + React deps | **React SPA** |
| `.vue` files, `nuxt.config.*` | **Vue SPA** |
| `.svelte` files | **Svelte** |
| Plain `.html` files only | **Static HTML** |

Note the dev server port (check `vite.config.*`, `package.json` scripts, or `.env`).

**No packages need to be installed.** All annotations use standard `data-agent-*` HTML attributes that work natively in every framework. JSX, Vue templates, and Svelte all pass `data-*` attributes through to the DOM.

### Route tracing

**Do NOT glob for all UI files and annotate them.** Instead, start from the router and trace which components are actually rendered:

1. Find the router entry point (see routing table below)
2. For each route, follow the imports to the page/layout component
3. From each page component, follow imports to the child components that contain forms, tables, buttons, etc.
4. **Also trace layout/shell components** (root layout, navbar, sidebar, footer) for **global navigation links AND global actions**: sidebar nav items, navbar links, logo links, logout buttons, theme toggles, notification controls, help menus, etc. These are available on every page and need annotation. Navigation links in layout components are **critical** — without them the agent has no way to navigate between pages.
5. Only annotate components that are reachable from the route tree

**When paths are scoped** (arguments provided): Only trace routes whose page/layout components live under the given paths. For example, if the argument is `src/pages/billing`, find which routes point to components in `src/pages/billing/` and trace only those routes and their child components. Skip all routes outside the scope.

**CRITICAL — Do not annotate dead or legacy components.** Projects often have old components (e.g., `ChangePassword.tsx`) that are no longer imported anywhere in the route tree — a newer component (e.g., `PasswordEditor.tsx`) replaced them. If you annotate the dead component, the annotations are invisible because the component never renders. Always verify a component is imported and used by a route before annotating it.

### Routing table

Determine how routes map to pages — this is critical for the manifest `pages` section:

| Router | Where to look |
|--------|--------------|
| **TanStack Router** (file-based) | `src/routes/` — file names are routes. `_layout/projects/index.tsx` → `/projects/`, `_layout/projects/$projectId.tsx` → `/projects/:id` |
| **React Router** | Look for `<Route path="...">` or `createBrowserRouter()` calls |
| **Next.js** | `app/` or `pages/` directory structure |
| **Vue Router** | `router/index.ts` or Nuxt `pages/` directory |
| **Plain HTML** | File paths relative to public root |

List **every navigable route**, including sub-routes. Do NOT group sub-routes under a parent — list each one individually. For example, if settings has tabs for profile, privacy, and appearance, list `/settings/profile`, `/settings/privacy`, `/settings/appearance` as separate pages, not just `/settings`. The manifest `pages` section is the LLM's only source of truth for navigation when sidebar links are collapsed or conditionally rendered.

### Start the dev server

Ensure the dev server is running (or start it with the project's dev command). The linter needs the rendered DOM to audit.

## Step 1: Linter baseline scan

**Run the linter BEFORE touching any source file.** This produces a structured gap report that becomes the work list for all subsequent steps.

```bash
npx tsx packages/aaf-lint/src/cli.ts \
  --audit-pages <dev-server-url> \
  --manifest <project>/public/.well-known/agent-manifest.json \
  --safety
```

If running outside the AAF repo, use the installed path to `aaf-lint` instead.

If no manifest exists yet, run with just `--audit-pages <dev-server-url> --safety` (skip `--manifest`). The linter will still report unannotated interactive elements.

### Parse the output into a work list

Each detail string from the linter maps to a work item. **Classify every item as DETERMINISTIC or SEMANTIC** using this decision matrix:

| Linter gap | Deterministic fix | Needs LLM? |
|---|---|---|
| `<input name="X"> — no field` | `kind="field" field="X"` (snake_case the name) | No |
| `<input type="..."> — no field` (no `name` attr) | `kind="field"` only | Yes (needs a name) |
| `<a href="..."> — no link` | `kind="link"` (target derived from href) | No |
| `<button> "Text" — no action` | `kind="action"` only | Yes (needs action name) |
| `N forms missing data-agent-action` | `kind="action"` on `<form>` | Yes (needs action name) |
| Button "X" dangerous — missing danger/confirm | Nothing deterministic | Yes (risk + policy) |
| Manifest alignment gap | Depends on gap type | Maybe |

**Rule: if the value can be derived from existing HTML attributes with a fixed algorithm, it's DETERMINISTIC. If it requires understanding what the element DOES, it's SEMANTIC.**

### Authenticated apps

By default, `--audit-pages` visits each route as an unauthenticated user. If the app redirects to a login page, the linter never sees pages behind auth. Use auth flags to inject session credentials into the headless browser:

```bash
# Option 1: Playwright storage state file (most complete — cookies + localStorage + sessionStorage)
npx tsx packages/aaf-lint/src/cli.ts \
  --audit-pages <dev-server-url> \
  --manifest <project>/public/.well-known/agent-manifest.json \
  --auth-storage-state ./auth-state.json \
  --safety

# Option 2: Individual cookies (e.g., JWT token)
npx tsx packages/aaf-lint/src/cli.ts \
  --audit-pages <dev-server-url> \
  --manifest <project>/public/.well-known/agent-manifest.json \
  --auth-cookie "access_token=eyJ..." \
  --safety

# Option 3: localStorage entries (e.g., token-based auth)
npx tsx packages/aaf-lint/src/cli.ts \
  --audit-pages <dev-server-url> \
  --manifest <project>/public/.well-known/agent-manifest.json \
  --auth-local-storage "token=eyJ..." \
  --safety
```

**Generating a Playwright storage state file:**
1. Log in to the app manually in a Playwright browser
2. Save the state: `await context.storageState({ path: './auth-state.json' })`
3. Or capture it from browser dev tools: export cookies + localStorage as JSON

Auth flags also work with `--audit --render` for single-page audits.

**If you cannot obtain auth credentials**, fall back to the source-level linter on layout/shell files (Step 2) and manually check global navigation (Step 4).

## Step 2: Deterministic pass — mechanical fixes only

Process every DETERMINISTIC work item from Step 1. These fixes require zero judgment:

### Links
Add `data-agent-kind="link"` to every `<a>` element the linter flagged. The target is derived from the `href` attribute — no naming decision needed.

### SPA router navigation components

Run the source-level linter on layout/shell component files to detect unannotated router links (`<Link to="...">`, `<RouterLink to="...">`, `<NavLink to="...">`, `<NuxtLink to="...">`):

```bash
npx tsx packages/aaf-lint/src/cli.ts src/components/Sidebar.tsx src/components/Navbar.tsx
```

Fix every `<Link to="..."> missing data-agent-kind="link"` warning. Two patterns:

1. **Simple link** — add `data-agent-kind="link"` directly to the `<Link>` component.
2. **Card/wrapper with mixed content** — if the `<Link>` wraps a Card or container with extra text (stats, metadata), put `data-agent-kind="link"` on the **inner element whose `textContent` is the item's name** and add `data-agent-page` with the target URL. This keeps link text clean for LLM matching. See [Navigation links](#navigation-links) in the Reference Appendix.

```tsx
{/* Card with mixed content — annotate inner element for clean text */}
<Link to="/projects/$projectId" params={{ projectId: id }}>
  <Card>
    <span data-agent-kind="link" data-agent-page={`/projects/${id}/`}>
      {project.name}
    </span>
    <span>{project.stats}</span>  {/* not included in link text */}
  </Card>
</Link>
```

**Always run this in addition to `--audit-pages`** — the DOM auditor cannot reach authenticated pages and will miss these entirely.

Also manually check for patterns the source linter cannot catch:
- `<Button as={Link}>` or component wrappers around router links
- `navigate()` calls on clickable elements (add `data-agent-kind="link"` + `data-agent-page="/target"`)
- Vue `<router-link>` (lowercase)

Without link annotations on navigation components, the agent widget discovers zero routes and cannot navigate between pages.

### Fields with `name` attribute
For every `<input>`, `<select>`, or `<textarea>` that has a `name` attribute but no `data-agent-field`:
1. Convert the `name` value to snake_case → use as `data-agent-field`
2. Add `data-agent-kind="field"`

```tsx
{/* Before */}
<Input {...register("customerEmail")} />

{/* After — name "customerEmail" → snake_case "customer_email" */}
<Input
  {...register("customerEmail")}
  data-agent-kind="field"
  data-agent-field="customer_email"
/>
```

### Forms without action annotation
Add `data-agent-kind="action"` to `<form>` tags that the linter flagged. Do NOT assign an action name yet — that's a semantic decision deferred to Step 4.

### Submit buttons inside named actions
If a submit button lives inside a form that already has `data-agent-action="X"`, the button gets `data-agent-kind="action"` and `data-agent-action="X.submit"`.

### What NOT to do in this step
- Do NOT invent action names (`data-agent-action`) — those require semantic understanding
- Do NOT assign danger/confirm levels — those require risk assessment
- Do NOT name fields that lack a `name` attribute — those need LLM judgment
- Do NOT add `data-agent-scope` — that depends on action semantics

## Step 3: Re-run linter — checkpoint

Re-run the exact same linter command from Step 1:

```bash
npx tsx packages/aaf-lint/src/cli.ts \
  --audit-pages <dev-server-url> \
  --manifest <project>/public/.well-known/agent-manifest.json \
  --safety
```

**Expected:** The score should have improved — all the mechanical link and named-field gaps should be resolved.

**Parse the remaining gaps.** Everything still reported is the SEMANTIC work list for Step 4. These are the items that genuinely need LLM judgment.

## Step 4: Semantic pass — LLM judgment on remaining gaps

For each remaining gap from Step 3, apply semantic understanding. Refer to the [Reference Appendix](#reference-appendix) for annotation patterns and examples.

### Action naming
Read the form's fields, submit button text, and surrounding context to choose a `verb.resource` name:
- Action names use **dot notation**: `<resource>.<verb>` (e.g., `project.create`, `user.update`, `workspace.delete`)
- Submit sub-actions add a third segment: `project.create.submit`
- Scope follows `<resource>.<read|write|delete>` convention

### Field naming without `name` attribute
When an input has no `name` attribute, derive the field name from (in priority order):
1. `aria-label` text
2. `placeholder` text
3. Associated `<label>` text
4. Positional context (e.g., first input in a "billing address" section → `billing_address_line_1`)

All field names are **snake_case**: `customer_email`, `total_amount`, `due_date`.

### Danger classification
Assign `data-agent-danger` based on action semantics:
- **`high`**: delete, destroy, remove, purge, reset, revoke, terminate
- **`low`**: archive, suspend, disable, update (data mutation)
- **`none`**: view controls, read-only interactions, navigation

**CRITICAL — HTML attribute is `data-agent-danger`, NOT `data-agent-risk`.** The manifest JSON uses `"risk"` as the key name, but the DOM attribute is `data-agent-danger`. Do NOT use `data-agent-risk` — that attribute does not exist and will be silently ignored.

### Confirmation policy
Assign `data-agent-confirm` based on danger level:
- **`required`**: high-danger actions (blocked without user consent)
- **`review`**: low-danger mutations (fill only, user submits manually)
- **`optional`**: safe creates/updates (auto-submit allowed)
- **`never`**: read-only controls, navigation, idempotent toggles

### Interactive controls (non-form actions)
Scan for `<Select>`, `<Dropdown>`, `<Switch>`, `<Tabs>`, `<RadioGroup>`, `<ToggleGroup>`, date pickers, sort controls, and similar interactive elements that are NOT inside forms. If changing the control changes what data is displayed or how it's rendered, annotate it as an action + field. See [Interactive controls](#interactive-controls-non-form-actions-1) in the Reference Appendix.

### Data views vs. actions
Tables and lists that display data without mutation:
- If it's a read-only list/table → data view (manifest `data` section, not DOM annotation)
- If rows have inline edit/delete controls → collection with action items

### Global navigation links (layout components)
**Before looking at actions, annotate ALL navigation links in layout/shell components.** Scan the sidebar, navbar, and footer for every `<Link>`, `<RouterLink>`, `<NavLink>`, or programmatic `navigate()` call and add `data-agent-kind="link"`. These are the agent's primary way to navigate between pages. See [Navigation links](#navigation-links) in the Reference Appendix.

### Global actions (layout components)
Check layout/shell components (root layout, navbar, sidebar, footer) for logout buttons, theme switchers, notification controls, user menu actions. These need action annotations even though they're not form-based. See [Global actions](#global-actions-navbar-layout) in the Reference Appendix.

### `data-agent-kind` is REQUIRED

**CRITICAL — `data-agent-kind` is REQUIRED on every annotated element.** The runtime discovers elements via `querySelectorAll('[data-agent-kind="action"]')`, `[data-agent-kind="field"]`, etc. Without `data-agent-kind`, the element is invisible — `data-agent-action` or `data-agent-field` alone do NOTHING.

Every element you annotate must have BOTH:
1. `data-agent-kind="<type>"` — where type is `action`, `field`, `status`, `collection`, `item`, `link`, or `dialog`
2. The type-specific attribute — `data-agent-action`, `data-agent-field`, `data-agent-output`, etc.

## Step 5: Generate/update manifest

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

### Generate llms.txt (optional but recommended)

Generate a `llms.txt` file so AI crawlers and agents can discover the site's capabilities:

```bash
# Inside the AAF repo:
npx tsx packages/agentgen/src/cli.ts \
  --manifest <project>/public/.well-known/agent-manifest.json \
  --llms-txt \
  --output <project>/public/
```

This creates `public/llms.txt` with action summaries, data view descriptions, and a link to the manifest. Deploy it at the site root (`/llms.txt`). See `packages/agentgen/src/llms-txt-generator.ts` for the format.

## Step 6: Verification loop

Run the linter in a tight loop. **Max 3 iterations.** If all pages pass at 100% with zero alignment warnings, STOP.

1. **Run the per-page audit** (add auth flags if the app requires login — see Step 1):
   ```bash
   npx tsx packages/aaf-lint/src/cli.ts \
     --audit-pages <dev-server-url> \
     --manifest <project>/public/.well-known/agent-manifest.json \
     --safety
   ```

2. **Check the result:**
   - **All pages 100% + zero alignment warnings** → DONE. Skip to final sanity check.
   - **Gaps remain** → fix them (use the deterministic/semantic classification from Step 1) and re-run.

3. **Final sanity check** — grep for common mistakes the linter may not catch:
   - `data-agent-risk` (should be `data-agent-danger`)
   - `data-agent-action` without `data-agent-kind` on the same element
   - Duplicate `data-agent-field` values within the same action scope

4. **Run the source-level linter on layout/shell files** to check for unannotated router links (these are invisible to `--audit-pages` on authenticated apps):
   ```bash
   npx tsx packages/aaf-lint/src/cli.ts \
     src/components/**/Sidebar*.tsx src/components/**/Navbar*.tsx \
     src/components/**/Footer*.tsx src/components/**/Layout*.tsx
   ```
   Fix any `<Link to="..."> missing data-agent-kind="link"` warnings.

For **parameterized routes** (e.g., `/projects/:projectId`) that `--audit-pages` skips, or to spot-check a specific page:
```bash
npx tsx packages/aaf-lint/src/cli.ts \
  --audit <url> --render --safety \
  --manifest <project>/public/.well-known/agent-manifest.json \
  --auth-cookie "access_token=eyJ..."  # if auth required
```

If a `data-agent-*` attribute is present in source but missing from the rendered DOM:
1. Check if the component forwards `data-*` props (most do — HeroUI, Radix, Headless UI all work)
2. If not, wrap the component in a `<div>` with the agent attributes instead
3. For MUI, use `inputProps` / `slotProps` to reach the DOM element

## Step 7: Agent widget (optional)

**Ask the user:** "Would you like to embed the AAF agent chat widget? It adds a floating chat panel that lets users (or agents) interact with the annotated UI via natural language. Requires Ollama running locally."

If the user declines, skip this step entirely.

### Build the widget

If running inside the AAF repo:
```bash
cd packages/aaf-agent-widget && npm run build
```

This produces `packages/aaf-agent-widget/dist/aaf-agent.js` — a self-contained IIFE bundle with zero external dependencies.

### Copy the bundle into the project

Copy the built `aaf-agent.js` into the project's public/static asset directory:
```bash
cp packages/aaf-agent-widget/dist/aaf-agent.js <project>/public/aaf-agent.js
```

For projects outside the AAF repo, fetch the pre-built bundle from GitHub or build it separately.

### Add the script tags to `index.html`

Add **two** script blocks at the end of `<body>`, **after** the app's own `<script>` tag:

```html
<body>
  <div id="root"></div>
  <script type="module" src="./src/main.tsx"></script>

  <!-- AAF Agent Widget config -->
  <script>
    window.__AAF_CONFIG__ = {
      llm: {
        provider: 'ollama',
        baseUrl: 'http://localhost:11434',
        model: 'ibm/granite4:micro-h'
      }
    };
  </script>
  <script src="/aaf-agent.js"></script>
</body>
```

Adjust `model` to whatever Ollama model the user has pulled. Common choices: `ibm/granite4:micro-h` (fast, small), `llama3.2` (general), `qwen2.5-coder` (code-focused).

### SPA/React timing — already handled

**Do NOT add any custom "wait for React" logic.** The widget already handles SPA hydration timing internally:

1. On load, it checks for `[data-agent-kind]` elements in the DOM
2. If none exist yet (React hasn't rendered), it sets up a **MutationObserver** watching `document.body` with `{ childList: true, subtree: true }`
3. As soon as any `data-agent-kind` element appears, the observer fires and the widget initializes
4. **15-second timeout** — if no AAF elements appear within 15 seconds, the observer disconnects (prevents memory leaks on pages with no annotations)

This means the widget works correctly even when:
- React/Vue/Svelte hydrates asynchronously after the script loads
- Route transitions render new components after navigation
- Data fetching delays component rendering

For **cross-page navigation**, the widget also uses a MutationObserver (10-second timeout) to wait for specific action elements to appear on the target page before executing pre-planned actions.

### Verification

After adding the widget, reload the dev server and confirm:
1. The floating chat icon appears in the bottom-right corner
2. Opening the chat and typing a command (e.g., "what can I do here?") gets a response from Ollama
3. The widget discovers all annotated actions on the current page

## Reference Appendix

Annotation patterns and examples. The deterministic pass (Step 2) and semantic pass (Step 4) reference these by name.

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

**Not all actions are form submissions.** Any interactive control that changes what the user sees — dropdowns, toggles, tabs, filters, sort controls — should also be annotated.

Wrap the control in an action container and mark the interactive element as a field:

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

### Danger and confirmation

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

Wrap the table or list container with collection attributes:

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

Actions in persistent layout elements (navbar, sidebar, footer) available on every page:

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

**CRITICAL — Keep link text clean for LLM matching.** Place `data-agent-kind="link"` on the element whose `textContent` is the item's name, NOT on a wrapper that includes extra stats or metadata:

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

### Plain HTML example

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

After completing annotation, the project should be at least Level 2. Run the linter audit (Step 6) to verify.
