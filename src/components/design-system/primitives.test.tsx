import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Button, Heading, Text, VisuallyHidden } from './primitives';

describe('design-system primitives', () => {
  it('preserves semantic elements and narrow role contracts', () => {
    render(
      <>
        <Heading as="h2" role="display-md">
          Editorial title
        </Heading>
        <Text as="span" role="caption">
          Metadata
        </Text>
        <Button>Continue</Button>
        <VisuallyHidden>Accessible detail</VisuallyHidden>
      </>,
    );

    expect(screen.getByRole('heading', { level: 2 })).toHaveClass(
      'font-display',
    );
    expect(screen.getByText('Metadata').tagName).toBe('SPAN');
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveAttribute(
      'type',
      'button',
    );
    expect(screen.getByText('Accessible detail')).toHaveClass('sr-only');
  });
});
