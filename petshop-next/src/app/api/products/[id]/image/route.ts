import { prisma } from "@/lib/prisma";
import { productImageSrc } from "@/lib/product-image";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const productId = Number(id);
  if (!Number.isSafeInteger(productId) || productId < 1) return new Response("Not found", { status: 404 });
  const product = await prisma.product.findUnique({ where: { productId }, select: { image: true, productName: true, category: true } });
  const match = product?.image?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
  const cache = "public, max-age=3600, stale-while-revalidate=86400";
  if (match) return new Response(Buffer.from(match[2], "base64"), { headers: { "Content-Type": match[1], "Cache-Control": cache, "X-Content-Type-Options": "nosniff" } });
  if (!product) return new Response("Not found", { status: 404 });
  const fallback = productImageSrc(product.image, product.productName, product.category);
  return new Response(null, { status: 307, headers: { Location: new URL(fallback, _request.url).toString(), "Cache-Control": cache } });
}
