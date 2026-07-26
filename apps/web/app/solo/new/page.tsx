import { Header } from '@/components/header'
import { NewBoxForm } from '@/components/new-box-form'

export const dynamic = 'force-dynamic'

export default function NewBoxPage() {
  return (
    <>
      <Header back="/" title="New savings box" />
      <NewBoxForm />
    </>
  )
}
