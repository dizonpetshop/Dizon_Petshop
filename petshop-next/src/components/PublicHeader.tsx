import Link from "next/link";
import Brand from "./Brand";

export default function PublicHeader() {
  return (
    <header className="publicHeader">
      <Brand />
      <nav aria-label="Main navigation">
        <Link href="#about">About Us</Link>
        <Link href="#grooming">Grooming</Link>
        <Link href="#products">Products</Link>
        <Link href="#contact">Contact</Link>
      </nav>
      <div className="headerActions">
        <Link href="/client/login" className="textButton">Login</Link>
        <Link href="/client/register" className="primaryButton small">Create Account</Link>
      </div>
    </header>
  );
}
