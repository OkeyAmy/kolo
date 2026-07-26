'use client'

import { Button } from './ui'
import { useWallet } from './wallet'

export function ConnectPanel() {
  const { connect, connecting, error, inWallet } = useWallet()

  return (
    <div className="rise space-y-3">
      <Button full loading={connecting} onClick={() => void connect()}>
        Connect Nimiq Pay
      </Button>

      {error && (
        <p className="rounded-2xl bg-rose/10 px-4 py-3 text-[13.5px] leading-snug text-rose">
          {error}
        </p>
      )}

      {!inWallet && !error && (
        <p className="text-center text-[12.5px] leading-relaxed text-faint">
          Kolo runs inside Nimiq Pay. Open this link in the app to connect your wallet.
        </p>
      )}

      <p className="text-center text-[12.5px] text-faint">
        No email, no password, no seed phrase. One signature and you are in.
      </p>
    </div>
  )
}
