import { Header } from '@/components/header'
import { NewCircleForm } from '@/components/new-circle-form'

export const dynamic = 'force-dynamic'

export default function NewCirclePage() {
  return (
    <>
      <Header back="/" title="Start a circle" />
      <NewCircleForm />
    </>
  )
}
