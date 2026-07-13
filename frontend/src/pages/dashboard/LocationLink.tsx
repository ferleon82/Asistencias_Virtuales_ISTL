import { getMapUrl } from './location';

interface LocationLinkProps {
  lat?: number | string | null;
  lng?: number | string | null;
  precision?: number | null;
}

export function LocationLink({ lat, lng, precision }: LocationLinkProps) {
  const mapUrl = getMapUrl(lat, lng);

  if (!mapUrl) {
    return <span className="text-xs text-slate-400">Sin GPS</span>;
  }

  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-brand-navy hover:bg-istl-50"
      title={precision ? `Precisión aproximada: ${precision} m` : 'Ver ubicación en mapa'}
    >
      Mapa{precision ? ` - ${precision} m` : ''}
    </a>
  );
}
