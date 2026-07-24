import { Heading, Text } from '@/components/design-system/primitives';

export default function ProductRouteLoading() {
  return (
    <section role="status" aria-live="polite" aria-busy="true">
      <Text role="label" className="text-foreground-secondary">
        Loading destination
      </Text>
      <Heading as="h1" role="display-md" className="mt-4">
        Preparing this space
      </Heading>
    </section>
  );
}
