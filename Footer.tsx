import Link from 'next/link'
import { PHONE_DISPLAY, PHONE_TEL, PHONE_SMS, EMAIL } from '@/lib/constants'

export default function Footer() {
  return (
    <footer className="bg-charcoal border-t border-gold/15 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-6 lg:px-10">

        {/* Top grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 pb-12 border-b border-gold/10">

          {/* Brand */}
          <div>
            <Link href="/" className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-gold flex items-center justify-center">
                <span className="font-serif text-base font-semibold text-charcoal">RA</span>
              </div>
              <div className="leading-tight">
                <span className="block font-serif text-[15px] font-medium text-cream-white tracking-[0.15em] uppercase">Rivet</span>
                <span className="block font-sans text-[8px] font-light tracking-[0.3em] uppercase text-gold-light">Auctions</span>
              </div>
            </Link>
            <p className="font-sans font-light text-[13px] text-white/40 leading-relaxed max-w-xs">
              Competitive real estate sales and fine art consignment — combining MLS exposure with structured competitive offers to maximize seller outcomes.
            </p>
          </div>

          {/* Navigate */}
          <div>
            <h3 className="section-label mb-4">Navigate</h3>
            <ul className="flex flex-col gap-3">
              {[
                { label: 'Home', href: '/' },
                { label: 'Real Estate', href: '/real-estate' },
                { label: 'Fine Art', href: '/fine-art' },
                { label: 'About Us', href: '/about' },
                { label: 'Consign', href: '/consign' },
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-sans text-[13px] text-white/45 hover:text-gold-light transition-colors duration-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="section-label mb-4">Contact</h3>
            <ul className="flex flex-col gap-3">
              <li>
                <a href={`tel:${PHONE_TEL}`} className="font-sans text-[13px] text-white/45 hover:text-gold-light transition-colors duration-200">
                  {PHONE_DISPLAY} — Call
                </a>
              </li>
              <li>
                <a href={`sms:${PHONE_TEL}`} className="font-sans text-[13px] text-white/45 hover:text-gold-light transition-colors duration-200">
                  {PHONE_DISPLAY} — Text
                </a>
              </li>
              <li>
                <a href={`mailto:${EMAIL}`} className="font-sans text-[13px] text-white/45 hover:text-gold-light transition-colors duration-200">
                  {EMAIL}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 text-[11px] font-sans text-white/25">
          <span>© {new Date().getFullYear()} Rivet Auctions. All rights reserved.</span>
          <a href={`tel:${PHONE_TEL}`} className="font-serif text-lg text-gold-light/70 hover:text-gold-light transition-colors">
            {PHONE_DISPLAY}
          </a>
          <div className="flex gap-4">
            <span className="cursor-default">Terms &amp; Conditions</span>
            <span>|</span>
            <span className="cursor-default">Privacy Policy</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
