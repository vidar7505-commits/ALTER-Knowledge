import {
  Container,
  Heading,
  Stack,
  Text,
} from '@/components/design-system/primitives';

export default function HomePage() {
  return (
    <main className="grid min-h-dvh place-items-center py-[var(--space-12)]">
      <Container>
        <Stack className="max-w-2xl [--stack-gap:var(--space-5)]">
          <Text role="label" className="text-foreground-secondary uppercase">
            Application entry · development boundary
          </Text>
          <Heading as="h1" role="display-lg">
            Entry routing arrives with onboarding.
          </Heading>
          <Text role="body-lg" className="text-foreground-secondary">
            P10 will resolve onboarding status before choosing the approved
            first or return destination. P09 does not bypass that decision.
          </Text>
        </Stack>
      </Container>
    </main>
  );
}
