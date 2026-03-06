'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const links = [
  { href: '/', label: 'Home' },
  { href: '/real-estate', label: 'Real Estate' },
  { href: '/fine-art', label: 'Fine Art' },
  { href: '/about', label: 'About Us' },
]

export default function Nav() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <>
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(28,26,23,0.97)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(184,146,74,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 6%', height: '72px',
      }}>
        {/* Logo */}
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
          <div style={{
            width: 40, height: 40, background: '#B8924A',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-cormorant)', fontSize: 18, fontWeight: 600,
            color: '#1C1A17', letterSpacing: '0.05em', flexShrink: 0,
          }}>RA</div>
          <div style={{ fontFamily: 'var(--font-cormorant)', lineHeight: 1.2 }}>
            <div style={{ fontSize: 18, fontWeight: 500, color: '#FAFAF8', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Rivet</div>
            <div style={{ fontSize: 9, letterSpacing: '0.35em', color: '#D4AA6A', fontFamily: 'var(--font-jost)', textTransform: 'uppercase', fontWeight: 400 }}>Auctions</div>
          </div>
        </Link>

        {/* Desktop links */}
        <ul style={{ display: 'flex', alignItems: 'center', gap: 32, listStyle: 'none', margin: 0, padding: 0 }}
            className="desktop-nav">
          {links.map(l => (
            <li key={l.href}>
              <Link href={l.href} style={{
                color: pathname === l.href ? '#D4AA6A' : 'rgba(250,250,248,0.7)',
                textDecoration: 'none', fontSize: 12, letterSpacing: '0.14em',
                textTransform: 'uppercase', fontWeight: 400,
                transition: 'color 0.2s',
              }}>{l.label}</Link>
            </li>
          ))}
          <li>
            <Link href="/consign" style={{
              background: '#B8924A', color: '#1C1A17', padding: '10px 20px',
              textDecoration: 'none', fontSize: 11, letterSpacing: '0.2em',
              textTransform: 'uppercase', fontWeight: 600,
              transition: 'background 0.2s',
              fontFamily: 'var(--font-jost)',
            }}>Consign With Us ›</Link>
          </li>
        </ul>

        {/* Hamburger */}
        <button onClick={() => setOpen(!open)} style={{
          display: 'none', flexDirection: 'column', gap: 5,
          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
        }} className="hamburger" aria-label="Menu">
          <span style={{ width: 24, height: 1, background: '#FAFAF8', display: 'block' }} />
          <span style={{ width: 24, height: 1, background: '#FAFAF8', display: 'block' }} />
          <span style={{ width: 24, height: 1, background: '#FAFAF8', display: 'block' }} />
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div style={{
          position: 'fixed', top: 72, left: 0, right: 0, zIndex: 99,
          background: '#1C1A17', borderBottom: '1px solid rgba(184,146,74,0.2)',
          padding: '20px 6%', display: 'flex', flexDirection: 'column', gap: 0,
        }}>
          {links.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} style={{
              color: 'rgba(250,250,248,0.75)', textDecoration: 'none',
              fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase',
              padding: '14px 0', borderBottom: '1px solid rgba(184,146,74,0.1)',
            }}>{l.label}</Link>
          ))}
          <Link href="/consign" onClick={() => setOpen(false)} style={{
            color: '#D4AA6A', textDecoration: 'none',
            fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase',
            padding: '14px 0', fontWeight: 500,
          }}>Consign With Us</Link>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .hamburger { display: flex !important; }
        }
      `}</style>
    </>
  )
}
