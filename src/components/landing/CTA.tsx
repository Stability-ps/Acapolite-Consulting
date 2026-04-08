import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Mail, MessageCircleMore, PhoneCall } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const contactEmail = "info@acapoliteconsulting.co.za";
const whatsappNumber = "+27 67 5775506";
const whatsappHref = "https://wa.me/27675775506";

export function CTA() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setSubmitting(true);

    void supabase.functions
      .invoke("send-portal-email", {
        body: {
          type: "contact_form",
          name,
          email,
          subject,
          message,
        },
      })
      .then(({ error }) => {
        if (error) {
          toast.error(error.message || "Unable to send your message right now.");
          return;
        }

        toast.success("Your message has been sent to Acapolite Consulting.");
        setName("");
        setEmail("");
        setSubject("");
        setMessage("");
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Unable to send your message right now.");
      })
      .finally(() => {
        setSubmitting(false);
      });
  };

  return (
    <section id="contact" className="relative overflow-hidden bg-surface-gradient py-24 scroll-mt-32">
      <div className="absolute inset-0 opacity-100">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 18%, rgba(59,130,246,0.12) 0%, transparent 26%), radial-gradient(circle at 82% 14%, rgba(14,165,233,0.10) 0%, transparent 24%), radial-gradient(circle at 50% 100%, rgba(255,255,255,0.7) 0%, transparent 42%)",
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-sky-100/70 to-transparent" />

      <div className="container relative z-10 mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14 max-w-3xl"
        >
          <span className="mb-3 inline-flex rounded-full border border-primary/12 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary/80 shadow-[0_10px_28px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
            Contact
          </span>
          <h2 className="mb-4 font-display text-3xl font-bold text-foreground md:text-5xl">
            Speak to Acapolite Consulting
          </h2>
          <p className="max-w-2xl text-lg font-body text-muted-foreground">
            Reach out for tax support, SARS follow-ups, filing help, document guidance, or onboarding questions. You can message us on WhatsApp or send a detailed contact request below.
          </p>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-[1.05fr_1.2fr]">
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-[2rem] border border-primary/10 bg-[linear-gradient(180deg,rgba(18,78,170,0.98),rgba(15,23,42,0.98))] p-7 text-white shadow-[0_28px_80px_-34px_rgba(15,23,42,0.55)]"
          >
            <div className="mb-8">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-sky-100/70">
                Direct Contact
              </p>
              <h3 className="font-display text-2xl font-semibold text-white">
                Prefer to contact us directly?
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-200/78">
                Reach our team quickly using WhatsApp or email for tax support, onboarding, and compliance questions.
              </p>
            </div>

            <div className="space-y-4">
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="group flex items-start gap-4 rounded-2xl border border-white/12 bg-white/8 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-sky-200/40 hover:bg-white/12"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/18 text-emerald-100">
                  <MessageCircleMore className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">{whatsappNumber}</p>
                  <p className="mt-1 text-sm text-slate-200/82">Chat with our team for quick help and updates.</p>
                </div>
              </a>

              <a
                href={`mailto:${contactEmail}`}
                className="group flex items-start gap-4 rounded-2xl border border-white/12 bg-white/8 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-sky-200/40 hover:bg-white/12"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-300/18 text-sky-100">
                  <Mail className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white break-all">{contactEmail}</p>
                  <p className="mt-1 text-sm text-slate-200/82">Best for detailed tax and compliance enquiries.</p>
                </div>
              </a>

              <div className="flex items-start gap-4 rounded-2xl border border-white/12 bg-white/8 p-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/12 text-white">
                  <PhoneCall className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-semibold text-white">Individuals and businesses</p>
                  <p className="mt-1 text-sm text-slate-200/82">Tax returns, SARS issues, supporting documents, billing, and consultant follow-up.</p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-xl border border-emerald-200/20 bg-emerald-400/18 px-6 !text-white shadow-[0_18px_34px_-24px_rgba(16,185,129,0.45)] hover:bg-emerald-400/24"
              >
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="text-white">
                  WhatsApp Us
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-xl border-white/16 bg-white/8 px-6 !text-white hover:bg-white/14 hover:!text-white"
              >
                <Link to="/register" className="text-white">
                  Create Account
                </Link>
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 18 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="rounded-[2rem] border border-primary/10 bg-white/96 p-7 shadow-[0_30px_80px_-34px_rgba(15,23,42,0.26)]"
          >
            <div className="mb-8">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.22em] text-primary/72">
                Contact Form
              </p>
              <h3 className="font-display text-2xl font-semibold text-foreground">
                Send us your enquiry
              </h3>
              <p className="mt-2 text-sm font-body leading-6 text-muted-foreground">
                Fill in your details and your email app will open with your message ready to send to our team.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact-name" className="font-body text-foreground">
                    Name
                  </Label>
                  <Input
                    id="contact-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your full name"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact-email" className="font-body text-foreground">
                    Email
                  </Label>
                  <Input
                    id="contact-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-subject" className="font-body text-foreground">
                  Subject
                </Label>
                <Input
                  id="contact-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="How can we help?"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-message" className="font-body text-foreground">
                  Message
                </Label>
                <Textarea
                  id="contact-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Tell us about your tax matter, deadline, or question."
                  className="min-h-[160px]"
                  required
                />
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200/90 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-body text-muted-foreground">
                  Contact email:
                  {" "}
                  <span className="font-semibold text-foreground">{contactEmail}</span>
                </p>
                <Button type="submit" size="lg" className="rounded-xl px-7" disabled={submitting}>
                  {submitting ? "Sending..." : "Send Message"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
