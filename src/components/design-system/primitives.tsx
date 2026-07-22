import type {
  ButtonHTMLAttributes,
  ElementType,
  HTMLAttributes,
  ReactNode,
} from 'react';

function classes(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function Container({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={classes(
        'mx-auto w-full max-w-[var(--width-content-max)] px-[var(--layout-gutter)]',
        className,
      )}
      {...props}
    />
  );
}

export function Stack({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={classes(
        'flex flex-col gap-[var(--stack-gap,var(--space-4))]',
        className,
      )}
      {...props}
    />
  );
}

type TextProps = HTMLAttributes<HTMLElement> & {
  as?: 'p' | 'span';
  role?: 'body-lg' | 'body-md' | 'body-sm' | 'label' | 'caption' | 'micro';
};

const textRoles: Record<NonNullable<TextProps['role']>, string> = {
  'body-lg':
    'text-[length:var(--font-size-body-lg)] leading-[var(--line-height-body-lg)] font-normal',
  'body-md':
    'text-[length:var(--font-size-body-md)] leading-[var(--line-height-body-md)] font-normal',
  'body-sm':
    'text-[length:var(--font-size-body-sm)] leading-[var(--line-height-body-sm)] font-normal',
  label:
    'text-[length:var(--font-size-label)] leading-[var(--line-height-label)] font-semibold',
  caption:
    'text-[length:var(--font-size-caption)] leading-[var(--line-height-caption)] font-medium',
  micro:
    'text-[length:var(--font-size-micro)] leading-[var(--line-height-micro)] font-semibold',
};

export function Text({
  as: Component = 'p',
  role = 'body-md',
  className,
  ...props
}: TextProps) {
  return (
    <Component className={classes(textRoles[role], className)} {...props} />
  );
}

type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  as?: 'h1' | 'h2' | 'h3';
  role?:
    'display-xl' | 'display-lg' | 'display-md' | 'heading-lg' | 'heading-md';
};

const headingRoles: Record<NonNullable<HeadingProps['role']>, string> = {
  'display-xl':
    'font-display text-[length:var(--font-size-display-xl)] leading-[var(--line-height-display-xl)] font-normal',
  'display-lg':
    'font-display text-[length:var(--font-size-display-lg)] leading-[var(--line-height-display-lg)] font-normal',
  'display-md':
    'font-display text-[length:var(--font-size-display-md)] leading-[var(--line-height-display-md)] font-normal',
  'heading-lg':
    'text-[length:var(--font-size-heading-lg)] leading-[var(--line-height-heading-lg)] font-semibold',
  'heading-md':
    'text-[length:var(--font-size-heading-md)] leading-[var(--line-height-heading-md)] font-semibold',
};

export function Heading({
  as: Component = 'h2',
  role = 'heading-lg',
  className,
  ...props
}: HeadingProps) {
  return (
    <Component className={classes(headingRoles[role], className)} {...props} />
  );
}

export function VisuallyHidden({
  as: Component = 'span',
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { as?: ElementType; children: ReactNode }) {
  return (
    <Component className={classes('sr-only', className)} {...props}>
      {children}
    </Component>
  );
}

export function Button({
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={classes(
        'inline-flex min-h-[var(--size-touch-target-min)] items-center justify-center rounded-sm border border-action-primary bg-action-primary px-4 py-2 text-[length:var(--font-size-label)] leading-[var(--line-height-label)] font-semibold text-action-primary-text transition-[background-color,color,transform] duration-[var(--motion-duration-fast)] ease-[var(--motion-easing-standard)] hover:bg-[var(--color-ink-800)] active:scale-[var(--motion-scale-pressed)] disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
