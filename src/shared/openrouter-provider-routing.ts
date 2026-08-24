// SPDX-License-Identifier: Apache-2.0

/**
 * Shared OpenRouter provider-routing helpers.
 *
 * OpenRouter's chat-completions API accepts a `provider` object that pins
 * which upstream endpoint serves a model. claude-mem exposes this as the
 * optional CLAUDE_MEM_OPENROUTER_PROVIDER setting: a non-empty slug becomes
 * `{ order: [slug], allow_fallbacks: false }` so the request fails instead of
 * silently routing elsewhere. Empty/unset preserves OpenRouter's automatic
 * routing.
 *
 * The `provider` field is OpenRouter-specific. Custom OpenAI-compatible
 * gateways (DeepSeek, LM Studio, etc.) must not receive it — strict servers
 * reject unknown body fields.
 *
 * Docs: https://openrouter.ai/docs/features/provider-routing
 */

export const OPENROUTER_PROVIDER_SLUG_MAX_LENGTH = 64;

export interface OpenRouterStrictProviderRouting {
  order: [string];
  allow_fallbacks: false;
}

export type OpenRouterProviderSlugResult =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export interface OpenRouterProviderRoutingResolution {
  /** Spread into the chat-completions body, or empty when routing is omitted. */
  fragment: { provider: OpenRouterStrictProviderRouting } | Record<string, never>;
  warning?: string;
}

const CONTROL_OR_WHITESPACE = /[\s\u0000-\u001F\u007F]/;

const CUSTOM_ENDPOINT_WARNING =
  'CLAUDE_MEM_OPENROUTER_PROVIDER is set but the request is not going to openrouter.ai; omitting OpenRouter provider routing so strict OpenAI-compatible gateways stay compatible';

export function parseOpenRouterProviderSlug(raw: unknown): OpenRouterProviderSlugResult {
  if (raw === undefined || raw === null) {
    return { ok: true, slug: '' };
  }
  if (typeof raw !== 'string') {
    return { ok: false, error: 'CLAUDE_MEM_OPENROUTER_PROVIDER must be a string' };
  }

  const slug = raw.trim();
  if (!slug) {
    return { ok: true, slug: '' };
  }
  if (slug.length > OPENROUTER_PROVIDER_SLUG_MAX_LENGTH) {
    return {
      ok: false,
      error: `CLAUDE_MEM_OPENROUTER_PROVIDER must be at most ${OPENROUTER_PROVIDER_SLUG_MAX_LENGTH} characters`,
    };
  }
  if (CONTROL_OR_WHITESPACE.test(slug)) {
    return {
      ok: false,
      error: 'CLAUDE_MEM_OPENROUTER_PROVIDER must be a single slug with no whitespace or control characters',
    };
  }

  return { ok: true, slug };
}

export function isOpenRouterApiUrl(apiUrl: string): boolean {
  return apiUrl.includes('openrouter.ai');
}

/**
 * Build the optional OpenRouter `provider` request fragment.
 *
 * Invalid slugs omit routing (callers should have validated at the settings
 * boundary). A valid slug on a non-openrouter.ai URL is also omitted, with a
 * warning for the caller to surface.
 */
export function resolveOpenRouterProviderRouting(
  rawSlug: unknown,
  apiUrl: string,
): OpenRouterProviderRoutingResolution {
  const parsed = parseOpenRouterProviderSlug(rawSlug);
  if (!parsed.ok) {
    return {
      fragment: {},
      warning: `${parsed.error}; omitting OpenRouter provider routing`,
    };
  }
  if (!parsed.slug) {
    return { fragment: {} };
  }
  if (!isOpenRouterApiUrl(apiUrl)) {
    return {
      fragment: {},
      warning: CUSTOM_ENDPOINT_WARNING,
    };
  }

  return {
    fragment: {
      provider: {
        order: [parsed.slug],
        allow_fallbacks: false,
      },
    },
  };
}
