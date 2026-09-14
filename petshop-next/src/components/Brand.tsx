import Link from "next/link";

export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Dizon's Petshop home">
      <img className="brandMark" src="/assets/dizons-logo-transparent.png" alt="Dizon's Pet Grooming logo" />
      {!compact && <span><b>DIZON&apos;S</b><small>PETSHOP & GROOMING</small></span>}
    </Link>
  );
}
