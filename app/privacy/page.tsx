import Link from "next/link";

export const dynamic = "force-static";

const LAST_UPDATED = "June 3, 2026";

export const metadata = {
  title: "Privacy Policy — BullionDesk",
  description: "BullionDesk Privacy Policy. How we collect, use, and protect your data.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-medium tracking-[-0.01em] text-white">{title}</h2>
      <div className="text-[14px] leading-relaxed text-white/60 space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="text-white space-y-5">
      <div className="card rounded-3xl border border-white/10 overflow-hidden">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[rgba(212,175,55,0.45)] to-transparent" />

        <div className="p-8 sm:p-12 space-y-10">
          {/* Header */}
          <div>
            <p className="text-[10px] tracking-[0.22em] uppercase text-[color:var(--gold)] mb-4">
              Legal
            </p>
            <h1 className="text-[28px] sm:text-[38px] leading-[1.1] tracking-[-0.025em] font-normal mb-3">
              Privacy Policy
            </h1>
            <p className="text-[13px] text-white/35">Last updated: {LAST_UPDATED}</p>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Intro */}
          <p className="text-[14px] leading-relaxed text-white/60">
            This Privacy Policy explains how BullionDesk (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or
            &ldquo;our&rdquo;) collects, uses, and protects information about you when you use our
            Service at{" "}
            <span className="text-white/80">bulliondesk.pro</span>. By using the Service, you
            agree to the practices described in this policy.
          </p>

          <Section title="1. Information We Collect">
            <p>
              <strong className="text-white/80">Account information.</strong> When you create an
              account, we collect your email address and a hashed password. We do not collect
              your name unless you provide it voluntarily in your profile.
            </p>
            <p>
              <strong className="text-white/80">Payment information.</strong> Payments are
              processed by Stripe. We do not store your credit card number, CVV, or banking
              details on our servers. We only store a record of your payment status (paid / not
              paid) and the Stripe session identifier for verification purposes.
            </p>
            <p>
              <strong className="text-white/80">Usage data.</strong> We collect data about how
              you interact with the Service, including chat messages you submit, trading levels
              you save, and general usage patterns. This data is used to provide and improve
              the Service.
            </p>
            <p>
              <strong className="text-white/80">Profile data.</strong> If you use profile
              features (avatar, trading preferences), we store this information to personalize
              your experience.
            </p>
            <p>
              <strong className="text-white/80">Technical data.</strong> We may collect IP
              addresses and request metadata for security purposes, including rate limiting and
              fraud prevention. This data is not used for advertising.
            </p>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>Provide, operate, and maintain the Service.</li>
              <li>Verify your identity and manage your account.</li>
              <li>Process your payment and grant access to paid features.</li>
              <li>Personalize your AI coaching experience based on your trading profile.</li>
              <li>Send transactional emails (account confirmation, password reset, morning briefings if opted in).</li>
              <li>Detect and prevent abuse, fraud, and security threats.</li>
              <li>Comply with our legal obligations.</li>
            </ul>
            <p>
              We do not use your data to train external AI models. Your chat messages are used
              only to generate your responses in real time and are stored solely to provide
              conversation history within your account.
            </p>
          </Section>

          <Section title="3. Data Sharing">
            <p>
              <strong className="text-white/80">We do not sell your personal data</strong> to
              third parties. We do not share your data for advertising purposes.
            </p>
            <p>We share your information only with the following trusted service providers, strictly to operate the Service:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>
                <strong className="text-white/80">Supabase</strong> — database and authentication
                infrastructure. Your data is stored on Supabase servers.
              </li>
              <li>
                <strong className="text-white/80">Stripe</strong> — payment processing.
                Stripe processes your payment under their own privacy policy.
              </li>
              <li>
                <strong className="text-white/80">Anthropic</strong> — AI inference. Your
                messages are sent to Anthropic&apos;s API to generate responses. Anthropic
                does not train on API inputs by default.
              </li>
              <li>
                <strong className="text-white/80">Resend</strong> — transactional email delivery.
              </li>
              <li>
                <strong className="text-white/80">Vercel</strong> — hosting and infrastructure.
              </li>
            </ul>
            <p>
              We may disclose your information if required by law, court order, or governmental
              authority.
            </p>
          </Section>

          <Section title="4. Cookies and Session Storage">
            <p>
              We use cookies strictly necessary for the Service to function. Specifically:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>
                <strong className="text-white/80">Supabase session cookies</strong> — used to
                maintain your authenticated session across page loads. These are
                HttpOnly and Secure in production.
              </li>
              <li>
                <strong className="text-white/80">Admin bypass cookie</strong> — a short-lived
                cookie used for internal admin access only.
              </li>
            </ul>
            <p>
              We do not use tracking cookies, analytics cookies, or advertising cookies.
              No third-party tracking scripts are loaded on the Service.
            </p>
          </Section>

          <Section title="5. Data Retention">
            <p>
              We retain your account data for as long as your account is active. If you delete
              your account, we will delete your personal data (email, profile, chat history)
              within 30 days, except where we are required by law to retain it longer.
            </p>
            <p>
              Anonymized or aggregated data that cannot be linked to you personally may be
              retained indefinitely for service improvement purposes.
            </p>
          </Section>

          <Section title="6. Your Rights">
            <p>Depending on your location, you may have the following rights:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li><strong className="text-white/80">Access.</strong> Request a copy of the personal data we hold about you.</li>
              <li><strong className="text-white/80">Correction.</strong> Request correction of inaccurate or incomplete data.</li>
              <li><strong className="text-white/80">Deletion.</strong> Request deletion of your account and personal data.</li>
              <li><strong className="text-white/80">Portability.</strong> Request your data in a portable format.</li>
              <li><strong className="text-white/80">Objection.</strong> Object to certain processing of your data.</li>
            </ul>
            <p>
              To exercise any of these rights, you can delete your account directly from your
              Profile settings, or contact us at{" "}
              <a
                href="mailto:privacy@bulliondesk.pro"
                className="text-white/80 underline underline-offset-2 hover:text-[color:var(--gold)] transition"
              >
                privacy@bulliondesk.pro
              </a>
              . We will respond within 30 days.
            </p>
          </Section>

          <Section title="7. Security">
            <p>
              We implement industry-standard security measures to protect your data, including
              encrypted connections (HTTPS/TLS), HttpOnly and Secure session cookies,
              Row Level Security (RLS) on our database, and strict access controls.
            </p>
            <p>
              However, no system is completely secure. We cannot guarantee the absolute security
              of your information. In the event of a data breach that affects your rights, we
              will notify you as required by applicable law.
            </p>
          </Section>

          <Section title="8. Children&apos;s Privacy">
            <p>
              The Service is not directed at children under the age of 18. We do not knowingly
              collect personal information from minors. If you believe a minor has provided us
              with personal data, please contact us and we will delete it promptly.
            </p>
          </Section>

          <Section title="9. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. Changes will be posted on
              this page with a revised &ldquo;Last updated&rdquo; date. Continued use of the
              Service after changes are posted constitutes your acceptance of the revised policy.
            </p>
          </Section>

          <Section title="10. Contact">
            <p>
              For privacy-related requests or questions, contact us at{" "}
              <a
                href="mailto:privacy@bulliondesk.pro"
                className="text-white/80 underline underline-offset-2 hover:text-[color:var(--gold)] transition"
              >
                privacy@bulliondesk.pro
              </a>
              .
            </p>
          </Section>

          <div className="h-px bg-white/[0.06]" />

          <div className="flex flex-wrap gap-4 text-[12px] text-white/30">
            <Link href="/terms" className="hover:text-white/60 transition">Terms of Service</Link>
            <Link href="/" className="hover:text-white/60 transition">← Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
