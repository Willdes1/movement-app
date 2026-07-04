import { redirect } from 'next/navigation'

// Clean, printable URL for the Coach business-card QR code:
//   atlasprime.app/coaches  → coach-branded signup (role=coach → Coach Portal).
// The athlete QR just points at the root domain.
export default function CoachesPage() {
  redirect('/auth?as=coach')
}
