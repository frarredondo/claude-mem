import { afterEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  hasClaudeMemNativeCursorHooks,
  shouldRejectClaudeCodeHook,
} from '../../../src/shared/cursor-hooks-state.js';
import { normalizeClaudeCodeInput } from '../../../src/cli/adapters/claude-code.js';

const CURSOR_ENV = {
  CURSOR_VERSION: '2.1.0',
  CURSOR_PROJECT_DIR: '/workspace/project',
};

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('shouldRejectClaudeCodeHook', () => {
  it('rejects Cursor compatibility hooks when native claude-mem Cursor hooks are installed', () => {
    expect(shouldRejectClaudeCodeHook(CURSOR_ENV, true)).toBe(true);
  });

  it('allows Cursor compatibility hooks when native Cursor hooks are absent', () => {
    expect(shouldRejectClaudeCodeHook(CURSOR_ENV, false)).toBe(false);
  });

  it('allows genuine Claude Code hooks without Cursor provenance', () => {
    expect(shouldRejectClaudeCodeHook({}, true)).toBe(false);
  });

  it('does not classify partial or Claude-only environment markers as Cursor', () => {
    expect(shouldRejectClaudeCodeHook({ CURSOR_VERSION: '2.1.0' }, true)).toBe(false);
    expect(shouldRejectClaudeCodeHook({ CURSOR_PROJECT_DIR: '/workspace/project' }, true)).toBe(false);
    expect(shouldRejectClaudeCodeHook({ CLAUDE_PROJECT_DIR: '/workspace/project' }, true)).toBe(false);
    expect(shouldRejectClaudeCodeHook({ CLAUDE_PLUGIN_ROOT: '/plugin' }, true)).toBe(false);
  });
});

describe('hasClaudeMemNativeCursorHooks', () => {
  it('detects a project-level claude-mem native Cursor hook command', () => {
    const root = mkdtempSync(join(tmpdir(), 'claude-mem-cursor-hooks-'));
    tempDirectories.push(root);
    const projectDir = join(root, 'project');
    const hooksDir = join(projectDir, '.cursor');
    mkdirSync(hooksDir, { recursive: true });
    writeFileSync(join(hooksDir, 'hooks.json'), JSON.stringify({
      version: 1,
      hooks: {
        afterShellExecution: [{
          command: 'bun /plugin/scripts/worker-service.cjs hook cursor observation',
        }],
      },
    }));

    expect(hasClaudeMemNativeCursorHooks(
      { CURSOR_PROJECT_DIR: projectDir },
      { homeDir: join(root, 'home'), platform: 'darwin' },
    )).toBe(true);
  });

  it('ignores unrelated, malformed, and missing hook configurations', () => {
    const root = mkdtempSync(join(tmpdir(), 'claude-mem-cursor-hooks-'));
    tempDirectories.push(root);
    const projectDir = join(root, 'project');
    const homeDir = join(root, 'home');
    mkdirSync(join(projectDir, '.cursor'), { recursive: true });
    mkdirSync(join(homeDir, '.cursor'), { recursive: true });
    writeFileSync(join(projectDir, '.cursor', 'hooks.json'), JSON.stringify({
      version: 1,
      hooks: {
        afterShellExecution: [{ command: 'run-something-else' }],
      },
    }));
    writeFileSync(join(homeDir, '.cursor', 'hooks.json'), '{not-json');

    expect(hasClaudeMemNativeCursorHooks(
      { CURSOR_PROJECT_DIR: projectDir },
      { homeDir, platform: 'darwin' },
    )).toBe(false);
  });
});

describe('normalizeClaudeCodeInput host provenance', () => {
  const cursorShellPayload = {
    session_id: 'cursor-conversation',
    cwd: '/workspace/project',
    hook_event_name: 'PostToolUse',
    tool_name: 'Shell',
    tool_input: { command: 'printf duplicate' },
    tool_response: { output: 'duplicate' },
  };

  it('rejects a Cursor compatibility Shell observation before normalization', () => {
    expect(() => normalizeClaudeCodeInput(cursorShellPayload, {
      env: CURSOR_ENV,
      nativeCursorHooksPresent: true,
    })).toThrow('adapter rejected input: cursor_compatibility_hook');
  });

  it('keeps compatibility-only Cursor installations working', () => {
    const normalized = normalizeClaudeCodeInput(cursorShellPayload, {
      env: CURSOR_ENV,
      nativeCursorHooksPresent: false,
    });

    expect(normalized.toolName).toBe('Shell');
    expect(normalized.sessionId).toBe('cursor-conversation');
  });

  it('accepts a genuine Claude Code Bash observation', () => {
    const normalized = normalizeClaudeCodeInput({
      ...cursorShellPayload,
      session_id: 'claude-session',
      tool_name: 'Bash',
    }, {
      env: {},
      nativeCursorHooksPresent: true,
    });

    expect(normalized.toolName).toBe('Bash');
    expect(normalized.sessionId).toBe('claude-session');
  });
});
