PATCH INSTRUCTION (mechanical edits, no behavior change):
1. Delete local `Spinner`, `GoogleIcon`, `GitHubIcon`, `EyeToggleIcon` definitions.
2. Add to imports: `import { EyeToggleIcon, GitHubIcon, GoogleIcon, Spinner } from '@/components/ui'`
The existing `import { createClient } from '@/lib/supabase/client'` now resolves via the alias added in lib/supabase/client.ts — no change needed there.