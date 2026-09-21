"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { bookGrooming } from "@/app/client/actions";

type Option = { id: number; label: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} type="submit">{pending ? "Submitting..." : "Submit appointment"}</button>;
}

export default function GroomingBookingForm({ pets, styles, groomers, customerName, phone, address, minimumDate }: { pets: Option[]; styles: Option[]; groomers: Option[]; customerName: string; phone: string; address: string; minimumDate: string }) {
  const [homeService, setHomeService] = useState(false);
  return <form action={bookGrooming} className="clientActionForm bookingForm">
    <label>Pet<select name="petId">{pets.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
    <label>Hairstyle / package<select name="styleId">{styles.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
    <label>Pet size<select name="petSize"><option>Small</option><option>Medium</option><option>Large</option><option>Extra Large</option><option>Giant</option></select></label>
    <label>Groomer<select name="groomerId">{groomers.map((item) => <option value={item.id} key={item.id}>{item.label} - Available</option>)}</select></label>
    <label>Service type<select name="bookingType" onChange={(event) => setHomeService(event.target.value === "Home Service")}><option value="Salon">Store Grooming</option><option>Home Service</option></select></label>
    <label>Date<input name="date" type="date" min={minimumDate} required /></label>
    <label>Time<input name="time" type="time" min="09:00" max="19:00" required /></label>
    {homeService && <>
      <label>Customer name<input name="contactName" defaultValue={customerName} required /></label>
      <label>Contact number<input inputMode="tel" name="contactNumber" defaultValue={phone} pattern="(?:\+63|0)9[0-9]{9}" placeholder="09XXXXXXXXX" required /></label>
      <label className="wideField">Complete address<textarea name="address" defaultValue={address} rows={3} required /></label>
    </>}
    <label className="wideField">Special instructions<textarea name="instructions" rows={3} /></label>
    <SubmitButton />
  </form>;
}
