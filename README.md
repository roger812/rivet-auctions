# Rivet Auctions — Next.js Marketing Site

## Quick Start

```bash
cd rivet-auctions
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Routes

| Route | Page |
|-------|------|
| `/` | Homepage |
| `/real-estate` | Real Estate |
| `/fine-art` | Fine Art |
| `/about` | About Us |
| `/consign` | Consign (with form) |

## Editing Text

- **Homepage headline/hero:** `app/page.tsx`
- **Each page content:** `app/[page-name]/page.tsx`
- **Phone/email everywhere:** search for `5127969395` and `roger@rivetre.com`
- **Callout card (appears on multiple pages):** `components/CalloutCard.tsx`
- **Nav links:** `components/Nav.tsx`
- **Footer links/contact:** `components/Footer.tsx`

## Editing the Hero Image

In `app/page.tsx`, find the `<Image>` tag and replace the `src` URL:

```tsx
<Image
  src="YOUR_IMAGE_URL_HERE"
  alt="Luxury property — Rivet Auctions"
  ...
```

To use a local image, place it in `/public/` and use `src="/your-image.jpg"`.

## Contact Form

The form at `/consign` submits to `/api/consign/route.ts`.  
Currently logs submissions to the server console.  
To connect to a real service (email, CRM, etc.), edit `app/api/consign/route.ts`.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS (config in `tailwind.config.ts`)
- Google Fonts: Cormorant Garamond + Jost
