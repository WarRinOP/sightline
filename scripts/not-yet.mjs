// Placeholder for a CLAUDE.md §4 script whose inputs do not exist yet.
// It prints that nothing ran, so a green `pnpm verify` is never read as "parity/e2e passed".
const [name, reason] = process.argv.slice(2);
console.log(`${name}: NOT RUN, ${reason}`);
