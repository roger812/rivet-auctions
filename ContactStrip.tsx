import { PHONE_DISPLAY, PHONE_TEL, PHONE_SMS } from '@/lib/constants'

interface ContactStripProps {
  heading?: string
  subheading?: string
}

export default function ContactStrip({
  heading = 'Ready to Maximize Your Sale?',
  subheading = 'Speak with a Rivet specialist today — no obligation, no pressure.',
}: ContactStripProps) {
  return (
    <section className="bg-gold px-6 lg:px-10 py-16">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="font-serif font-light text-3xl md:text-4xl text-charcoal">{heading}</h2>
          <p className="font-sans font-light text-[14px] text-charcoal/65 mt-1">{subheading}</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <a href={`tel:${PHONE_TEL}`} className="btn-dark">
            📞 Call {PHONE_DISPLAY}
          </a>
          <a href={`sms:${PHONE_SMS}`} className="btn-outline-dark">
            💬 Text Us
          </a>
        </div>
      </div>
    </section>
  )
}
