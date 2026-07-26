import { CircleError, SoloError, SwapError } from '@kolo/core'

/**
 * One error shape for every route.
 *
 * Domain errors carry a message written for the person holding the phone, so
 * they are safe to show verbatim. Anything else is logged and replaced with a
 * generic message — an unexpected failure must never leak internals into a UI.
 */
export function apiError(error: unknown): Response {
  if (error instanceof CircleError || error instanceof SwapError || error instanceof SoloError)
    return Response.json({ error: error.code, message: error.message }, { status: 400 })

  if (error instanceof Error && error.name === 'ZodError')
    return Response.json({ error: 'bad_request', message: 'That request was not valid.' }, { status: 400 })

  console.error(error)
  return Response.json(
    { error: 'internal_error', message: 'Something went wrong on our side. Try again.' },
    { status: 500 },
  )
}

export function unauthorized(): Response {
  return Response.json(
    { error: 'unauthorized', message: 'Connect your Nimiq wallet first.' },
    { status: 401 },
  )
}

export function notFound(what = 'That does not exist.'): Response {
  return Response.json({ error: 'not_found', message: what }, { status: 404 })
}

export function badRequest(message: string, code = 'bad_request'): Response {
  return Response.json({ error: code, message }, { status: 400 })
}
