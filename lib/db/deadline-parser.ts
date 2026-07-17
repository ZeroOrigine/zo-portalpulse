// CANONICAL AI deadline extraction service for PortalPulse.
// Takes one stored email, asks the model for structured deadline items, then
// persists them and flips the email to parsed. Callers own the failed state.
// Uses the service-role client because the inbound webhook has no user session;
// every write here is scoped by the explicit user_id passed in.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { DEADLINE_COLUMNS, DEADLINE_TYPES } from '@/lib/db/types';
import type { DeadlineRow, DeadlineType } from '@/lib/db/types';

export class DeadlineParserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeadlineParserError';
  }
}

export interface ParseEmailInput {
  emailId: string;
  userId: string;
  gcId: string | null;
  subject: string;
  bodyText: string;
  fromAddress: string;
  receivedAt: string;
  timezone: string;
}

const candidateSchema = z.object({
  title: z.string().min(1).max(300),
  deadline_type: z.string(),
  due_at: z.string(),
  details: z.string().max(2000).optional().default(''),
  confidence: z.number().min(0).max(1).optional().default(0.5),
});

interface AnthropicContentBlock {
  type: string;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
}

function normalizeDeadlineType(value: string): DeadlineType {
  const normalized = value.trim().toLowerCase();
  return (DEADLINE_TYPES as readonly string[]).includes(normalized) ? (normalized as DeadlineType) : 'other';
}

function extractJsonArray(rawText: string): unknown {
  const startIndex = rawText.indexOf('[');
  const endIndex = rawText.lastIndexOf(']');
  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    return null;
  }
  try {
    return JSON.parse(rawText.slice(startIndex, endIndex + 1));
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = [
  'You extract deadline items from general contractor portal notification emails for a construction subcontractor.',
  'Return ONLY a JSON array. No prose, no code fences.',
  'Each array item must be an object with exactly these keys:',
  '"title": short human title (string).',
  '"deadline_type": one of "coi_renewal", "pay_app_window", "lien_waiver", "compliance_doc", "other".',
  '"due_at": the deadline as an ISO 8601 datetime with timezone offset.',
  '"details": one or two sentences of context (string, may be empty).',
  '"confidence": your extraction confidence from 0 to 1.',
  'Rules: only include items with a real or clearly implied date. Resolve relative dates like "due Friday" or "within 10 days" from the received timestamp in the recipient timezone. If the email gives no time of day, use 17:00 in the recipient timezone. If the email contains no actionable deadline, return [].',
].join('\n');

async function callParserModel(input: ParseEmailInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new DeadlineParserError('The parsing service is not configured yet.');
  }
  const model = process.env.PORTALPULSE_PARSER_MODEL ?? 'claude-3-5-haiku-latest';
  const bodyExcerpt = input.bodyText.slice(0, 12000);
  const userPrompt = `Recipient timezone: ${input.timezone}\nEmail received at: ${input.receivedAt}\nFrom: ${input.fromAddress}\nSubject: ${input.subject || '(no subject)'}\n\nBody:\n${bodyExcerpt || '(empty body)'}`;

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch (networkError) {
    console.error('[portalpulse/parser] model request failed', networkError);
    throw new DeadlineParserError('The parsing service did not answer in time.');
  }

  if (!response.ok) {
    console.error('[portalpulse/parser] model returned status', response.status);
    throw new DeadlineParserError('The parsing service had a hiccup.');
  }

  const completion = (await response.json()) as AnthropicResponse;
  const rawText = completion.content?.find((block) => block.type === 'text')?.text ?? '';
  if (!rawText) {
    throw new DeadlineParserError('The parsing service returned an empty answer.');
  }
  return rawText;
}

// Parses one email and persists the results. On success the email row is
// flipped to parsed and fresh ai_parsed deadlines replace earlier upcoming
// ai_parsed rows for that email (completed or dismissed rows are kept, the
// user touched those). Throws DeadlineParserError on any failure; the caller
// marks the email failed with a human message.
export async function parseEmailIntoDeadlines(admin: SupabaseClient, input: ParseEmailInput): Promise<DeadlineRow[]> {
  const markParsed = async () => {
    const { error: emailUpdateError } = await admin
      .from('portalpulse_emails')
      .update({ parse_status: 'parsed', parsed_at: new Date().toISOString(), parse_error: null })
      .eq('id', input.emailId)
      .eq('user_id', input.userId);
    if (emailUpdateError) {
      console.error('[portalpulse/parser] email update failed', emailUpdateError.message);
      throw new DeadlineParserError('We could not update the email record.');
    }
  };

  // Nothing to read: a valid outcome, the email simply has no deadline.
  if (!input.subject.trim() && !input.bodyText.trim()) {
    await markParsed();
    return [];
  }

  const rawText = await callParserModel(input);
  const extracted = extractJsonArray(rawText);
  if (extracted === null) {
    throw new DeadlineParserError('The parser answer was not valid JSON.');
  }

  const parsedCandidates = z.array(candidateSchema).safeParse(extracted);
  if (!parsedCandidates.success) {
    throw new DeadlineParserError('The parser answer had an unexpected shape.');
  }

  const rowsToInsert = parsedCandidates.data
    .map((candidate) => {
      const dueDate = new Date(candidate.due_at);
      if (Number.isNaN(dueDate.getTime())) {
        return null;
      }
      const confidence = Math.min(1, Math.max(0, Math.round(candidate.confidence * 100) / 100));
      return {
        user_id: input.userId,
        email_id: input.emailId,
        gc_id: input.gcId,
        title: candidate.title.trim().slice(0, 200),
        details: candidate.details.trim().slice(0, 2000),
        deadline_type: normalizeDeadlineType(candidate.deadline_type),
        status: 'upcoming' as const,
        source: 'ai_parsed' as const,
        confidence,
        due_at: dueDate.toISOString(),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .slice(0, 10);

  const { error: deleteError } = await admin
    .from('portalpulse_deadlines')
    .delete()
    .eq('user_id', input.userId)
    .eq('product_id', 'portalpulse')
    .eq('email_id', input.emailId)
    .eq('source', 'ai_parsed')
    .eq('status', 'upcoming');
  if (deleteError) {
    console.error('[portalpulse/parser] stale deadline cleanup failed', deleteError.message);
    throw new DeadlineParserError('We could not refresh earlier parsed deadlines.');
  }

  if (rowsToInsert.length === 0) {
    await markParsed();
    return [];
  }

  const { data: insertedRows, error: insertError } = await admin
    .from('portalpulse_deadlines')
    .insert(rowsToInsert)
    .select(DEADLINE_COLUMNS);
  if (insertError) {
    console.error('[portalpulse/parser] deadline insert failed', insertError.message);
    throw new DeadlineParserError('We could not save the extracted deadlines.');
  }

  await markParsed();
  return (insertedRows ?? []) as unknown as DeadlineRow[];
}
