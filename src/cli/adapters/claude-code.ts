import type { PlatformAdapter, NormalizedHookInput, HookResult } from '../types.js';
import { AdapterRejectedInput, isValidCwd } from './errors.js';
import {
  hasClaudeMemNativeCursorHooks,
  shouldRejectClaudeCodeHook,
} from '../../shared/cursor-hooks-state.js';

const MAX_AGENT_FIELD_LEN = 128;
const pickAgentField = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 && v.length <= MAX_AGENT_FIELD_LEN ? v : undefined;

export interface ClaudeCodeInputOptions {
  env?: NodeJS.ProcessEnv;
  nativeCursorHooksPresent?: boolean;
}

export function normalizeClaudeCodeInput(
  raw: unknown,
  options: ClaudeCodeInputOptions = {},
): NormalizedHookInput {
  const env = options.env ?? process.env;
  const nativeCursorHooksPresent = options.nativeCursorHooksPresent
    ?? hasClaudeMemNativeCursorHooks(env);
  if (shouldRejectClaudeCodeHook(env, nativeCursorHooksPresent)) {
    throw new AdapterRejectedInput('cursor_compatibility_hook');
  }

  const r = (raw ?? {}) as any;
  const cwd = r.cwd;
  if (!isValidCwd(cwd)) {
    throw new AdapterRejectedInput('invalid_cwd');
  }
  return {
    sessionId: r.session_id ?? r.id ?? r.sessionId,
    cwd,
    prompt: r.prompt,
    toolName: r.tool_name,
    toolInput: r.tool_input,
    toolResponse: r.tool_response,
    transcriptPath: r.transcript_path,
    agentId: pickAgentField(r.agent_id),
    agentType: pickAgentField(r.agent_type),
  };
}

export const claudeCodeAdapter: PlatformAdapter = {
  normalizeInput: normalizeClaudeCodeInput,
  formatOutput(result) {
    const r = result ?? ({} as HookResult);
    if (r.hookSpecificOutput) {
      const output: Record<string, unknown> = { hookSpecificOutput: result.hookSpecificOutput };
      if (r.systemMessage) {
        output.systemMessage = r.systemMessage;
      }
      return output;
    }
    const output: Record<string, unknown> = {};
    if (r.systemMessage) {
      output.systemMessage = r.systemMessage;
    }
    return output;
  }
};
