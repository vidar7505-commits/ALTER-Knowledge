import type { CatalogProduct, CatalogSlotId } from './types';

export const catalogChallengeId = 'c0810000-0000-4000-8000-000000000001';

const imageUrl =
  'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&h=1500&q=85';

export function catalogProductFixture(
  index: number,
  overrides: Partial<CatalogProduct> = {},
): CatalogProduct {
  const suffix = index.toString().padStart(12, '0');
  const slot = slotForIndex(index);
  const category = slot === 'layer_or_accessory' ? 'layer' : slot;

  return {
    id: `c0800000-0000-4000-8000-${suffix}`,
    name: `Canonical Product ${index}`,
    brand: 'Fixture Studio',
    category,
    subcategory: `${category}-fixture`,
    description: `Curated catalog fixture ${index}.`,
    image_urls: [imageUrl],
    image_metadata: {
      primary_index: 0,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 1500,
          aspect_ratio: 0.8,
          alt: `Fixture Studio Canonical Product ${index}, ${category}.`,
        },
      ],
    },
    price_amount: 100 + index,
    price_currency: 'EUR',
    attributes: {
      style_tags: ['minimal'],
      color: 'ink',
      season: ['all season'],
      fit: 'regular',
      occasion_tags: ['going_out'],
      materials: ['cotton'],
    },
    slot_eligibility: [slot],
    is_active: true,
    catalog_version: 'lr001-catalog-v1',
    ...overrides,
  };
}

export function catalogProductFixtures(count = 8): CatalogProduct[] {
  return Array.from({ length: count }, (_, index) =>
    catalogProductFixture(index + 1),
  );
}

function slotForIndex(index: number): CatalogSlotId {
  const slots: CatalogSlotId[] = [
    'top',
    'bottom',
    'shoes',
    'layer_or_accessory',
  ];
  return slots[(index - 1) % slots.length] ?? 'top';
}
