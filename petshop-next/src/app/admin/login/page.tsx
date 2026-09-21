import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";

export default async function AdminLogin({ searchParams }: { searchParams: Promise<{ error?: string; loggedOut?: string }> }) {
  const { error, loggedOut } = await searchParams;
  return (
    <main className="legacyAuthPage adminLegacyAuth">
      <section className="legacyAuthShell">
        <div className="legacyLogoPane">
          <img src="/assets/dizons-logo.jpg" alt="Dizon's Pet Grooming" />
        </div>
        <div className="legacyLoginPane">
          <div className="legacyLoginCard">
            <div className="legacyAuthHeading"><h1>DIZON&apos;S<br />PET GROOMING</h1><h2>ADMIN LOGIN</h2><p>Secure access for authorized staff.</p></div>
            <div className="legacyAdminNotice">🔒 Client accounts cannot sign in through this portal.</div>
            {loggedOut && <div className="authSuccess">You have been logged out securely.</div>}
            {error && <div className="authError">Invalid administrator credentials or access is suspended.</div>}
            <form action="/api/auth/admin-login" method="post" className="legacyAuthForm">
              <label>ADMIN EMAIL<input type="email" name="email" autoComplete="username" required /></label>
              <label>PASSWORD<PasswordInput /></label>
              <p className="adminRecoveryHint">For access recovery, contact your Super Administrator.</p>
              <button type="submit">Login as Administrator</button>
            </form>
            <Link href="/" className="legacyBackLink">← Back to home</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
