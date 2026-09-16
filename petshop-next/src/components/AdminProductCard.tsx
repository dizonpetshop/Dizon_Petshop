"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { updateProduct } from "@/app/admin/actions";

type ProductCardProps = {
  id: number;
  sku: string;
  name: string;
  category: string;
  description: string;
  group: string;
  price: string;
  stock: number;
  reorder: number;
  active: boolean;
  imageSrc: string;
};

async function resizeUpload(file: File) {
  if (file.size <= 750_000) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  return blob ? new File([blob], "product-image.jpg", { type: "image/jpeg" }) : file;
}

export default function AdminProductCard(product: ProductCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"success" | "error">("error");
  const [preview, setPreview] = useState(product.imageSrc);
  const formRef = useRef<HTMLFormElement>(null);

  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const original = input.files?.[0];
    if (!original) return;
    const resized = await resizeUpload(original);
    if (resized.size > 900_000) {
      input.value = "";
      setMessageTone("error");
      setMessage("Please choose a smaller image. The optimized file is still too large.");
      return;
    }
    if (resized !== original) {
      const files = new DataTransfer();
      files.items.add(resized);
      input.files = files.files;
    }
    setPreview(URL.createObjectURL(resized));
  }

  async function save(formData: FormData) {
    setSaving(true);
    setMessage("");
    try {
      await updateProduct(formData);
      setEditing(false);
      setMessageTone("success");
      setMessage("Product updated successfully.");
    } catch {
      setMessageTone("error");
      setMessage("Failed to update this product. Check the details and try again.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    formRef.current?.reset();
    setPreview(product.imageSrc);
    setEditing(false);
  }

  return (
    <form action={save} className={`databaseCard ${editing ? "isEditing" : "isLocked"}`} ref={formRef}>
      <input type="hidden" name="id" value={product.id} />
      {message && <p className={`productFormMessage ${messageTone}`} role="status">{message}</p>}
      <img className="adminProductImage" src={preview} alt={product.name} />
      <label className="productUploadControl" hidden={!editing}>
        Upload new image
        <input name="imageFile" type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseImage} />
      </label>
      <div className="databaseCardTop"><small>{product.sku}</small><span className={product.stock <= product.reorder ? "stockLow" : "stockGood"}>{product.stock <= product.reorder ? "Low stock" : "In stock"}</span></div>
      <input name="name" defaultValue={product.name} aria-label="Product name" disabled={!editing} required />
      <input name="category" defaultValue={product.category} aria-label="Category" disabled={!editing} required />
      <input name="description" defaultValue={product.description} aria-label="Description" placeholder="Description" disabled={!editing} />
      <div className="productEditGrid">
        <select name="group" defaultValue={product.group} disabled={!editing}><option>Food</option><option>Shampoo</option><option>Other</option></select>
        <input name="price" type="number" min="0" step="0.01" defaultValue={product.price} aria-label="Price" disabled={!editing} required />
        <input name="stock" type="number" min="0" defaultValue={product.stock} aria-label="Quantity" disabled={!editing} required />
        <input name="reorder" type="number" min="0" defaultValue={product.reorder} aria-label="Alert level" disabled={!editing} required />
      </div>
      <div className="databaseCardFooter">
        <label><input type="checkbox" name="active" defaultChecked={product.active} disabled={!editing} /> Visible to clients</label>
        {editing ? <span className="productEditActions"><button type="button" className="secondaryAction" onClick={cancel} disabled={saving}>Cancel</button><button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></span> : <button type="button" onClick={() => setEditing(true)}>Update product</button>}
      </div>
    </form>
  );
}
