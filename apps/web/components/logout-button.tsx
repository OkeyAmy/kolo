'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { post } from '@/lib/api'
import { Button } from './ui'

export function LogoutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  return (
    <Button
      variant="ghost"
      full
      loading={busy}
      onClick={async () => {
        setBusy(true)
        await post('/api/auth/logout').catch(() => {})
        router.push('/')
        router.refresh()
      }}
    >
      Disconnect
    </Button>
  )
}
