import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

/**
 * Mini read-only map showing a UV polygon + optional marker for the geocoded address.
 */
export default function UVMiniMap({ geometry, coords, label }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    if (!mapRef.current || !geometry?.coordinates) return;

    // Clean up previous
    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    // Draw polygon
    const polygonLayer = L.geoJSON({
      type: 'Feature',
      geometry,
      properties: {}
    }, {
      style: { color: '#2563eb', weight: 2, fillOpacity: 0.15, fillColor: '#2563eb' }
    }).addTo(map);

    // Fit to polygon bounds
    map.fitBounds(polygonLayer.getBounds(), { padding: [20, 20] });

    // Add marker for address if coords exist
    if (coords?.lat && coords?.lng) {
      L.circleMarker([coords.lat, coords.lng], {
        radius: 6, color: '#dc2626', fillColor: '#dc2626', fillOpacity: 1, weight: 2
      }).addTo(map).bindTooltip(label || '', { permanent: true, direction: 'top', offset: [0, -8], className: 'uv-mini-tooltip' });
    }

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [geometry, coords, label]);

  if (!geometry?.coordinates) return null;

  return (
    <div
      ref={mapRef}
      style={{
        width: '100%',
        height: 180,
        borderRadius: 10,
        border: '1px solid #e5e7eb',
        overflow: 'hidden'
      }}
    />
  );
}
