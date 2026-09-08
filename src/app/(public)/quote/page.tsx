"use client";
import { useEffect, useState } from "react";
import PublicSiteShell from "@/components/PublicSiteShell";
import Link from "next/link";
const empty = {
  name: "",
  business: "",
  email: "",
  phone: "",
  serviceType: "coop",
  city: "",
  quantity: "1",
  message: "",
};
export default function QuotePage() {
  const [form, setForm] = useState(empty),
    [sending, setSending] = useState(false),
    [submitted, setSubmitted] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const service = params.get("service");
    const area = params.get("area");
    if (area) setForm((f) => ({ ...f, city: area.slice(0, 80) }));
    if (service && ["eddm", "design", "solo", "coop"].includes(service))
      setForm((f) => ({
        ...f,
        serviceType: service,
        quantity: service === "coop" ? "1" : "2500",
      }));
  }, []);
  function field(key: keyof typeof empty, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;
    const data = new FormData(e.currentTarget);
    setSending(true);
    setError("");
    try {
      const r = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "quote",
          ...form,
          website: data.get("website"),
        }),
      });
      const result = await r.json();
      if (!r.ok || result.success !== true) throw Error();
      setSubmitted(true);
    } catch {
      setError(
        "Your request was not accepted. Your details are still here. Please try again later.",
      );
    } finally {
      setSending(false);
    }
  }
  return (
    <PublicSiteShell>
      <section className="cm-section cm-split cm-quote">
        <div>
          <p className="cm-eyebrow">LET’S PLAN YOUR MAILING</p>
          <h1>
            {submitted ? "Request submitted." : "Start with your neighborhood."}
          </h1>
          {submitted ? (
            <div role="status">
              <p>
                Your request was accepted by our email service for review. This
                is not an order or delivery confirmation. We will use the
                contact details you provided to respond.
              </p>
              <Link className="cm-button" href="/home">
                Back to home
              </Link>
            </div>
          ) : (
            <>
              <p>
                Tell us where you want to reach and what you need. No payment,
                mailing list, or account required.
              </p>
              <form className="cm-form" onSubmit={submit}>
                <div className="cm-form-grid">
                  {[
                    ["name", "Your name", "text"],
                    ["business", "Business name", "text"],
                    ["email", "Email address", "email"],
                    ["phone", "Phone (optional)", "tel"],
                  ].map(([key, label, type]) => (
                    <div key={key}>
                      <label htmlFor={"quote-" + key}>{label}</label>
                      <input
                        id={"quote-" + key}
                        name={key}
                        type={type}
                        required={key !== "phone"}
                        maxLength={key === "email" ? 254 : 120}
                        autoComplete={
                          key === "name"
                            ? "name"
                            : key === "email"
                              ? "email"
                              : key === "phone"
                                ? "tel"
                                : "organization"
                        }
                        value={form[key as keyof typeof empty]}
                        onChange={(e) =>
                          field(key as keyof typeof empty, e.target.value)
                        }
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label htmlFor="quote-service">What do you need?</label>
                  <select
                    id="quote-service"
                    value={form.serviceType}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        serviceType: e.target.value,
                        quantity: e.target.value === "coop" ? "1" : "2500",
                      }))
                    }
                  >
                    <option value="eddm">EDDM campaign planning</option>
                    <option value="design">Design & print support</option>
                    <option value="solo">Custom direct mail</option>
                    <option value="coop">Ask about a co-op mailing</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="quote-area">
                    Target city, ZIP codes, or neighborhoods
                  </label>
                  <input
                    id="quote-area"
                    required
                    maxLength={80}
                    placeholder="For example: Salinas, 93901"
                    value={form.city}
                    onChange={(e) => field("city", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="quote-quantity">
                    {form.serviceType === "coop"
                      ? "Requested spots"
                      : "Approximate number of pieces"}
                  </label>
                  <select
                    id="quote-quantity"
                    value={form.quantity}
                    onChange={(e) => field("quantity", e.target.value)}
                  >
                    {(form.serviceType === "coop"
                      ? [
                          ["1", "1 spot"],
                          ["2", "2 spots"],
                          ["3", "3 or more spots"],
                        ]
                      : [
                          ["500", "About 500"],
                          ["1000", "About 1,000"],
                          ["2500", "About 2,500"],
                          ["5000", "About 5,000"],
                          ["10000", "10,000 or more"],
                          ["unsure", "Help me choose"],
                        ]
                    ).map(([v, label]) => (
                      <option value={v} key={v}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="quote-message">
                    Your goal, artwork needs, and preferred timing (optional)
                  </label>
                  <textarea
                    id="quote-message"
                    maxLength={2000}
                    value={form.message}
                    onChange={(e) => field("message", e.target.value)}
                    placeholder="Tell us about the offer, audience, and whether you have artwork ready."
                  />
                </div>
                <div hidden aria-hidden="true">
                  <label htmlFor="quote-website">Website</label>
                  <input
                    id="quote-website"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>
                {error && (
                  <p role="alert" className="cm-error">
                    {error}
                  </p>
                )}
                <button className="cm-button" disabled={sending}>
                  {sending ? "Submitting…" : "Request a written quote ↗"}
                </button>
                <p className="cm-fine" style={{ marginTop: 18 }}>
                  By submitting, you ask us to respond about this request. Do
                  not include customer lists, payment details, or sensitive
                  information. Read our{" "}
                  <Link href="/privacy">privacy policy</Link>.
                </p>
              </form>
            </>
          )}
        </div>
        <aside className="cm-panel">
          <h2>What happens next?</h2>
          <h3>1. Request review</h3>
          <p>
            Your area, quantity, and service needs are reviewed for
            availability.
          </p>
          <h3>2. Written quote</h3>
          <p>
            Review the scope, design and printing costs, postage assumptions,
            and schedule before agreeing to work.
          </p>
          <h3>3. Proof and approval</h3>
          <p>
            Final artwork and mailing details require written approval before
            production.
          </p>
          <p className="cm-fine">
            Checkout remains disabled. No charge, order, or mailing reservation
            is created by this form.
          </p>
          <a
            className="cm-text-link"
            href="https://eddm.usps.com/eddm/select-routes.htm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore USPS routes (new tab) ↗
          </a>
        </aside>
      </section>
    </PublicSiteShell>
  );
}
