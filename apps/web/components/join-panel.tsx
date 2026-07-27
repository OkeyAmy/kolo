'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ApiError, post } from '@/lib/api'
import { Button } from './ui'
import { useWallet } from './wallet'

export function JoinPanel({
  circleId,
  code,
  alreadyIn,
  full,
  open,
}: {
  circleId: string
  code: string
  alreadyIn: boolean
  full: boolean
  open: boolean
}) {
  const router = useRouter()
  const { address, connect, connecting } = useWallet()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function joinNow() {
    setBusy(true)
    setError(null)
    try {
      // One tap does both: connect if needed, then take the seat.
      const account = address ?? await connect()
      if (!account) {
        setBusy(false)
        return
      }
      // A public circle only records a request here; the circle screen tells
      // them it is waiting on the organiser.
      await post(`/api/circles/${circleId}/join`)
      router.push(`/c/${code}`)
      router.refresh()
    }
    catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not join. Try again.')
      setBusy(false)
    }
  }

  if (alreadyIn) {
    return (
      <Button full onClick={() => router.push(`/c/${code}`)}>
        Open the circle
      </Button>
    )
  }

  if (!open || full) {
    return (
      <div className="space-y-3">
        <Button full disabled>This circle is closed</Button>
        <p className="text-center text-[13px] text-faint">
          Start your own — a circle only needs three people.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Button full loading={busy || connecting} onClick={() => void joinNow()}>
        {address ? 'Take a seat' : 'Connect and take a seat'}
      </Button>
      {error && (
        <p className="rounded-2xl bg-rose/10 px-4 py-3 text-[13.5px] text-rose">{error}</p>
      )}
      <p className="text-center text-[12.5px] text-faint">
        Joining costs nothing. You only pay when a round opens.
      </p>
    </div>
  )
}
