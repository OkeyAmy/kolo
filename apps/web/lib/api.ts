export class ApiError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  })

  const body = await response.json().catch(() => ({})) as { message?: string, error?: string }

  if (!response.ok) {
    throw new ApiError(
      body.message ?? 'That did not work. Try again.',
      body.error ?? 'unknown',
    )
  }

  return body as T
}

export function post<T = unknown>(url: string, payload?: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    body: JSON.stringify(payload ?? {}),
  })
}

export function get<T = unknown>(url: string): Promise<T> {
  return request<T>(url, { method: 'GET' })
}
