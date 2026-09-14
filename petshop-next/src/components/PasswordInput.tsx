"use client";

import { useState } from "react";

export default function PasswordInput({ name = "password" }: { name?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="legacyPasswordField">
      <input type={visible ? "text" : "password"} name={name} autoComplete="current-password" required />
      <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? "Hide password" : "Show password"}>{visible ? "◉" : "◎"}</button>
    </div>
  );
}
