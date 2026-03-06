import { PHONE_DISPLAY, PHONE_TEL, PHONE_SMS } from '@/lib/constants'

interface CalloutCardProps {
  title?: string
  body?: string
  compact?: boolean
}

export default function CalloutCard({
  title = 'Call or Text for the Current Highest Offer',
  body = 'Speak directly with a Rivet specialist to learn where the current offer stands and decide if you would like to compete.',
  compact = false,
}: CalloutCardProps) {
  return (
    <div className="bg-charcoal border-l-[3px] border-gold p-10 md:p-12">
      <p className="section-label mb-3">Speak With a Specialist</p>
      <h2 className={`font-serif font-light text-white leading-snug mb-4 ${compact ? 'text-2xl' : 'text-[28px] md:text-[32px]'}`}>
        {title}
      </h2>
      <p className="font-sans font-light text-[14px] text-white/60 leading-relaxed mb-7 max-w-sm">
        {body}
      </p>

      {/* Phone block */}
      <div className="flex items-center gap-3 bg-gold/10 border border-gold/30 px-5 py-4 mb-5">
        <span className="text-xl" aria-hidden="true">📞</span>
        <a href={`tel:${PHONE_TEL}`} className="font-serif text-2xl font-light text-gold-light tracking-wide hover:text-gold transition-colors">
          {PHONE_DISPLAY}
        </a>
      </div>

      <p className="font-sans font-light text-[12px] text-white/35 leading-relaxed mb-6 max-w-xs">
        Current offers are shared directly by phone or text with interested buyers. Offer amounts are not displayed publicly on the website.
      </p>

      {/* CTA buttons */}
      <div className="flex gap-3 flex-wrap">
        <a href={`tel:${PHONE_TEL}`} className="btn-gold flex-1 min-w-[120px]">
          📞 Call Now
        </a>
        <a href={`sms:${PHONE_SMS}`} className="flex-1 min-w-[120px] inline-flex items-center justify-center px-6 py-3.5 border border-gold/50 text-gold-light font-sans font-medium text-[11px] tracking-wider uppercase transition-colors duration-200 hover:bg-gold/10 focus:outline-none">
          💬 Text Now
        </a>
      </div>
    </div>
  )
}
