import { describe, expect, it, mock } from 'bun:test';
import { AdapterRejectedInput } from '../../src/cli/adapters/errors.js';
import { runHookCommand } from '../../src/cli/hook-command.js';
import type { EventHandler, PlatformAdapter } from '../../src/cli/types.js';

describe('runHookCommand adapter rejection', () => {
  it('returns a successful no-op without invoking the event handler', async () => {
    const adapter: PlatformAdapter = {
      normalizeInput() {
        throw new AdapterRejectedInput('cursor_compatibility_hook');
      },
      formatOutput() {
        return {};
      },
    };
    const execute = mock(async () => ({ continue: true }));
    const handler: EventHandler = { execute };
    const stdout: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      stdout.push(args.join(' '));
    };

    try {
      const exitCode = await runHookCommand(
        'claude-code',
        'observation',
        { skipExit: true },
        {
          readInput: async () => ({
            session_id: 'cursor-conversation',
            cwd: '/workspace/project',
            tool_name: 'Shell',
          }),
          getAdapter: () => adapter,
          getHandler: () => handler,
        },
      );

      expect(exitCode).toBe(0);
      expect(execute).not.toHaveBeenCalled();
      expect(stdout).toEqual(['{}']);
    } finally {
      console.log = originalLog;
    }
  });
});
