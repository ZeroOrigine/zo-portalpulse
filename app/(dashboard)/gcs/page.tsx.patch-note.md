PATCH INSTRUCTION (mechanical edits, no behavior change):
1. Delete local `PlusIcon`, `Modal`, `FieldError`, `ErrorPanel` definitions and the now-unused `ReactNode` type import.
2. Add to imports: `import { ErrorPanel, FieldError, Modal, PlusIcon } from '@/components/ui';`