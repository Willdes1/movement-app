export async function logTokens({
  operation,
  route,
  input_tokens,
  output_tokens,
  user_id,
}: {
  operation: string
  route: string
  input_tokens: number
  output_tokens: number
  user_id?: string | null
}) {
  const body: Record<string, unknown> = { operation, route, input_tokens, output_tokens }
  if (user_id) body.user_id = user_id
  await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/token_usage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
    },
    body: JSON.stringify(body),
  }).catch(() => {})
}
