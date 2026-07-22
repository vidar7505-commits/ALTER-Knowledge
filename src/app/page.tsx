import {
  Button,
  Container,
  Heading,
  Stack,
  Text,
  VisuallyHidden,
} from '../components/design-system/primitives';

const colors = [
  ['Canvas', 'bg-canvas', 'text-foreground'],
  ['Subtle', 'bg-surface-subtle', 'text-foreground'],
  ['Raised', 'bg-surface-raised', 'text-foreground'],
  ['Inverse', 'bg-surface-inverse', 'text-foreground-inverse'],
  ['Accent', 'bg-accent', 'text-white'],
] as const;

export default function HomePage() {
  return (
    <main className="py-[var(--space-12)] desktop:py-[var(--space-20)]">
      <Container>
        <Stack className="[--stack-gap:var(--space-16)]">
          <header className="max-w-[var(--width-text-max)]">
            <Text role="label" className="mb-3 text-foreground-secondary">
              Development environment · token verification
            </Text>
            <Heading as="h1" role="display-xl">
              A L T E R . visual foundation
            </Heading>
            <Text role="body-lg" className="mt-5 text-foreground-secondary">
              A non-product surface for verifying approved typography, color,
              spacing, focus, elevation, and responsive foundations.
            </Text>
          </header>

          <section aria-labelledby="type-heading">
            <Heading id="type-heading" role="heading-lg">
              Typography roles
            </Heading>
            <div className="mt-6 grid gap-8 border-t border-border-subtle pt-8">
              <Heading role="display-lg">Editorial display</Heading>
              <Heading role="display-md">Primary screen title</Heading>
              <Heading role="heading-md">Functional heading</Heading>
              <Text role="body-lg">
                Introductory copy remains calm and legible.
              </Text>
              <Text role="body-md">
                Body copy uses the approved interface family with stable system
                fallbacks, including Turkish characters: Ğğ İı Şş Çç Öö Üü.
              </Text>
              <Text role="body-sm" className="text-foreground-secondary">
                Product metadata and supporting information
              </Text>
              <Text role="caption" className="text-foreground-secondary">
                Auxiliary metadata · 12 px
              </Text>
            </div>
          </section>

          <section aria-labelledby="color-heading">
            <Heading id="color-heading" role="heading-lg">
              Semantic color roles
            </Heading>
            <ul className="mt-6 grid list-none grid-cols-1 gap-3 p-0 tablet:grid-cols-2 desktop:grid-cols-5">
              {colors.map(([label, background, foreground]) => (
                <li
                  key={label}
                  className={`${background} ${foreground} flex min-h-28 items-end rounded-sm border border-border-subtle p-4 shadow-subtle`}
                >
                  <Text role="label">{label}</Text>
                </li>
              ))}
            </ul>
            <div
              className="mt-3 grid grid-cols-3 gap-3"
              aria-label="Status roles"
            >
              <Text role="label" className="border-l-2 border-success pl-3">
                Success
              </Text>
              <Text role="label" className="border-l-2 border-warning pl-3">
                Warning
              </Text>
              <Text role="label" className="border-l-2 border-error pl-3">
                Error
              </Text>
            </div>
          </section>

          <section aria-labelledby="primitive-heading">
            <Heading id="primitive-heading" role="heading-lg">
              Interaction primitives
            </Heading>
            <div className="mt-6 flex flex-wrap items-center gap-4 rounded-lg bg-surface-subtle p-6 shadow-sheet">
              <Button>Verify focus and motion</Button>
              <Text role="body-sm" className="max-w-[var(--width-text-max)]">
                Tab to the button for a two-pixel accent ring with a two-pixel
                offset. Press feedback uses the approved fast duration and
                scale.
              </Text>
              <VisuallyHidden>
                This hidden text verifies the shared assistive utility.
              </VisuallyHidden>
            </div>
          </section>

          <section aria-labelledby="spacing-heading">
            <Heading id="spacing-heading" role="heading-lg">
              Spacing and radius samples
            </Heading>
            <div className="mt-6 flex flex-wrap items-end gap-4">
              {[1, 2, 3, 4, 6, 8, 12, 16].map((step) => (
                <div key={step} className="text-center">
                  <div
                    className="mx-auto rounded-xs bg-surface-inverse"
                    style={{
                      width: `var(--space-${step})`,
                      height: `var(--space-${step})`,
                    }}
                  />
                  <Text role="micro" className="mt-2 text-foreground-secondary">
                    {step}
                  </Text>
                </div>
              ))}
            </div>
          </section>
        </Stack>
      </Container>
    </main>
  );
}
