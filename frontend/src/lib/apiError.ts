/** Mensaje de error enviado por la API o, si no existe, el texto por defecto. */
export function getApiMessage(error: unknown, fallback: string): string {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;
}
