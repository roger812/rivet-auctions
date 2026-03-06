import { NextRequest, NextResponse } from 'next/server'

// ─────────────────────────────────────────────────────────────
// POST /api/consign
//
// Phase 1: Logs submission server-side and returns success.
//
// To add email (e.g. Resend, SendGrid, Nodemailer):
//   1. npm install resend  (or your provider)
//   2. Replace the TODO block below with your send call
//
// To add a database (e.g. Prisma + Postgres):
//   1. npm install prisma @prisma/client
//   2. Replace the TODO block with a db.inquiry.create(...)
// ─────────────────────────────────────────────────────────────

interface ConsignPayload {
  firstName: string
  lastName: string
  email: string
  phone?: string
  interest: 'real-estate' | 'fine-art' | 'both' | string
  message?: string
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: NextRequest) {
  let body: ConsignPayload

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { firstName, lastName, email, phone, interest, message } = body

  // Basic validation
  if (!firstName || !lastName || !email || !interest) {
    return NextResponse.json(
      { error: 'firstName, lastName, email, and interest are required.' },
      { status: 422 }
    )
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Invalid email address.' }, { status: 422 })
  }

  // ── Phase 1: Console log ──────────────────────────────────
  console.log('─── Rivet Auctions Consignment Inquiry ───')
  console.log({
    receivedAt: new Date().toISOString(),
    name: `${firstName} ${lastName}`,
    email,
    phone: phone || '(not provided)',
    interest,
    message: message || '(no message)',
  })
  console.log('──────────────────────────────────────────')

  // ── TODO: Add email notification here ───────────────────
  // await sendEmail({ to: 'roger@rivetre.com', subject: 'New Consignment Inquiry', ... })

  // ── TODO: Add database persistence here ─────────────────
  // await db.inquiry.create({ data: { firstName, lastName, email, ... } })

  return NextResponse.json(
    { success: true, message: 'Inquiry received. A Rivet specialist will be in touch.' },
    { status: 200 }
  )
}
