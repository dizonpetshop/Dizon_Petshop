"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { reserveProduct } from "@/app/client/actions";

function ReserveButton() {
  const { pending } = useFormStatus();
  return <button aria-disabled={pending} disabled={pending} type="submit">{pending ? "Reserving…" : "Reserve"}</button>;
}

export default function ProductReserveForm({ productId, productName, stock, unitPrice, phone, address }: { productId: number; productName: string; stock: number; unitPrice: number; phone: string; address: string }) {
  const [quantity, setQuantity] = useState(1);
  const total = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(unitPrice * quantity);
  const manilaOffset = 8 * 60 * 60 * 1000;
  const today = new Date(Date.now() + manilaOffset).toISOString().slice(0, 10);
  const latestPickupDate = new Date(Date.now() + manilaOffset + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return <form action={reserveProduct} className="productReserveForm">
    <input name="productId" type="hidden" value={productId}/>
    <label>Qty<input aria-label={`Quantity for ${productName}`} max={stock} min="1" name="quantity" onChange={(event) => setQuantity(Math.min(stock, Math.max(1, Number(event.target.value) || 1)))} required type="number" value={quantity}/></label>
    <label>Payment<select name="paymentMethod"><option>Cash</option><option>GCash</option><option>Maya</option></select></label>
    <label>Pickup date<input max={latestPickupDate} min={today} name="pickupDate" required type="date"/></label>
    <label>Pickup time<input max="19:00" min="09:00" name="pickupTime" required type="time"/></label>
    <label>Contact<input defaultValue={phone} inputMode="tel" name="contactNumber" pattern="(?:\+63|0)9[0-9]{9}" placeholder="09XXXXXXXXX" required /></label>
    <label>Address<input defaultValue={address} name="address" placeholder="Complete address" required /></label>
    <div className="productReserveTotal"><small>Total</small><b>{total}</b></div>
    <ReserveButton />
  </form>;
}
