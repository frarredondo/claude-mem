import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

export interface CursorHooksDetectionOptions {
  homeDir?: string;
  platform?: NodeJS.Platform;
  programData?: string;
}

function isClaudeMemNativeCursorCommand(command: string): boolean {
  return command.includes('hook cursor')
    && (command.includes('worker-service.cjs') || command.includes('claude-mem'));
}

function containsClaudeMemNativeCursorCommand(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(containsClaudeMemNativeCursorCommand);
  }
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.command === 'string' && isClaudeMemNativeCursorCommand(record.command)) {
    return true;
  }
  return Object.values(record).some(containsClaudeMemNativeCursorCommand);
}

function readHooksFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

export function hasClaudeMemNativeCursorHooks(
  env: NodeJS.ProcessEnv,
  options: CursorHooksDetectionOptions = {},
): boolean {
  const homeDir = options.homeDir ?? homedir();
  const platform = options.platform ?? process.platform;
  const paths = new Set<string>();

  if (env.CURSOR_PROJECT_DIR?.trim()) {
    paths.add(join(env.CURSOR_PROJECT_DIR, '.cursor', 'hooks.json'));
  }
  paths.add(join(homeDir, '.cursor', 'hooks.json'));

  if (platform === 'darwin') {
    paths.add('/Library/Application Support/Cursor/hooks.json');
  } else if (platform === 'linux') {
    paths.add('/etc/cursor/hooks.json');
  } else if (platform === 'win32') {
    const programData = options.programData ?? env.ProgramData;
    if (programData?.trim()) {
      paths.add(join(programData, 'Cursor', 'hooks.json'));
    }
  }

  return [...paths].some(path =>
    containsClaudeMemNativeCursorCommand(readHooksFile(path))
  );
}

export function shouldRejectClaudeCodeHook(
  env: NodeJS.ProcessEnv,
  nativeCursorHooksPresent: boolean,
): boolean {
  return nativeCursorHooksPresent
    && Boolean(env.CURSOR_VERSION?.trim())
    && Boolean(env.CURSOR_PROJECT_DIR?.trim());
}
