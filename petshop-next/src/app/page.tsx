import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import ContactFooter from "@/components/ContactFooter";

export default function Home() {
  return (
    <>
      <PublicHeader />
      <main className="landing">
        <section className="hero">
          <div className="heroInner">
            <div className="heroText">
              <span className="eyebrow">Premium care for every companion</span>
              <h1>Happy pets.<br />Beautifully cared for.</h1>
              <p>Book thoughtful grooming, reserve trusted essentials, and keep every pet-care detail organized in one elegant experience.</p>
              <div className="heroButtons">
                <Link href="/client/register" className="primaryButton">Create Account</Link>
                <Link href="/client/login" className="outlineButton">Login to Your Account</Link>
              </div>
              <div className="trustRow"><span><b>30+</b>Pet essentials</span><span><b>5</b>Grooming packages</span><span><b>9 AM–7 PM</b>Pickup reservation</span></div>
            </div>
            <div className="heroVisual" aria-hidden="true">
              <article className="careCard main"><div className="careIcon">🐶</div><small>Next care visit</small><h3>Fresh & polished</h3><p>Asian Fusion grooming with your preferred specialist.</p><div className="appointmentLine"><span>SEP 18 · 10:00 AM</span><strong>Confirmed</strong></div></article>
              <article className="careCard floating"><small>Care profile</small><strong>Makmak</strong><span>Healthy · Happy · Ready</span></article>
            </div>
          </div>
        </section>

        <section className="section" id="services"><div className="sectionHeading"><span className="eyebrow">Complete pet care</span><h2>Everything they need, in one place.</h2><p>Designed to make everyday care effortless for pet parents and comfortable for every companion.</p></div><div className="serviceGrid">
          <article className="serviceCard"><span>✂️</span><h3>Grooming care</h3><p>Choose a package, pet size, specialist, and schedule with a guided reservation flow.</p><Link href="/client/login">Book an appointment →</Link></article>
          <article className="serviceCard"><span>🛍️</span><h3>Pet essentials</h3><p>Reserve food, shampoo, hygiene products, toys, and accessories for convenient pickup.</p><Link href="/client/login">Browse products →</Link></article>
          <article className="serviceCard"><span>🐾</span><h3>Pet profiles</h3><p>Keep pet details, preferences, appointment history, and reservations organized.</p><Link href="/client/register">Create a profile →</Link></article>
        </div></section>

        <section className="portalSection"><div className="portalInner"><div className="sectionHeading"><span className="eyebrow">Your pet-care account</span><h2>Start fresh or welcome back.</h2><p>Create a verified account or securely return to your personal pet-care dashboard.</p></div><div className="portalGrid">
          <Link href="/client/login" className="portalCard"><span className="portalIcon">🐕</span><span className="portalLabel">Pet parent portal</span><h3>Login</h3><p>Manage pets, grooming appointments, product reservations, pickup details, and your personal profile.</p><span>Continue as client →</span></Link>
          <Link href="/client/register" className="portalCard admin"><span className="portalIcon">🐾</span><span className="portalLabel">New pet parent</span><h3>Create account</h3><p>Verify your email, complete your customer details, and add your first pet profile.</p><span>Begin registration →</span></Link>
        </div></div></section>

        <section className="section experience" id="experience"><div className="experienceVisual" /><div className="experienceCopy"><span className="eyebrow">A calmer way to care</span><h2>A premium experience from booking to pickup.</h2><p>Your system keeps the important things close: the next appointment, reserved products, available inventory, and account updates.</p><div className="featureList"><div><span>✓</span><b>Clear reservations</b><small>Live status and easy cancellation.</small></div><div><span>✓</span><b>Reliable inventory</b><small>Quantity is held as soon as a product is reserved.</small></div><div><span>✓</span><b>Protected client account</b><small>Your personal pet-care details stay private.</small></div></div></div></section>

        <section className="section"><div className="landingCta"><h2>Ready to care beautifully?</h2><p>Create your account or return to your personalized pet-care dashboard.</p><div className="heroButtons"><Link href="/client/register" className="primaryButton">Register Account</Link><Link href="/client/login" className="outlineButton">Login</Link></div></div></section>
      </main>
      <ContactFooter />
    </>
  );
}
