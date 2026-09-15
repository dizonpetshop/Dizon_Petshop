import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const productId = Number(id);
  if (!Number.isSafeInteger(productId) || productId < 1) return new Response("Not found", { status: 404 });
  const product = await prisma.product.findUnique({ where: { productId }, select: { image: true } });
  const match = product?.image?.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
  if (!match) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(match[2], "base64"), { headers: { "Content-Type": match[1], "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400", "X-Content-Type-Options": "nosniff" } });
}
