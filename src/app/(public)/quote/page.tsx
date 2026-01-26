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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);

    // Send email via API
    try {
      await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'hello@californiamailer.com',
          subject: `Quote Request: ${formData.serviceType.toUpperCase()} - ${formData.business}`,
          text: `
New Quote Request

Name: ${formData.name}
Email: ${formData.email}
Phone: ${formData.phone}
Business: ${formData.business}

Service Type: ${formData.serviceType}
Target City: ${formData.city}
Quantity: ${formData.quantity}

Message:
${formData.message}
          `,
        }),
      });
    } catch (error) {
      console.error('Email error:', error);
    }

    setSending(false);
    setSubmitted(true);
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
            Thanks {formData.name}! We'll review your request and get back to you within 24 hours with a custom quote.
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
              Tell us about your project and we'll send you a custom quote within 24 hours.
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
                    placeholder="(831) 555-0100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Service Type *</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'coop', label: 'Co-op Spot', desc: '$299-$500' },
                    { value: 'eddm', label: 'EDDM', desc: '$0.24+/pc' },
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

              <button
                type="submit"
                disabled={sending}
                className="w-full bg-blue-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {sending ? 'Sending...' : 'Get My Free Quote'}
              </button>

              <p className="text-center text-sm text-gray-500">
                No obligation. We'll respond within 24 hours.
              </p>
            </form>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-bold mb-4">Why Choose CaliforniaMailer?</h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="text-green-500 mt-1">✓</span>
                  <div>
                    <div className="font-medium">All-Inclusive Pricing</div>
                    <div className="text-sm text-gray-500">Design, print, postage — no hidden fees</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 mt-1">✓</span>
                  <div>
                    <div className="font-medium">2-Week Turnaround</div>
                    <div className="text-sm text-gray-500">From approval to mailboxes</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 mt-1">✓</span>
                  <div>
                    <div className="font-medium">Category Exclusivity</div>
                    <div className="text-sm text-gray-500">No competitors on your card</div>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 mt-1">✓</span>
                  <div>
                    <div className="font-medium">Free Design Revisions</div>
                    <div className="text-sm text-gray-500">Until you're 100% happy</div>
                  </div>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div className="bg-blue-50 rounded-xl border border-blue-100 p-6">
              <h3 className="font-bold mb-4">Prefer to Talk?</h3>
              <p className="text-gray-600 mb-4">
                Have questions? We're happy to help you figure out the best option for your business.
              </p>
              <div className="space-y-2 text-sm">
                <div>📧 hello@californiamailer.com</div>
                <div>📞 (831) 555-0100</div>
              </div>
            </div>

            {/* Recent Campaigns */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-bold mb-4">Recent Campaigns</h3>
              <div className="space-y-4 text-sm">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Salinas Co-op #47</div>
                    <div className="text-gray-500">12,500 homes</div>
                  </div>
                  <span className="text-green-600 font-medium">Delivered</span>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Monterey EDDM</div>
                    <div className="text-gray-500">8,200 homes</div>
                  </div>
                  <span className="text-blue-600 font-medium">In Transit</span>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">Carmel Valley Co-op #12</div>
                    <div className="text-gray-500">6,800 homes</div>
                  </div>
                  <span className="text-purple-600 font-medium">Printing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
