'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Real Estate', href: '/real-estate' },
  { label: 'Fine Art', href: '/fine-art' },
  { label: 'About Us', href: '/about' },
]

export default function Header() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-charcoal/96 backdrop-blur-md border-b border-gold/20">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-[72px] flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group" aria-label="Rivet Auctions Home">
          <div className="w-10 h-10 bg-gold flex items-center justify-center flex-shrink-0">
            <span className="font-serif text-lg font-semibold text-charcoal tracking-wide">RA</span>
          </div>
          <div className="leading-tight">
            <span className="block font-serif text-[17px] font-medium text-cream-white tracking-[0.15em] uppercase">
              Rivet
            </span>
            <span className="block font-sans text-[9px] font-light tracking-[0.3em] uppercase text-gold-light">
              Auctions
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`font-sans text-[12px] tracking-wide uppercase transition-colors duration-200 ${
                pathname === link.href
                  ? 'text-gold-light'
                  : 'text-white/70 hover:text-gold-light'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link href="/consign" className="btn-gold text-[10px] px-5 py-2.5">
            Consign With Us ›
          </Link>
        </nav>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden flex flex-col gap-[5px] p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
        >
          <span className={`w-6 h-px bg-white transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-[6px]' : ''}`} />
          <span className={`w-6 h-px bg-white transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`w-6 h-px bg-white transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-[6px]' : ''}`} />
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div className="md:hidden bg-charcoal border-t border-gold/20 px-6 py-4 flex flex-col gap-4">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className={`font-sans text-[13px] tracking-wide uppercase py-2 border-b border-gold/10 ${
                pathname === link.href ? 'text-gold-light' : 'text-white/70'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/consign"
            onClick={() => setMenuOpen(false)}
            className="btn-gold mt-2 w-full text-center"
          >
            Consign With Us
          </Link>
        </div>
      )}
    </header>
  )
}
