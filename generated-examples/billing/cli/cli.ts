#!/usr/bin/env node
// Auto-generated CLI for Example Billing

const ACTIONS: Record<string, { title: string; flags: string[]; risk: string; confirmation: string }> = {
  'invoice.create': {
    title: 'Create invoice',
    flags: ['--customer-email', '--amount', '--currency', '--memo'],
    risk: 'low',
    confirmation: 'optional',
  },
  'invoice.list': {
    title: 'List invoices',
    flags: [],
    risk: 'none',
    confirmation: 'never',
  },
  'workspace.delete': {
    title: 'Delete workspace',
    flags: ['--delete-confirmation-text'],
    risk: 'high',
    confirmation: 'required',
  },
};

function parseArgs(args: string[]): { command: string; flags: Record<string, string>; dryRun: boolean; ui: boolean } {
  const command = args[0] || '';
  const flags: Record<string, string> = {};
  let dryRun = false;
  let ui = false;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--dry-run') { dryRun = true; continue; }
    if (args[i] === '--ui') { ui = true; continue; }
    if (args[i].startsWith('--') && i + 1 < args.length) {
      flags[args[i].slice(2)] = args[++i];
    }
  }
  return { command, flags, dryRun, ui };
}

function main() {
  const { command, flags, dryRun, ui } = parseArgs(process.argv.slice(2));

  if (command === 'actions' || command === 'actions list') {
    console.log('Available actions:');
    for (const [id, meta] of Object.entries(ACTIONS)) {
      console.log(`  ${id} — ${meta.title} (risk: ${meta.risk})`);
    }
    return;
  }

  const action = ACTIONS[command];
  if (!action) {
    console.error(`Unknown action: ${command}`);
    console.error('Use "actions" to list available actions.');
    process.exit(1);
  }

  if (dryRun) {
    console.log(`[dry-run] Would execute: ${command}`);
    console.log('Input:', JSON.stringify(flags, null, 2));
    return;
  }

  if (ui) {
    console.log(`[ui mode] Executing ${command} via browser...`);
  } else {
    console.log(`Executing ${command}...`);
  }
  console.log('Input:', JSON.stringify(flags, null, 2));
}

main();
