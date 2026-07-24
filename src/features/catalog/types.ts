import { z } from 'zod';

export const CATALOG_VERSION = 'lr001-catalog-v1' as const;
export const CATALOG_CURSOR_VERSION = 'catalog-v1' as const;
export const CATALOG_DEFAULT_PAGE_SIZE = 20;
export const CATALOG_MAX_PAGE_SIZE = 50;

export const catalogCategories = [
  'top',
  'bottom',
  'shoes',
  'layer',
  'accessory',
] as const;

export const catalogSlotIds = [
  'top',
  'bottom',
  'shoes',
  'layer_or_accessory',
] as const;

export const onboardingStylePreferenceIds = [
  'minimal',
  'relaxed',
  'tailored',
  'romantic',
  'street',
  'experimental',
] as const;

export const onboardingMoodPreferenceIds = [
  'everyday_ease',
  'work_and_meetings',
  'going_out',
  'weekends_away',
  'events_and_occasions',
  'trying_something_new',
] as const;

const nonEmptyText = z.string().trim().min(1).max(320);
const imageUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && url.hostname === 'images.unsplash.com';
}, 'catalog images must use the approved HTTPS host');

export const CatalogImageSchema = z.strictObject({
  url: imageUrl,
  width: z.int().positive(),
  height: z.int().positive(),
  aspect_ratio: z.number().positive().finite(),
  alt: nonEmptyText,
});

export const CatalogImageMetadataSchema = z.strictObject({
  primary_index: z.int().min(0),
  images: z.array(CatalogImageSchema).min(1),
});

export const CatalogAttributesSchema = z.strictObject({
  style_tags: z.array(z.enum(onboardingStylePreferenceIds)).min(1),
  color: nonEmptyText,
  season: z.array(nonEmptyText).min(1),
  fit: nonEmptyText,
  occasion_tags: z.array(z.enum(onboardingMoodPreferenceIds)).min(1),
  materials: z.array(nonEmptyText).min(1),
});

const priceAmount = z
  .union([
    z.number().nonnegative().finite(),
    z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/)
      .transform((value) => Number(value)),
  ])
  .nullable();

export const CatalogProductSchema = z
  .strictObject({
    id: z.uuid(),
    name: nonEmptyText,
    brand: nonEmptyText,
    category: z.enum(catalogCategories),
    subcategory: nonEmptyText.nullable(),
    description: nonEmptyText.nullable(),
    image_urls: z.array(imageUrl).min(1),
    image_metadata: CatalogImageMetadataSchema,
    price_amount: priceAmount,
    price_currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    attributes: CatalogAttributesSchema,
    slot_eligibility: z.array(z.enum(catalogSlotIds)).min(1),
    is_active: z.literal(true),
    catalog_version: z.literal(CATALOG_VERSION),
  })
  .superRefine((product, context) => {
    if ((product.price_amount === null) !== (product.price_currency === null)) {
      context.addIssue({
        code: 'custom',
        message: 'price amount and currency must be present together',
        path: ['price_amount'],
      });
    }

    if (
      product.image_metadata.primary_index >=
      product.image_metadata.images.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'primary image index is out of range',
        path: ['image_metadata', 'primary_index'],
      });
    }

    const metadataUrls = product.image_metadata.images.map(
      (image) => image.url,
    );
    if (
      metadataUrls.length !== product.image_urls.length ||
      metadataUrls.some((url, index) => url !== product.image_urls[index])
    ) {
      context.addIssue({
        code: 'custom',
        message: 'image URLs and image metadata must remain aligned',
        path: ['image_metadata', 'images'],
      });
    }
  });

export type CatalogCategory = (typeof catalogCategories)[number];
export type CatalogSlotId = (typeof catalogSlotIds)[number];
export type CatalogProduct = z.infer<typeof CatalogProductSchema>;

export type CatalogPage = {
  items: CatalogProduct[];
  nextCursor: string | null;
};

export type CatalogProductResult =
  | { status: 'found'; product: CatalogProduct }
  | { status: 'not_found'; productId: string };

export type CatalogErrorCode =
  | 'invalid_cursor'
  | 'invalid_request'
  | 'invalid_response'
  | 'query_unavailable';

export class CatalogError extends Error {
  constructor(
    readonly code: CatalogErrorCode,
    readonly retryable: boolean,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'CatalogError';
  }
}
