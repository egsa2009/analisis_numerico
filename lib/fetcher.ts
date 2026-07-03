export const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Error de red')
  return res.json()
}
