'use client'

import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { listAccounts, insideNimiqPay, signMessage, WalletError } from '@/lib/nimiq-client'
import { post } from '@/lib/api'

interface WalletState {
  address: string | null
  displayName: string | null
  connecting: boolean
  error: string | null
  inWallet: boolean
  connect: (displayName?: string) => Promise<string | null>
  sign: (message: string) => Promise<{ publicKey: string, signature: string }>
  clearError: () => void
}

const Ctx = createContext<WalletState | null>(null)

export function WalletProvider({
  children,
  address,
  displayName,
}: {
  children: ReactNode
  address: string | null
  displayName: string | null
}) {
  const router = useRouter()
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const connect = useCallback(async (name?: string) => {
    setConnecting(true)
    setError(null)
    try {
      const accounts = await listAccounts()
      const account = accounts[0]
      if (!account) {
        setError('Nimiq Pay did not share an account.')
        return null
      }

      const { message } = await post<{ message: string }>('/api/auth/challenge', { address: account })
      const signature = await signMessage(message)

      await post('/api/auth/verify', {
        address: account,
        publicKey: signature.publicKey,
        signature: signature.signature,
        ...(name ? { displayName: name } : {}),
      })

      router.refresh()
      return account
    }
    catch (caught) {
      // A cancelled dialog is a decision, not a failure. Say so plainly and
      // leave the UI exactly where it was.
      const message = caught instanceof WalletError
        ? caught.message
        : caught instanceof Error ? caught.message : 'Could not connect.'
      setError(message)
      return null
    }
    finally {
      setConnecting(false)
    }
  }, [router])

  const sign = useCallback(async (message: string) => {
    const result = await signMessage(message)
    return { publicKey: result.publicKey, signature: result.signature }
  }, [])

  const value = useMemo<WalletState>(() => ({
    address,
    displayName,
    connecting,
    error,
    inWallet: insideNimiqPay(),
    connect,
    sign,
    clearError: () => setError(null),
  }), [address, displayName, connecting, error, connect, sign])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWallet(): WalletState {
  const value = useContext(Ctx)
  if (!value)
    throw new Error('useWallet must be used inside WalletProvider')
  return value
}
