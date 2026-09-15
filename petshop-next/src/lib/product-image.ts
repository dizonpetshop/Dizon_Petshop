export function productImageSrc(
  image: string | null,
  productName: string,
  category: string,
) {
  const value = image?.trim();
  if (value && (/^https?:\/\//i.test(value) || value.startsWith("/"))) return value;
  if (value) {
    const filename = value.replaceAll("\\", "/").split("/").pop();
    if (filename) return `/products/${encodeURIComponent(filename)}`;
  }

  if (productName.toLowerCase().includes("shampoo")) return "/products/pet-shampoos.png";
  if (category.toLowerCase().startsWith("cat")) return "/products/cat-care-essentials.png";
  return "/products/dog-care-essentials.png";
}
