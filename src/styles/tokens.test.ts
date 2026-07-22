import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const tokens = readFileSync(
  join(process.cwd(), 'src/styles/tokens.css'),
  'utf8',
);
const globals = readFileSync(
  join(process.cwd(), 'src/app/globals.css'),
  'utf8',
);

describe('design token contract', () => {
  it.each([
    '--font-family-display',
    '--font-family-ui',
    '--color-surface-primary',
    '--color-text-primary',
    '--color-border-subtle',
    '--color-focus-ring',
    '--space-4',
    '--radius-md',
    '--elevation-2',
    '--width-content-max',
    '--size-touch-target-min',
    '--motion-duration-fast',
    '--motion-easing-standard',
  ])('defines the critical token %s', (token) => {
    expect(tokens).toContain(`${token}:`);
  });

  it('maps the semantic contract through the Tailwind CSS-first theme', () => {
    expect(tokens).toContain('@theme inline');
    expect(tokens).toContain('--color-canvas: var(--color-surface-primary)');
    expect(tokens).toContain('--font-display: var(--font-family-display)');
    expect(tokens).toContain('--breakpoint-desktop: 75rem');
  });

  it('provides a deterministic reduced-motion contract', () => {
    expect(globals).toContain('@media (prefers-reduced-motion: reduce)');
    expect(globals).toContain(
      'transition-duration: var(--motion-duration-instant)',
    );
    expect(globals).toContain('animation-iteration-count: 1');
  });
});
