PATCH INSTRUCTION (mechanical edits, no behavior change):
1. Delete the local `ErrorPanel` definition.
2. Add to imports: `import { ErrorPanel } from '@/components/ui';`
3. Replace `<ErrorPanel message={loadError} />` with `<ErrorPanel title="We could not load that email." message={loadError} actionHref="/emails" actionLabel="Back to emails" />`.