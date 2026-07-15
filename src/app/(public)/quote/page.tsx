'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function QuotePage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    business: '',
    serviceType: 'coop',
    city: '',
    quantity: '5000',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submittedForm = new FormData(e.currentTarget);
    setSending(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'quote',
          ...formData,
          website: submittedForm.get('website'),
        }),
      });
      if (!response.ok) throw new Error('delivery');
      setSubmitted(true);
    } catch {
      setErrorMessage('We could not deliver your request. Please email hello@californiamailer.com.');
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b">
          <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            <Link href="/home" className="text-2xl font-bold text-blue-600">CaliforniaMailer</Link>
          </div>
        </nav>
        <div className="max-w-2xl mx-auto px-6 py-20 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✓</span>
          </div>
          <h1 className="text-3xl font-bold mb-4">Quote Request Received!</h1>
          <p className="text-gray-600 mb-8">
            Thanks {formData.name}! Your request was delivered for review. We will respond using the contact information you provided.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/home" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
              Back to Home
            </Link>
            <Link href="/coop-board" className="border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50">
              View Co-op Board
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link href="/home" className="text-2xl font-bold text-blue-600">CaliforniaMailer</Link>
          <div className="hidden md:flex items-center gap-6">
            <Link href="/services" className="text-gray-600 hover:text-gray-900">Services</Link>
            <Link href="/coop-board" className="text-gray-600 hover:text-gray-900">Co-op Board</Link>
            <Link href="/" className="text-gray-500 hover:text-gray-700 text-sm">Client Login</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Form */}
          <div>
            <h1 className="text-3xl font-bold mb-2">Get Your Free Quote</h1>
            <p className="text-gray-600 mb-8">
              Tell us about your project and we will review the details before sending a written quote.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Your Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full border rounded-lg px-4 py-3"
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Business Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.business}
                    onChange={(e) => setFormData({ ...formData, business: e.target.value })}
                    className="w-full border rounded-lg px-4 py-3"
                    placeholder="Acme Plumbing"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border rounded-lg px-4 py-3"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border rounded-lg px-4 py-3"
                    placeholder="Optional phone number"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Service Type *</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'coop', label: 'Co-op Spot', desc: '$299-$500' },
                    { value: 'eddm', label: 'EDDM', desc: 'Written quote' },
                    { value: 'solo', label: 'Solo Mailer', desc: 'Custom' },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className={`border rounded-lg p-4 cursor-pointer transition-all ${
                        formData.serviceType === option.value
                          ? 'border-blue-600 bg-blue-50'
                          : 'hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="serviceType"
                        value={option.value}
                        checked={formData.serviceType === option.value}
                        onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                        className="sr-only"
                      />
                      <div className="font-medium">{option.label}</div>
                      <div className="text-sm text-gray-500">{option.desc}</div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Target City/Area *</label>
                  <select
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full border rounded-lg px-4 py-3"
                  >
                    <option value="">Select an area...</option>
                    <option value="salinas">Salinas</option>
                    <option value="monterey">Monterey</option>
                    <option value="carmel">Carmel / Carmel Valley</option>
                    <option value="pacific-grove">Pacific Grove</option>
                    <option value="seaside">Seaside</option>
                    <option value="marina">Marina</option>
                    <option value="other">Other (specify below)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {formData.serviceType === 'coop' ? 'Spots Needed' : 'Quantity'}
                  </label>
                  <select
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full border rounded-lg px-4 py-3"
                  >
                    {formData.serviceType === 'coop' ? (
                      <>
                        <option value="1">1 spot</option>
                        <option value="2">2 spots</option>
                        <option value="3">3+ spots</option>
                      </>
                    ) : (
                      <>
                        <option value="2500">2,500 pieces</option>
                        <option value="5000">5,000 pieces</option>
                        <option value="10000">10,000 pieces</option>
                        <option value="15000">15,000 pieces</option>
                        <option value="20000">20,000+ pieces</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Additional Details</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full border rounded-lg px-4 py-3"
                  rows={4}
                  placeholder="Tell us more about your goals, timeline, or any specific neighborhoods you want to target..."
                />
              </div>

              <div className="hidden" aria-hidden="true">
                <label htmlFor="quote-website">Website</label>
                <input id="quote-website" name="website" tabIndex={-1} autoComplete="off" />
              </div>

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {sending ? 'Sending...' : 'Get My Free Quote'}
              </button>

              {errorMessage && <p className="text-center text-sm text-red-700" role="alert">{errorMessage}</p>}

              <p className="text-center text-sm text-gray-500">
                No obligation. By submitting, you ask us to use these details to respond to your quote request. See our{' '}
                <Link href="/privacy" className="text-blue-600 underline">privacy policy</Link>.
              </p>
            </form>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-bold mb-4">What the written quote covers</h3>
              <p className="text-sm leading-6 text-gray-600">
                The quote will identify the requested service, estimated quantity, included work,
                postage assumptions, schedule, and payment terms. Nothing is charged through this form.
              </p>
            </div>

            {/* Contact Info */}
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-6">
              <h3 className="font-bold mb-4">Prefer to Talk?</h3>
              <p className="text-gray-600 mb-4">
                Have questions? We&apos;re happy to help you figure out the best option for your business.
              </p>
              <div className="text-sm">📧 hello@californiamailer.com</div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
