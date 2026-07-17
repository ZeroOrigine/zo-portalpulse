PATCH INSTRUCTION (mechanical edits, no behavior change):
1. Delete local `copyText`, `PlusIcon`, `CopyIcon`, `CheckCircleIcon`, `Modal`, `FieldError`, `ErrorPanel` definitions and the now-unused `ReactNode` type import.
2. Add to imports: `import { CheckCircleIcon, CopyIcon, ErrorPanel, FieldError, Modal, PlusIcon, copyText } from '@/components/ui';`
All call sites already match the shared signatures exactly.