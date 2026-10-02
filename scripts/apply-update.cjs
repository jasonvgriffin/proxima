#!/usr/bin/env node
// Writes the same apply-update helper the desktop app spawns, then optionally starts it.
// Windows CI calls this against a staged installer. It does not download anything.

const { buildApplyHelper, spawnHelper, writeHelper } = require('../shared/applyUpdate.cjs');

function arg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || process.argv[index + 1] == null || process.argv[index + 1].startsWith('--')) {
    console.error(`Missing ${name}`);
    process.exit(2);
  }
  return process.argv[index + 1];
}

const plan = {
  pid: Number(arg('--pid')),
  mode: arg('--mode'),
  version: arg('--version'),
  installerPath: arg('--installer'),
  targetExe: arg('--target-exe'),
  errorFile: arg('--error-file'),
  pendingFile: arg('--pending-file'),
  helperPath: arg('--helper'),
};

try {
  if (process.argv.includes('--print')) {
    process.stdout.write(buildApplyHelper(plan));
  } else {
    writeHelper(plan);
    if (process.argv.includes('--spawn')) spawnHelper(plan.helperPath);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
