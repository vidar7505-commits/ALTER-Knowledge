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
const shellStyles = readFileSync(
  join(process.cwd(), 'src/components/shell/shell.module.css'),
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
    expect(shellStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(shellStyles).toContain('animation: none');
  });

  it('defines shell-safe viewport, safe-area, and navigation boundaries', () => {
    expect(tokens).toContain('--safe-area-top: env(safe-area-inset-top, 0px)');
    expect(tokens).toContain(
      '--safe-area-bottom: env(safe-area-inset-bottom, 0px)',
    );
    expect(shellStyles).toContain('var(--size-navigation-bottom)');
    expect(shellStyles).toContain('var(--size-navigation-rail)');
    expect(shellStyles).toContain('@media (min-width: 75rem)');
  });
});
