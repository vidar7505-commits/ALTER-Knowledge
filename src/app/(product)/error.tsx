'use client';

import { Button, Heading, Text } from '@/components/design-system/primitives';

export default function ProductRouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section role="alert" className="grid max-w-2xl gap-5">
      <Text role="label" className="text-error">
        Route interrupted
      </Text>
      <Heading as="h1" role="display-md">
        This page hit a snag.
      </Heading>
      <Text className="text-foreground-secondary">
        The application frame is still available. Try loading this destination
        again.
      </Text>
      <div>
        <Button onClick={reset}>Try again</Button>
      </div>
    </section>
  );
}
