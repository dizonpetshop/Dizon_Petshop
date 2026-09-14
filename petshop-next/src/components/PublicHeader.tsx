import Link from "next/link";
import Brand from "./Brand";

export default function PublicHeader() {
  return (
    <header className="publicHeader">
      <Brand />
      <nav aria-label="Main navigation">
        <Link href="#services">Services</Link>
        <Link href="#experience">Experience</Link>
        <Link href="/how-to-run">How to Run This</Link>
      </nav>
      <div className="headerActions">
        <Link href="/client/login" className="textButton">Login</Link>
        <Link href="/client/register" className="primaryButton small">Create Account</Link>
      </div>
    </header>
  );
}
