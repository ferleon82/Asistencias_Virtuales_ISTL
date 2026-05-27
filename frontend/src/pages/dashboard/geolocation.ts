import type { LocationPayload } from './types';

export async function getBrowserLocation(): Promise<LocationPayload> {
  if (!navigator.geolocation) return {};

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          precision_m: Math.round(position.coords.accuracy),
        }),
      () => resolve({}),
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
  });
}
