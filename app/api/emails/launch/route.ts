import { resend } from '@/lib/resend'
import { betaLaunchTemplate } from '@/lib/emails/templates'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (searchParams.get('secret') !== process.env.ADMIN_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!resend) {
    return Response.json({ error: 'RESEND_API_KEY not configured' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ?to=you@example.com → test send to a single address without touching the waitlist
  const testTo = searchParams.get('to')
  if (testTo) {
    try {
      await resend.emails.send(betaLaunchTemplate(testTo))
      return Response.json({ sent: 1, total: 1, test: true })
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 500 })
    }
  }

  const { data: waitlist, error } = await supabase
    .from('waitlist')
    .select('email')

  if (error || !waitlist?.length) {
    return Response.json({ sent: 0, total: 0, error: error?.message })
  }

  let sent = 0
  for (const row of waitlist) {
    try {
      await resend.emails.send(betaLaunchTemplate(row.email))
      sent++
      await new Promise(r => setTimeout(r, 100))
    } catch (e) {
      console.error('Failed for', row.email, e)
    }
  }

  return Response.json({ sent, total: waitlist.length })
}
