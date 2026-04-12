import { AcapoliteLogo } from "@/components/branding/AcapoliteLogo";

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-surface-gradient px-4 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-4xl">
        <div className="rounded-[32px] border border-border bg-card p-6 shadow-elevated sm:p-10">
          <AcapoliteLogo className="mb-6 h-12" />
          <p className="text-xs uppercase tracking-[0.2em] text-primary/70 font-body">Legal</p>
          <h1 className="mt-2 font-display text-3xl text-foreground sm:text-4xl">Cookie Policy — Acapolite Consulting</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground font-body sm:text-base">
            This Cookie Policy explains how Acapolite Consulting uses cookies and similar technologies when you visit
            our website or use our platform. By continuing to use our services, you agree to the use of cookies as
            described in this policy.
          </p>

          <div className="mt-8 space-y-6 text-sm text-foreground font-body">
            <section>
              <h2 className="text-lg font-semibold">1. What Are Cookies?</h2>
              <p className="mt-2 text-muted-foreground">
                Cookies are small text files stored on your device when you visit a website. They help websites
                remember your preferences and improve your overall experience.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">2. How We Use Cookies</h2>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>To maintain secure login sessions</li>
                <li>To remember user preferences and settings</li>
                <li>To improve website performance and functionality</li>
                <li>To monitor system security and detect suspicious activity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">3. Types of Cookies We Use</h2>
              <div className="mt-3 space-y-3 text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground">Essential Cookies</p>
                  <ul className="mt-2 list-disc pl-5">
                    <li>Required for login and authentication</li>
                    <li>Ensure secure access to dashboards</li>
                    <li>Allow users to navigate the platform</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Performance Cookies</p>
                  <ul className="mt-2 list-disc pl-5">
                    <li>Help measure platform performance</li>
                    <li>Identify areas that require improvement</li>
                    <li>Improve system reliability</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Security Cookies</p>
                  <ul className="mt-2 list-disc pl-5">
                    <li>Protect user accounts</li>
                    <li>Prevent unauthorized access</li>
                    <li>Monitor login activity</li>
                  </ul>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold">4. Managing Cookies</h2>
              <p className="mt-2 text-muted-foreground">
                Users can manage cookie settings through their web browser. You may disable cookies, but some
                features of the platform may not function properly.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Enable or disable cookies in browser settings</li>
                <li>Delete stored cookies from your device</li>
                <li>Block cookies from specific websites</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">5. Third-Party Cookies</h2>
              <p className="mt-2 text-muted-foreground">
                In some cases, trusted third-party services such as payment gateways or analytics tools may use
                cookies to support platform functionality.
              </p>
              <ul className="mt-3 list-disc pl-5 text-muted-foreground">
                <li>Secure payment processing systems</li>
                <li>Platform performance monitoring tools</li>
                <li>Security verification services</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">6. Updates to This Policy</h2>
              <p className="mt-2 text-muted-foreground">
                Acapolite Consulting may update this Cookie Policy when required. Any changes will be posted on
                this page.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold">7. Contact Information</h2>
              <p className="mt-2 text-muted-foreground">
                If you have questions about this Cookie Policy, please contact info@acapoliteconsulting.co.za.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
