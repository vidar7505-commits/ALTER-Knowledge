export type NavigationIcon = 'discover' | 'wardrobe' | 'challenge';

export type NavigationItem = {
  id: NavigationIcon;
  label: string;
  href: `/${string}`;
  icon: NavigationIcon;
};

export const PRIMARY_NAVIGATION = [
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
] as const satisfies readonly NavigationItem[];

export function isNavigationItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
