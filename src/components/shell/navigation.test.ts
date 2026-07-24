import { describe, expect, it } from 'vitest';

import { isNavigationItemActive, PRIMARY_NAVIGATION } from './navigation';

describe('primary navigation model', () => {
  it('contains only the approved destinations in canonical order', () => {
    expect(PRIMARY_NAVIGATION).toEqual([
      {
        id: 'discover',
        label: 'Discover',
        href: '/discover',
        icon: 'discover',
      },
      {
        id: 'wardrobe',
        label: 'Wardrobe',
        href: '/wardrobe',
        icon: 'wardrobe',
      },
      {
        id: 'challenge',
        label: 'Challenge',
        href: '/challenge',
        icon: 'challenge',
      },
    ]);
  });

  it('matches a destination and its nested route without prefix collisions', () => {
    expect(isNavigationItemActive('/discover', '/discover')).toBe(true);
    expect(isNavigationItemActive('/discover/product/1', '/discover')).toBe(
      true,
    );
    expect(isNavigationItemActive('/discovering', '/discover')).toBe(false);
    expect(isNavigationItemActive('/wardrobe', '/discover')).toBe(false);
  });
});
