'use client'

import { useState } from 'react'

interface FormState {
  firstName: string
  lastName: string
  email: string
  phone: string
  interest: string
  message: string
}

const INITIAL: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  interest: '',
  message: '',
}

export default function ConsignForm() {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    try {
      const res = await fetch('/api/consign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Submission failed')
      setStatus('success')
      setForm(INITIAL)
    } catch {
      setStatus('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="firstName" className="form-label">First Name <span className="text-gold">*</span></label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            required
            value={form.firstName}
            onChange={handleChange}
            placeholder="Jane"
            className="form-input"
            autoComplete="given-name"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="lastName" className="form-label">Last Name <span className="text-gold">*</span></label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            required
            value={form.lastName}
            onChange={handleChange}
            placeholder="Smith"
            className="form-input"
            autoComplete="family-name"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="form-label">Email <span className="text-gold">*</span></label>
        <input
          id="email"
          name="email"
          type="email"
          required
          value={form.email}
          onChange={handleChange}
          placeholder="jane@example.com"
          className="form-input"
          autoComplete="email"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="phone" className="form-label">Phone</label>
        <input
          id="phone"
          name="phone"
          type="tel"
          value={form.phone}
          onChange={handleChange}
          placeholder="(512) 000-0000"
          className="form-input"
          autoComplete="tel"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="interest" className="form-label">Interested In <span className="text-gold">*</span></label>
        <select
          id="interest"
          name="interest"
          required
          value={form.interest}
          onChange={handleChange}
          className="form-input appearance-none cursor-pointer"
        >
          <option value="">Select a service...</option>
          <option value="real-estate">Real Estate</option>
          <option value="fine-art">Fine Art</option>
          <option value="both">Both</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="message" className="form-label">Message</label>
        <textarea
          id="message"
          name="message"
          rows={5}
          value={form.message}
          onChange={handleChange}
          placeholder="Tell us about your property, artwork, or any questions you have..."
          className="form-input resize-y min-h-[120px]"
        />
      </div>

      {status === 'success' && (
        <div className="bg-gold/10 border border-gold px-5 py-4 font-sans font-light text-[14px] text-charcoal" role="alert">
          ✓ Thank you — a Rivet specialist will be in touch with you shortly.
        </div>
      )}

      {status === 'error' && (
        <div className="bg-red-50 border border-red-200 px-5 py-4 font-sans font-light text-[14px] text-red-700" role="alert">
          Something went wrong. Please call us directly at (512) 796-9395.
        </div>
      )}

      <button
        type="submit"
        disabled={status === 'loading'}
        className="btn-gold w-full md:w-auto px-12 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {status === 'loading' ? 'Submitting...' : 'Submit Inquiry →'}
      </button>
    </form>
  )
}
