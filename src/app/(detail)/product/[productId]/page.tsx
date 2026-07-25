import { ProductDetailBoundary } from '@/features/discover/product-detail-boundary';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  return <ProductDetailBoundary productId={productId} />;
}
