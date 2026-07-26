import { notFound } from 'next/navigation'
import { Header } from '@/components/header'
import { BoxScreen } from '@/components/box-screen'
import { explorerBase } from '@/lib/rpc'
import { loadBoxView } from '@/lib/service'

export const dynamic = 'force-dynamic'

export default async function BoxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const view = await loadBoxView(id.toUpperCase())

  if (!view)
    notFound()

  return (
    <>
      <Header back="/" title={view.box.name} />
      <BoxScreen view={view} explorer={explorerBase(view.box.network)} />
    </>
  )
}
