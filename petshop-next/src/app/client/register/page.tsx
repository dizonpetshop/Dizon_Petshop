import Link from "next/link";
import Brand from "@/components/Brand";
import PasswordInput from "@/components/PasswordInput";

export default async function ClientRegister({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;

  return (
    <main className="authShell">
      <section className="authStory">
        <Brand />
        <div className="authStoryContent">
          <span>Join the Dizon&apos;s family</span>
          <h1>Thoughtful care, made personal.</h1>
          <p>Create a client account to register pets, reserve essentials, and schedule grooming.</p>
        </div>
        <small>Your account details are stored securely.</small>
      </section>
      <section className="authFormSide">
        <div className="authCard">
          <Link href="/">← Return home</Link>
          <h2>Create an account</h2>
          <p>Tell us who you are to start your pet-care profile.</p>
          {error && <div className="authError">{error === "exists" ? "That email is already registered." : "Please complete every required field correctly."}</div>}
          <form className="authForm" action="/api/auth/register" method="post">
            <div className="nameGrid">
              <label>First name<input name="firstName" required /></label>
              <label>Surname<input name="surname" required /></label>
              <label>M.I.<input name="middleInitial" maxLength={2} /></label>
            </div>
            <label>Phone number<input type="tel" name="phone" inputMode="tel" required /></label>
            <label>Email address<input type="email" name="email" autoComplete="email" required /></label>
            <label>Password<PasswordInput name="password" minLength={8} autoComplete="new-password" required /></label>
            <button type="submit">Create Account</button>
          </form>
          <p className="authMeta">Already registered? <Link href="/client/login">Login here</Link></p>
        </div>
      </section>
    </main>
  );
}
