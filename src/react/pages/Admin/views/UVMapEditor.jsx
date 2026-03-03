import { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '../../../../services/ApiService';
import { useUiStore } from '../../../stores/uiStore';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MZ_COLORS = {
  1: '#ef4444', 2: '#f59e0b', 3: '#10b981', 4: '#3b82f6',
  5: '#8b5cf6', 6: '#ec4899', 7: '#06b6d4'
};

export default function UVMapEditor({ uvList, onPolygonSaved }) {
  const addToast = useUiStore(s => s.addToast);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersRef = useRef({});
  const drawControlRef = useRef(null);
  const [selectedUv, setSelectedUv] = useState(null);
  const [saving, setSaving] = useState(false);

  // Initialize map
  useEffect(() => {
    if (mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [-33.395, -70.725],
      zoom: 14,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    mapInstanceRef.current = map;

    // Draw control
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          shapeOptions: { color: '#2563eb', weight: 2, fillOpacity: 0.2 }
        },
        polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false
      },
      edit: { featureGroup: drawnItems }
    });
    map.addControl(drawControl);
    drawControlRef.current = { drawnItems, drawControl };

    map.on(L.Draw.Event.CREATED, (e) => {
      const layer = e.layer;
      drawnItems.addLayer(layer);
      // Convert to GeoJSON
      const geojson = layer.toGeoJSON();
      if (selectedUv) {
        savePolygon(selectedUv, geojson.geometry);
      } else {
        addToast('Selecciona una UV del panel antes de dibujar', 'error');
        drawnItems.removeLayer(layer);
      }
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Load GeoJSON polygons
  const loadPolygons = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing polygon layers
    Object.values(layersRef.current).forEach(l => map.removeLayer(l));
    layersRef.current = {};

    try {
      const geojson = await apiService.get('/unidades-vecinales/geojson');

      geojson.features.forEach(feature => {
        const color = MZ_COLORS[feature.properties.macrozona] || '#6b7280';
        const layer = L.geoJSON(feature, {
          style: {
            color,
            weight: 2,
            fillOpacity: 0.15,
            fillColor: color
          },
          onEachFeature: (f, l) => {
            l.bindTooltip(`UV ${f.properties.numero}${f.properties.nombre ? ' — ' + f.properties.nombre : ''}`, {
              permanent: false, direction: 'center', className: 'uv-tooltip'
            });
            l.on('click', () => setSelectedUv(f.properties._id));
          }
        });
        layer.addTo(map);
        layersRef.current[feature.properties._id] = layer;
      });
    } catch (err) {
      console.error('Error loading GeoJSON:', err);
    }
  }, []);

  useEffect(() => { loadPolygons(); }, [loadPolygons]);

  // Highlight selected UV
  useEffect(() => {
    Object.entries(layersRef.current).forEach(([id, layer]) => {
      layer.eachLayer(l => {
        if (id === selectedUv) {
          l.setStyle({ weight: 4, fillOpacity: 0.35, dashArray: '' });
        } else {
          const mz = l.feature?.properties?.macrozona;
          l.setStyle({ weight: 2, fillOpacity: 0.15, color: MZ_COLORS[mz] || '#6b7280' });
        }
      });
    });
  }, [selectedUv]);

  async function savePolygon(uvId, geometry) {
    setSaving(true);
    try {
      await apiService.put(`/unidades-vecinales/${uvId}`, { geometry });
      addToast('Polígono guardado', 'success');
      loadPolygons();
      if (onPolygonSaved) onPolygonSaved();
      // Clear drawn items
      if (drawControlRef.current) drawControlRef.current.drawnItems.clearLayers();
    } catch (err) {
      addToast(err.message || 'Error al guardar polígono', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deletePolygon(uvId) {
    setSaving(true);
    try {
      await apiService.put(`/unidades-vecinales/${uvId}`, { geometry: null });
      addToast('Polígono eliminado', 'success');
      loadPolygons();
      if (onPolygonSaved) onPolygonSaved();
    } catch (err) {
      addToast('Error al eliminar', 'error');
    } finally {
      setSaving(false);
    }
  }

  const selectedUvData = uvList?.find(uv => uv._id === selectedUv);
  const uvsWithPolygon = uvList?.filter(uv => uv.geometry?.coordinates) || [];
  const uvsWithout = uvList?.filter(uv => !uv.geometry?.coordinates) || [];

  return (
    <div style={{ display: 'flex', gap: 16, height: 600 }}>
      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%', borderRadius: 12, border: '1px solid #e5e7eb' }} />
        {saving && (
          <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', background: '#2563eb', color: '#fff', padding: '6px 16px', borderRadius: 8, fontSize: 13, zIndex: 1000 }}>
            Guardando...
          </div>
        )}
      </div>

      {/* Panel */}
      <div style={{ width: 260, overflow: 'auto', background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
          Unidades Vecinales
        </h3>
        <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 8px' }}>
          {uvsWithPolygon.length}/{uvList?.length || 0} con polígono.
          Selecciona una UV y dibuja su polígono en el mapa.
        </p>

        {selectedUvData && (
          <div style={{ background: '#eff6ff', borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 12 }}>
            <strong style={{ color: '#1d4ed8' }}>UV {selectedUvData.numero}</strong>
            <span style={{ color: '#4b5563' }}> — {selectedUvData.nombre || 'Sin nombre'}</span>
            {selectedUvData.geometry?.coordinates && (
              <button onClick={() => deletePolygon(selectedUv)} style={{
                display: 'block', marginTop: 6, fontSize: 11, color: '#dc2626',
                background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0
              }}>Eliminar polígono</button>
            )}
          </div>
        )}

        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 4, marginTop: 8 }}>SIN POLÍGONO</div>
        {uvsWithout.map(uv => (
          <button key={uv._id} onClick={() => setSelectedUv(uv._id)} style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px',
            background: selectedUv === uv._id ? '#dbeafe' : 'transparent',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12,
            color: selectedUv === uv._id ? '#1d4ed8' : '#374151', marginBottom: 2
          }}>
            UV {uv.numero} {uv.nombre ? `— ${uv.nombre}` : ''}
          </button>
        ))}

        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 4, marginTop: 12 }}>CON POLÍGONO</div>
        {uvsWithPolygon.map(uv => (
          <button key={uv._id} onClick={() => setSelectedUv(uv._id)} style={{
            display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px',
            background: selectedUv === uv._id ? '#dbeafe' : 'transparent',
            border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12,
            color: selectedUv === uv._id ? '#1d4ed8' : '#16a34a', marginBottom: 2
          }}>
            UV {uv.numero} {uv.nombre ? `— ${uv.nombre}` : ''}
          </button>
        ))}
      </div>
    </div>
  );
}
