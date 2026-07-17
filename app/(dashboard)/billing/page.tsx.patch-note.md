PATCH INSTRUCTION (single mechanical edit, no behavior change):
1. Delete the local `function ErrorPanel(...)` definition (lines defining it in this file).
2. Add to imports: `import { ErrorPanel } from '@/components/ui';`
Everything else in app/(dashboard)/billing/page.tsx is unchanged and correct. CheckIcon and UsageMeter are defined once (here only) and stay local.