import Link from "next/link";

const LAST_UPDATED = "June 3, 2026";

export const metadata = {
  title: "Terms of Service — BullionDesk",
  description: "BullionDesk Terms of Service. Read before using our AI gold trading analysis tool.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[15px] font-medium tracking-[-0.01em] text-white">{title}</h2>
      <div className="text-[14px] leading-relaxed text-white/60 space-y-2">{children}</div>
    </section>
  );
}

export default function TermsPage() {
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
              Terms of Service
            </h1>
            <p className="text-[13px] text-white/35">Last updated: {LAST_UPDATED}</p>
          </div>

          <div className="h-px bg-white/[0.06]" />

          {/* Intro */}
          <p className="text-[14px] leading-relaxed text-white/60">
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of BullionDesk
            (the &ldquo;Service&rdquo;), operated by BullionDesk (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or
            &ldquo;our&rdquo;). By accessing or using the Service, you agree to be bound by these Terms.
            If you do not agree, do not use the Service.
          </p>

          <Section title="1. Nature of the Service">
            <p>
              BullionDesk is an AI-powered educational and analytical tool designed to help traders
              analyze the XAUUSD (gold) market. The Service provides market analysis, research
              context, and coaching-style commentary based on publicly available data and
              AI-generated insights.
            </p>
            <p>
              <strong className="text-white/80">BullionDesk is not a licensed financial advisor,
              broker, or investment firm.</strong> Nothing on the Service constitutes financial
              advice, investment advice, trading advice, or any other form of advice. All content
              is provided for educational and informational purposes only.
            </p>
            <p>
              Past analysis accuracy does not guarantee future results. Markets are inherently
              unpredictable. You should consult a licensed financial professional before making
              any investment or trading decisions.
            </p>
          </Section>

          <Section title="2. No Guarantee of Results">
            <p>
              We make no representations or warranties regarding the accuracy, completeness,
              timeliness, or suitability of any information provided through the Service.
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
              warranty of any kind, express or implied.
            </p>
            <p>
              Trading financial instruments, including gold (XAUUSD), involves substantial risk
              of loss and is not appropriate for all investors. You may lose all or more than
              your initial investment. BullionDesk accepts no liability for any losses incurred
              as a result of using the Service.
            </p>
          </Section>

          <Section title="3. User Responsibility">
            <p>
              You are solely responsible for your trading decisions and their consequences.
              By using the Service, you acknowledge that:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>You use the Service at your own risk.</li>
              <li>You will not rely solely on BullionDesk output to make trading decisions.</li>
              <li>You understand that AI-generated analysis can be incorrect or incomplete.</li>
              <li>You are solely responsible for any trades you execute.</li>
              <li>You comply with all laws and regulations applicable to your trading activity.</li>
            </ul>
          </Section>

          <Section title="4. Access and Account">
            <p>
              To access certain features, you must create an account with a valid email address.
              You are responsible for maintaining the confidentiality of your account credentials
              and for all activity that occurs under your account.
            </p>
            <p>
              We reserve the right to suspend or terminate your account at our discretion if you
              violate these Terms or engage in abusive behavior toward the Service or other users.
            </p>
          </Section>

          <Section title="5. Payment and Refund Policy">
            <p>
              Access to the BullionDesk Beta is provided on a one-time early-access payment basis.
              <strong className="text-white/80"> All sales are final. No refunds are issued</strong> for
              early access purchases, except where required by applicable law.
            </p>
            <p>
              Payments are processed securely by Stripe. BullionDesk does not store your payment
              card details. By completing a purchase, you agree to Stripe&apos;s terms of service.
            </p>
            <p>
              We reserve the right to modify pricing for future access tiers at any time without
              notice. Existing early-access purchasers will not be retroactively charged.
            </p>
          </Section>

          <Section title="6. Acceptable Use">
            <p>You agree not to:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2">
              <li>Use the Service to resell, sublicense, or redistribute access to third parties.</li>
              <li>Attempt to circumvent rate limiting, quotas, or authentication mechanisms.</li>
              <li>Use automated scripts or bots to abuse or overload the Service.</li>
              <li>Reverse engineer, decompile, or extract the underlying AI models or prompts.</li>
              <li>Use the Service in any way that violates applicable laws or regulations.</li>
              <li>Impersonate BullionDesk or its output as your own professional advice.</li>
            </ul>
            <p>
              Violation of these rules may result in immediate account suspension without refund.
            </p>
          </Section>

          <Section title="7. Intellectual Property">
            <p>
              All content, design, trademarks, and software comprising the Service are the
              exclusive property of BullionDesk or its licensors. You may not copy, reproduce,
              or distribute any part of the Service without prior written permission.
            </p>
            <p>
              AI-generated analysis is provided for your personal use only and may not be
              republished, sold, or represented as professional financial research.
            </p>
          </Section>

          <Section title="8. Modifications to the Service and Terms">
            <p>
              We reserve the right to modify, suspend, or discontinue any part of the Service
              at any time without notice. We also reserve the right to update these Terms at
              any time. Changes will be effective upon posting to this page, with the
              &ldquo;Last updated&rdquo; date revised accordingly.
            </p>
            <p>
              Continued use of the Service after changes are posted constitutes your acceptance
              of the revised Terms.
            </p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>
              To the fullest extent permitted by law, BullionDesk and its affiliates shall not
              be liable for any indirect, incidental, special, consequential, or punitive damages,
              including loss of profits, data, or goodwill, arising out of or in connection with
              your use of the Service.
            </p>
            <p>
              Our total liability to you for any claim arising from these Terms or your use of
              the Service shall not exceed the amount you paid us in the twelve (12) months
              preceding the claim.
            </p>
          </Section>

          <Section title="10. Governing Law">
            <p>
              These Terms are governed by and construed in accordance with the laws of France,
              without regard to its conflict of law principles. Any disputes arising under these
              Terms shall be subject to the exclusive jurisdiction of the courts of France.
            </p>
          </Section>

          <Section title="11. Contact">
            <p>
              For any questions regarding these Terms, please contact us at{" "}
              <a
                href="mailto:legal@bulliondesk.pro"
                className="text-white/80 underline underline-offset-2 hover:text-[color:var(--gold)] transition"
              >
                legal@bulliondesk.pro
              </a>
              .
            </p>
          </Section>

          <div className="h-px bg-white/[0.06]" />

          <div className="flex flex-wrap gap-4 text-[12px] text-white/30">
            <Link href="/privacy" className="hover:text-white/60 transition">Privacy Policy</Link>
            <Link href="/" className="hover:text-white/60 transition">← Back to Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
