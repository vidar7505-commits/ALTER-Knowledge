'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NavigationIcon } from './navigation-icon';
import { isNavigationItemActive, PRIMARY_NAVIGATION } from './navigation';
import styles from './shell.module.css';

function NavigationItems() {
  const pathname = usePathname();

  return (
    <ul className={styles.navigationList}>
      {PRIMARY_NAVIGATION.map((item) => {
        const active = isNavigationItemActive(pathname, item.href);

        return (
          <li key={item.id} className={styles.navigationListItem}>
            <Link
              href={item.href}
              className={styles.navigationLink}
              aria-current={active ? 'page' : undefined}
            >
              <NavigationIcon name={item.icon} active={active} />
              <span>{item.label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function BottomNavigation() {
  return (
    <nav
      aria-label="Primary mobile navigation"
      className={styles.bottomNavigation}
      data-navigation="bottom"
    >
      <NavigationItems />
    </nav>
  );
}

export function DesktopRail() {
  return (
    <nav
      aria-label="Primary desktop navigation"
      className={styles.desktopRail}
      data-navigation="rail"
    >
      <Link
        href="/discover"
        className={styles.railWordmark}
        aria-label="A L T E R . home"
      >
        <span className={styles.railWordmarkCompact} aria-hidden="true">
          A.
        </span>
        <span className={styles.railWordmarkExpanded} aria-hidden="true">
          A L T E R .
        </span>
      </Link>
      <NavigationItems />
    </nav>
  );
}
