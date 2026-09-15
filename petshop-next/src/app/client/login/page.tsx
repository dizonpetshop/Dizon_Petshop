import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";

export default async function ClientLogin({ searchParams }: { searchParams: Promise<{ error?: string; registered?: string; reset?: string }> }) {
  const { error, registered, reset } = await searchParams;
  return (
    <main className="legacyAuthPage">
      <section className="legacyAuthShell">
        <div className="legacyLogoPane">
          <img src="/assets/dizons-logo.jpg" alt="Dizon's Pet Grooming" />
        </div>
        <div className="legacyLoginPane">
          <div className="legacyLoginCard">
            <div className="legacyAuthHeading"><small>THE</small><h1>DIZON&apos;S<br />PETSHOP</h1><h2>LOGIN</h2><p>Welcome! Please enter your details.</p></div>
            {error && <div className="authError">Incorrect client email or password.</div>}
            {registered && <div className="authSuccess">Account created successfully. You can now log in.</div>}
            {reset && <div className="authSuccess">Password updated successfully. You can now log in.</div>}
            <form action="/api/auth/client-login" method="post" className="legacyAuthForm">
              <label>EMAIL<input type="email" name="email" autoComplete="email" required /></label>
              <label>PASSWORD<PasswordInput /></label>
              <div className="legacyAuthLinks"><Link href="/client/forgot-password">Forgot Password?</Link><Link href="/client/register">Register Account</Link></div>
              <button type="submit">Login</button>
            </form>
            <Link href="/" className="legacyBackLink">← Back to home</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
