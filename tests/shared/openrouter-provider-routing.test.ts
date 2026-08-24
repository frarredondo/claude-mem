// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'bun:test';
import {
  OPENROUTER_PROVIDER_SLUG_MAX_LENGTH,
  parseOpenRouterProviderSlug,
  resolveOpenRouterProviderRouting,
} from '../../src/shared/openrouter-provider-routing.js';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const CUSTOM_URL = 'https://api.deepseek.com/chat/completions';

describe('parseOpenRouterProviderSlug', () => {
  it('treats unset, null, and blank values as empty (automatic routing)', () => {
    expect(parseOpenRouterProviderSlug(undefined)).toEqual({ ok: true, slug: '' });
    expect(parseOpenRouterProviderSlug(null)).toEqual({ ok: true, slug: '' });
    expect(parseOpenRouterProviderSlug('')).toEqual({ ok: true, slug: '' });
    expect(parseOpenRouterProviderSlug('   ')).toEqual({ ok: true, slug: '' });
  });

  it('trims a valid slug', () => {
    expect(parseOpenRouterProviderSlug('  anthropic  ')).toEqual({ ok: true, slug: 'anthropic' });
  });

  it('accepts typical OpenRouter endpoint slugs', () => {
    expect(parseOpenRouterProviderSlug('google-vertex').ok).toBe(true);
    expect(parseOpenRouterProviderSlug('amazon-bedrock').ok).toBe(true);
    expect(parseOpenRouterProviderSlug('Together').ok).toBe(true);
  });

  it('rejects non-strings', () => {
    expect(parseOpenRouterProviderSlug(1).ok).toBe(false);
    expect(parseOpenRouterProviderSlug(['anthropic']).ok).toBe(false);
  });

  it('rejects internal whitespace and control characters', () => {
    expect(parseOpenRouterProviderSlug('google vertex').ok).toBe(false);
    expect(parseOpenRouterProviderSlug('anthropic\nfoo').ok).toBe(false);
    expect(parseOpenRouterProviderSlug('anthropic\u0000x').ok).toBe(false);
  });

  it('rejects unreasonable lengths', () => {
    const tooLong = 'a'.repeat(OPENROUTER_PROVIDER_SLUG_MAX_LENGTH + 1);
    expect(parseOpenRouterProviderSlug(tooLong).ok).toBe(false);
    expect(parseOpenRouterProviderSlug('a'.repeat(OPENROUTER_PROVIDER_SLUG_MAX_LENGTH)).ok).toBe(true);
  });
});

describe('resolveOpenRouterProviderRouting', () => {
  it('omits the provider field when the slug is unset', () => {
    expect(resolveOpenRouterProviderRouting('', OPENROUTER_URL)).toEqual({ fragment: {} });
    expect(resolveOpenRouterProviderRouting(undefined, OPENROUTER_URL)).toEqual({ fragment: {} });
  });

  it('builds strict routing for a slug on openrouter.ai', () => {
    expect(resolveOpenRouterProviderRouting('anthropic', OPENROUTER_URL)).toEqual({
      fragment: {
        provider: {
          order: ['anthropic'],
          allow_fallbacks: false,
        },
      },
    });
  });

  it('omits routing and warns on custom OpenAI-compatible endpoints', () => {
    const result = resolveOpenRouterProviderRouting('anthropic', CUSTOM_URL);
    expect(result.fragment).toEqual({});
    expect(result.warning).toContain('openrouter.ai');
  });

  it('omits routing and warns for invalid slugs', () => {
    const result = resolveOpenRouterProviderRouting('not a slug', OPENROUTER_URL);
    expect(result.fragment).toEqual({});
    expect(result.warning).toBeDefined();
  });
});
