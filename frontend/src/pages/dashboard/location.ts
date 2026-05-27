export function toMapCoordinate(value?: number | string | null): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getMapUrl(lat?: number | string | null, lng?: number | string | null): string | null {
  const parsedLat = toMapCoordinate(lat);
  const parsedLng = toMapCoordinate(lng);
  if (parsedLat === null || parsedLng === null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${parsedLat},${parsedLng}`;
}
