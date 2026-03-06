import Link from 'next/link'
import ContactStrip from '@/components/ContactStrip'
import { PHONE_DISPLAY, PHONE_TEL } from '@/lib/constants'

export const metadata = {
  title: 'About — Rivet Auctions',
  description:
    'Rivet Auctions was built around a belief that sellers deserve better. Learn about our philosophy, expertise, and approach to competitive real estate sales and fine art consignment.',
}

export default function AboutPage() {
  return (
    <>
      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="bg-cream-dark min-h-[40vh] flex items-center px-6 lg:px-10 pt-[72px]">
        <div className="max-w-7xl mx-auto py-20 w-full">
          <p className="font-sans text-[11px] tracking-widest uppercase text-gold mb-4 font-medium">
            About Rivet Auctions
          </p>
          <h1 className="font-serif font-light text-[clamp(36px,5vw,60px)] text-charcoal leading-tight mb-5">
            Expertise You Can Trust
          </h1>
          <p className="font-sans font-light text-[16px] text-charcoal-warm max-w-[560px] leading-relaxed">
            Rivet Auctions combines licensed auction expertise with modern marketing strategy — creating better outcomes for sellers of real estate and fine art.
          </p>
        </div>
      </section>

      {/* ── PHILOSOPHY ───────────────────────────────────── */}
      <section className="bg-cream-white py-24 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-start">
          <div>
            <p className="section-label">Our Philosophy</p>
            <div className="gold-rule" />
            <h2 className="section-heading mb-6">
              Built for Sellers.<br />Designed for Results.
            </h2>
            <div className="space-y-5">
              <p className="font-sans font-light text-[15px] text-charcoal-warm leading-relaxed">
                We believe sellers deserve better than the traditional process. Most listing arrangements leave competing buyers in the dark — and sellers unknowingly accept less than the market would pay.
              </p>
              <p className="font-sans font-light text-[15px] text-charcoal-warm leading-relaxed">
                Rivet was built to change that. By combining the reach of the MLS with a structured competitive offer environment, we give every seller access to the dynamics that produce the strongest price.
              </p>
              <p className="font-sans font-light text-[15px] text-charcoal-warm leading-relaxed">
                Our approach is transparent, professional, and guided by licensed auctioneers with real experience in high-stakes negotiations.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-px bg-cream-dark">
            {[
              { num: '01', title: 'Integrity', body: 'Transparent communication with sellers and buyers — no hidden agendas, no surprises, no games.' },
              { num: '02', title: 'Expertise', body: 'Licensed auctioneers with deep experience in real estate and fine art guide every transaction.' },
              { num: '03', title: 'Results', body: 'Our process is designed from the ground up to produce the strongest possible outcome for every seller.' },
              { num: '04', title: 'Modern Strategy', body: 'We combine proven auction principles with today\'s largest buyer network — the MLS — for maximum impact.' },
            ].map((val) => (
              <div key={val.num} className="bg-cream-white p-8">
                <div className="font-serif text-5xl font-light text-gold/30 leading-none mb-3">{val.num}</div>
                <h3 className="font-serif text-[22px] font-medium text-charcoal mb-2">{val.title}</h3>
                <p className="font-sans font-light text-[14px] text-charcoal-warm leading-relaxed">{val.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SERVICES OVERVIEW ────────────────────────────── */}
      <section className="bg-cream py-24 px-6 lg:px-10">
        <div className="max-w-7xl mx-auto">
          <p className="section-label">What We Do</p>
          <div className="gold-rule" />
          <h2 className="section-heading mb-12">Two Specializations</h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-charcoal p-10 border-l-[3px] border-gold">
              <h3 className="font-serif text-[26px] font-light text-white mb-4">
                Competitive Real Estate Sales
              </h3>
              <p className="font-sans font-light text-[14px] text-white/55 leading-relaxed mb-8">
                We list your property on the MLS and layer a structured competitive offer process on top — giving buyers a reason to submit their strongest offer.
              </p>
              <Link href="/real-estate" className="btn-gold">
                Learn More →
              </Link>
            </div>

            <div className="bg-cream-white p-10 border-l-[3px] border-gold/40">
              <h3 className="font-serif text-[26px] font-light text-charcoal mb-4">
                Fine Art Consignment
              </h3>
              <p className="font-sans font-light text-[14px] text-charcoal-warm leading-relaxed mb-8">
                We work directly with artists and collectors to market and sell select fine art through a curated consignment process.
              </p>
              <Link href="/fine-art" className="btn-outline-gold">
                Learn More →
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ContactStrip
        heading="Want to Learn More About Rivet?"
        subheading="Call or text us — we are happy to answer any question."
      />
    </>
  )
}
