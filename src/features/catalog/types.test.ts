import { describe, expect, it } from 'vitest';

import { CatalogProductSchema } from './types';
import { catalogProductFixture } from './test-fixtures';

describe('CatalogProductSchema', () => {
  it('accepts a complete canonical catalog product', () => {
    expect(
      CatalogProductSchema.safeParse(catalogProductFixture(1)).success,
    ).toBe(true);
  });

  it('rejects inactive, malformed, and incomplete product data', () => {
    const product = catalogProductFixture(1);

    expect(
      CatalogProductSchema.safeParse({
        ...product,
        is_active: false,
      }).success,
    ).toBe(false);
    expect(
      CatalogProductSchema.safeParse({
        ...product,
        brand: '',
      }).success,
    ).toBe(false);
    expect(
      CatalogProductSchema.safeParse({
        ...product,
        price_currency: null,
      }).success,
    ).toBe(false);
  });

  it('rejects unapproved image hosts and misaligned metadata', () => {
    const product = catalogProductFixture(1);

    expect(
      CatalogProductSchema.safeParse({
        ...product,
        image_urls: ['https://example.com/product.jpg'],
      }).success,
    ).toBe(false);
    expect(
      CatalogProductSchema.safeParse({
        ...product,
        image_metadata: {
          ...product.image_metadata,
          primary_index: 2,
        },
      }).success,
    ).toBe(false);
  });

  it('rejects unsupported taxonomy and malformed attributes', () => {
    const product = catalogProductFixture(1);

    expect(
      CatalogProductSchema.safeParse({
        ...product,
        category: 'unknown',
      }).success,
    ).toBe(false);
    expect(
      CatalogProductSchema.safeParse({
        ...product,
        attributes: {
          ...product.attributes,
          style_tags: ['unsupported'],
        },
      }).success,
    ).toBe(false);
  });
});
