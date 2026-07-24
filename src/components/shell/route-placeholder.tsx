import { Heading, Text } from '@/components/design-system/primitives';

import styles from './route-placeholder.module.css';

export function RoutePlaceholder({
  title,
  packageName,
  description,
}: {
  title: string;
  packageName: string;
  description: string;
}) {
  return (
    <article className={styles.placeholder}>
      <div className={styles.introduction}>
        <Text role="label" className={styles.eyebrow}>
          Application shell · development boundary
        </Text>
        <Heading as="h1" role="display-lg">
          {title}
        </Heading>
        <Text role="body-lg" className={styles.description}>
          {description}
        </Text>
      </div>
      <section className={styles.boundary} aria-labelledby="boundary-title">
        <Text role="caption" className={styles.boundaryLabel}>
          Deferred feature package
        </Text>
        <Heading id="boundary-title" as="h2" role="heading-md">
          {packageName}
        </Heading>
        <Text className={styles.boundaryCopy}>
          This route currently validates the application frame only. No feature
          data or completed product state is represented here.
        </Text>
      </section>
    </article>
  );
}
