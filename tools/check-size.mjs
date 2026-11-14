// Fails the build when the shipped files exceed the first-load budget (see docs/PERF_BUDGET.md).
// Sums raw file sizes in dist/, which is an upper bound: servers send them compressed.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BUDGET_BYTES = 6 * 1024 * 1024;

function totalSize(dir) {
  let sum = 0;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    sum += stat.isDirectory() ? totalSize(path) : stat.size;
  }
  return sum;
}

const bytes = totalSize('dist');
const mb = (bytes / 1024 / 1024).toFixed(2);
if (bytes > BUDGET_BYTES) {
  console.error(`Size budget exceeded: dist is ${mb} MB, budget is 6 MB.`);
  process.exit(1);
}
console.log(`Size budget OK: dist is ${mb} MB of 6 MB.`);
