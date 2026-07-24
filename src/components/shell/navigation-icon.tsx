import type { ReactNode } from 'react';

import type { NavigationIcon as NavigationIconName } from './navigation';

const paths: Record<NavigationIconName, ReactNode> = {
  discover: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.2 8.8-2.1 4.3-4.3 2.1 2.1-4.3 4.3-2.1Z" />
    </>
  ),
  wardrobe: (
    <path d="M6.75 4.75A1.75 1.75 0 0 1 8.5 3h7A1.75 1.75 0 0 1 17.25 4.75V21L12 17.5 6.75 21V4.75Z" />
  ),
  challenge: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
};

export function NavigationIcon({
  name,
  active,
}: {
  name: NavigationIconName;
  active: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      className="navigation-icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill={active && name === 'wardrobe' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
