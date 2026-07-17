PATCH INSTRUCTION (mechanical edits, no behavior change):
1. Delete local `copyText`, `CopyIcon`, and `ErrorPanel` definitions.
2. Add to imports: `import { CopyIcon, ErrorPanel, copyText } from '@/components/ui';`
All call sites already match the shared signatures exactly.