import type { CatalogProduct } from '@/features/catalog/types';

export type ProductDetailStatus = 'loading' | 'ready' | 'not_found' | 'error';

export type ProductDetailState =
  | { status: 'loading' }
  | {
      status: 'ready';
      product: CatalogProduct;
      savedProductId: string | null;
    }
  | { status: 'not_found'; productId: string }
  | {
      status: 'error';
      productId: string;
      errorCode: string;
      retryable: boolean;
    };

export type SaveTask = {
  action: 'save' | 'remove';
  operationId: string;
  busy: boolean;
  error: boolean;
};

export type ProductDetailSourceContext = {
  sourceSurface: 'discover' | 'wardrobe' | 'challenge' | null;
  sourceFeedPosition: number | null;
  fallbackRoute: '/discover' | '/wardrobe' | '/challenge';
};
