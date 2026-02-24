import type { AgentManifest, AgentAction } from '@agent-native-web/runtime-core';

function toMethodName(actionId: string): string {
  return actionId
    .split('.')
    .map((part, i) => (i === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join('');
}

function toTypeName(actionId: string): string {
  return actionId
    .split('.')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

function toFlagName(field: string): string {
  return '--' + field.replace(/_/g, '-');
}

function generateInputInterface(actionId: string, action: AgentAction): string {
  const typeName = `${toTypeName(actionId)}Input`;
  const schema = action.inputSchema as {
    properties?: Record<string, { type?: string; format?: string; enum?: string[]; const?: string }>;
    required?: string[];
  };

  if (!schema.properties) return `export interface ${typeName} {}\n`;

  const lines: string[] = [`export interface ${typeName} {`];
  const required = new Set(schema.required || []);

  for (const [name, prop] of Object.entries(schema.properties)) {
    const optional = required.has(name) ? '' : '?';
    let tsType = 'unknown';
    if (prop.type === 'string') tsType = prop.enum ? prop.enum.map((e) => `'${e}'`).join(' | ') : 'string';
    else if (prop.type === 'number' || prop.type === 'integer') tsType = 'number';
    else if (prop.type === 'boolean') tsType = 'boolean';

    const jsdoc: string[] = [];
    if (prop.format) jsdoc.push(`@format ${prop.format}`);
    if (prop.const) jsdoc.push(`@const Must be "${prop.const}"`);
    if (jsdoc.length) {
      lines.push(`  /** ${jsdoc.join(' ')} */`);
    }
    lines.push(`  ${name}${optional}: ${tsType};`);
  }

  lines.push('}');
  return lines.join('\n') + '\n';
}

function generateOutputInterface(actionId: string, action: AgentAction): string {
  const typeName = `${toTypeName(actionId)}Output`;
  const schema = action.outputSchema as {
    properties?: Record<string, { type?: string; enum?: string[] }>;
    required?: string[];
  };

  if (!schema.properties) return `export interface ${typeName} {}\n`;

  const lines: string[] = [`export interface ${typeName} {`];
  const required = new Set(schema.required || []);

  for (const [name, prop] of Object.entries(schema.properties)) {
    const optional = required.has(name) ? '' : '?';
    let tsType = 'unknown';
    if (prop.type === 'string') tsType = prop.enum ? prop.enum.map((e) => `'${e}'`).join(' | ') : 'string';
    else if (prop.type === 'number' || prop.type === 'integer') tsType = 'number';
    else if (prop.type === 'boolean') tsType = 'boolean';
    lines.push(`  ${name}${optional}: ${tsType};`);
  }

  lines.push('}');
  return lines.join('\n') + '\n';
}

export function generateSDK(manifest: AgentManifest): Map<string, string> {
  const files = new Map<string, string>();

  // Generate types.ts
  let typesContent = '// Auto-generated types from agent manifest\n\n';
  for (const [actionId, action] of Object.entries(manifest.actions)) {
    typesContent += generateInputInterface(actionId, action);
    typesContent += '\n';
    typesContent += generateOutputInterface(actionId, action);
    typesContent += '\n';
  }
  files.set('types.ts', typesContent);

  // Generate client.ts
  let clientContent = `// Auto-generated client for ${manifest.site.name}\n`;
  clientContent += `// Origin: ${manifest.site.origin}\n\n`;

  // Import types
  const imports: string[] = [];
  for (const actionId of Object.keys(manifest.actions)) {
    imports.push(`${toTypeName(actionId)}Input`);
    imports.push(`${toTypeName(actionId)}Output`);
  }
  clientContent += `import type { ${imports.join(', ')} } from './types.js';\n\n`;

  // Action metadata
  clientContent += `export const MANIFEST_VERSION = '${manifest.version}';\n`;
  clientContent += `export const SITE_ORIGIN = '${manifest.site.origin}';\n\n`;

  clientContent += `export interface ActionMetadata {\n`;
  clientContent += `  title: string;\n`;
  clientContent += `  scope: string;\n`;
  clientContent += `  risk: 'none' | 'low' | 'high';\n`;
  clientContent += `  confirmation: 'never' | 'optional' | 'required';\n`;
  clientContent += `  idempotent: boolean;\n`;
  clientContent += `}\n\n`;

  // Client class
  clientContent += `export class ${manifest.site.name.replace(/\s+/g, '')}Client {\n`;
  clientContent += `  constructor(private readonly baseUrl: string = '${manifest.site.origin}') {}\n\n`;

  for (const [actionId, action] of Object.entries(manifest.actions)) {
    const methodName = toMethodName(actionId);
    const inputType = `${toTypeName(actionId)}Input`;
    const outputType = `${toTypeName(actionId)}Output`;

    // JSDoc
    clientContent += `  /**\n`;
    clientContent += `   * ${action.title}\n`;
    clientContent += `   * @scope ${action.scope}\n`;
    clientContent += `   * @risk ${action.risk}\n`;
    clientContent += `   * @confirmation ${action.confirmation}\n`;
    if (!action.idempotent) clientContent += `   * @warning Not idempotent\n`;
    clientContent += `   */\n`;
    clientContent += `  async ${methodName}(input: ${inputType}): Promise<${outputType}> {\n`;
    clientContent += `    // Direct mode: POST to action endpoint\n`;
    clientContent += `    const response = await fetch(\`\${this.baseUrl}/api/actions/${actionId}\`, {\n`;
    clientContent += `      method: 'POST',\n`;
    clientContent += `      headers: { 'Content-Type': 'application/json' },\n`;
    clientContent += `      body: JSON.stringify(input),\n`;
    clientContent += `    });\n`;
    clientContent += `    return response.json() as Promise<${outputType}>;\n`;
    clientContent += `  }\n\n`;

    clientContent += `  static ${methodName}Metadata: ActionMetadata = {\n`;
    clientContent += `    title: '${action.title}',\n`;
    clientContent += `    scope: '${action.scope}',\n`;
    clientContent += `    risk: '${action.risk}',\n`;
    clientContent += `    confirmation: '${action.confirmation}',\n`;
    clientContent += `    idempotent: ${action.idempotent},\n`;
    clientContent += `  };\n\n`;
  }

  clientContent += `}\n`;
  files.set('client.ts', clientContent);

  // Generate index.ts
  let indexContent = `export * from './types.js';\n`;
  indexContent += `export * from './client.js';\n`;
  files.set('index.ts', indexContent);

  return files;
}

export function generateCLI(manifest: AgentManifest): Map<string, string> {
  const files = new Map<string, string>();

  let cliContent = `#!/usr/bin/env node\n`;
  cliContent += `// Auto-generated CLI for ${manifest.site.name}\n\n`;

  cliContent += `const ACTIONS: Record<string, { title: string; flags: string[]; risk: string; confirmation: string }> = {\n`;
  for (const [actionId, action] of Object.entries(manifest.actions)) {
    const schema = action.inputSchema as { properties?: Record<string, unknown> };
    const flags = Object.keys(schema.properties || {}).map((f) => toFlagName(f));
    cliContent += `  '${actionId}': {\n`;
    cliContent += `    title: '${action.title}',\n`;
    cliContent += `    flags: [${flags.map((f) => `'${f}'`).join(', ')}],\n`;
    cliContent += `    risk: '${action.risk}',\n`;
    cliContent += `    confirmation: '${action.confirmation}',\n`;
    cliContent += `  },\n`;
  }
  cliContent += `};\n\n`;

  cliContent += `function parseArgs(args: string[]): { command: string; flags: Record<string, string>; dryRun: boolean; ui: boolean } {\n`;
  cliContent += `  const command = args[0] || '';\n`;
  cliContent += `  const flags: Record<string, string> = {};\n`;
  cliContent += `  let dryRun = false;\n`;
  cliContent += `  let ui = false;\n`;
  cliContent += `  for (let i = 1; i < args.length; i++) {\n`;
  cliContent += `    if (args[i] === '--dry-run') { dryRun = true; continue; }\n`;
  cliContent += `    if (args[i] === '--ui') { ui = true; continue; }\n`;
  cliContent += `    if (args[i].startsWith('--') && i + 1 < args.length) {\n`;
  cliContent += `      flags[args[i].slice(2)] = args[++i];\n`;
  cliContent += `    }\n`;
  cliContent += `  }\n`;
  cliContent += `  return { command, flags, dryRun, ui };\n`;
  cliContent += `}\n\n`;

  cliContent += `function main() {\n`;
  cliContent += `  const { command, flags, dryRun, ui } = parseArgs(process.argv.slice(2));\n\n`;
  cliContent += `  if (command === 'actions' || command === 'actions list') {\n`;
  cliContent += `    console.log('Available actions:');\n`;
  cliContent += `    for (const [id, meta] of Object.entries(ACTIONS)) {\n`;
  cliContent += `      console.log(\`  \${id} — \${meta.title} (risk: \${meta.risk})\`);\n`;
  cliContent += `    }\n`;
  cliContent += `    return;\n`;
  cliContent += `  }\n\n`;
  cliContent += `  const action = ACTIONS[command];\n`;
  cliContent += `  if (!action) {\n`;
  cliContent += `    console.error(\`Unknown action: \${command}\`);\n`;
  cliContent += `    console.error('Use "actions" to list available actions.');\n`;
  cliContent += `    process.exit(1);\n`;
  cliContent += `  }\n\n`;
  cliContent += `  if (dryRun) {\n`;
  cliContent += `    console.log(\`[dry-run] Would execute: \${command}\`);\n`;
  cliContent += `    console.log('Input:', JSON.stringify(flags, null, 2));\n`;
  cliContent += `    return;\n`;
  cliContent += `  }\n\n`;
  cliContent += `  if (ui) {\n`;
  cliContent += `    console.log(\`[ui mode] Executing \${command} via browser...\`);\n`;
  cliContent += `  } else {\n`;
  cliContent += `    console.log(\`Executing \${command}...\`);\n`;
  cliContent += `  }\n`;
  cliContent += `  console.log('Input:', JSON.stringify(flags, null, 2));\n`;
  cliContent += `}\n\n`;
  cliContent += `main();\n`;

  files.set('cli.ts', cliContent);

  return files;
}
