import { ProductDetailExperience } from '@/features/product-detail/product-detail-experience';

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  return <ProductDetailExperience key={productId} productId={productId} />;
}
