import { notFound } from 'next/navigation'
import { CircleScreen } from '@/components/circle-screen'
import { Header } from '@/components/header'
import { explorerBase } from '@/lib/rpc'
import { loadCircle } from '@/lib/service'
import { readSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function CirclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await readSession()
  const view = await loadCircle(id, session?.address ?? null)

  if (!view)
    notFound()

  return (
    <>
      <Header back="/" title={view.circle.name} />
      <CircleScreen view={view} explorer={explorerBase(view.circle.network)} />
    </>
  )
}
