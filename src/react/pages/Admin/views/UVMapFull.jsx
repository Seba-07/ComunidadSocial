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


export default function UVMapFull({
  uvList, selectedUv, onSelectUv, onDataChange,
  search, onSearchChange, filteredList, onDeleteUv
}) {
  const addToast = useUiStore(s => s.addToast);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polyLayersRef = useRef({});
  const drawnItemsRef = useRef(null);
  const [mode, setMode] = useState('view'); // view | create | editPoly
  const [createForm, setCreateForm] = useState({ nombre: '', macrozona: 1 });
  const [drawnGeometry, setDrawnGeometry] = useState(null);
  const [saving, setSaving] = useState(false);
  // Address test
  const [testAddress, setTestAddress] = useState('');
  const [testResult, setTestResult] = useState(null);
  const testMarkerRef = useRef(null);
  // Edit UV fields
  const [editForm, setEditForm] = useState(null);
  const [editPobInput, setEditPobInput] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Initialize map once
  useEffect(() => {
    if (mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [-33.395, -70.720],
      zoom: 14,
      zoomControl: true
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OSM',
      maxZoom: 19
    }).addTo(map);

    // Draw layer
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: {
        polygon: {
          allowIntersection: false,
          shapeOptions: { color: '#2563eb', weight: 3, fillOpacity: 0.25 }
        },
        polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false
      },
      edit: { featureGroup: drawnItems }
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      setDrawnGeometry(e.layer.toGeoJSON().geometry);
    });

    mapInstanceRef.current = map;

    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  // Load and render polygons
  const loadPolygons = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    Object.values(polyLayersRef.current).forEach(l => map.removeLayer(l));
    polyLayersRef.current = {};

    try {
      const geojson = await apiService.get('/unidades-vecinales/geojson');
      geojson.features.forEach(feature => {
        const mz = feature.properties.macrozona;
        const color = MZ_COLORS[mz] || '#6b7280';
        const isSelected = feature.properties._id === selectedUv;

        const layer = L.geoJSON(feature, {
          style: {
            color: isSelected ? '#2563eb' : color,
            weight: isSelected ? 4 : 2,
            fillOpacity: isSelected ? 0.3 : 0.12,
            fillColor: color
          },
          onEachFeature: (f, l) => {
            l.bindTooltip(
              `<strong>UV ${f.properties.numero}</strong>${f.properties.nombre ? '<br>' + f.properties.nombre : ''}`,
              { direction: 'center', className: 'uv-tooltip-custom' }
            );
            l.on('click', () => onSelectUv(f.properties._id));
          }
        });
        layer.addTo(map);
        polyLayersRef.current[feature.properties._id] = layer;
      });
    } catch (err) {
      console.error('Error loading polygons:', err);
    }
  }, [selectedUv, onSelectUv]);

  useEffect(() => { loadPolygons(); }, [loadPolygons]);

  // Highlight selected
  useEffect(() => {
    Object.entries(polyLayersRef.current).forEach(([id, layer]) => {
      layer.eachLayer(l => {
        const mz = l.feature?.properties?.macrozona;
        const color = MZ_COLORS[mz] || '#6b7280';
        if (id === selectedUv) {
          l.setStyle({ weight: 4, fillOpacity: 0.35, color: '#2563eb' });
        } else {
          l.setStyle({ weight: 2, fillOpacity: 0.12, color });
        }
      });
    });
  }, [selectedUv]);

  // Create new UV with polygon
  async function handleCreate() {
    if (!createForm.nombre.trim()) {
      addToast('El nombre es requerido', 'error'); return;
    }
    if (!drawnGeometry) {
      addToast('Dibuja el polígono en el mapa primero', 'error'); return;
    }

    setSaving(true);
    try {
      // Auto-generate numero and idOficial
      const maxNum = uvList.reduce((max, uv) => {
        const n = parseInt(uv.numero);
        return isNaN(n) ? max : Math.max(max, n);
      }, 0);
      const newNum = String(maxNum + 1).padStart(3, '0');

      await apiService.post('/unidades-vecinales', {
        numero: newNum,
        idOficial: `RENCA-${newNum}`,
        nombre: createForm.nombre.trim(),
        macrozona: parseInt(createForm.macrozona) || 1,
        geometry: drawnGeometry,
        poblaciones: [],
        calles: []
      });
      addToast(`UV ${newNum} creada`, 'success');
      setMode('view');
      setDrawnGeometry(null);
      setCreateForm({ nombre: '', macrozona: 1 });
      drawnItemsRef.current?.clearLayers();
      onDataChange();
    } catch (err) {
      addToast(err.message || 'Error al crear', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Save polygon to existing UV
  async function handleSavePolygon() {
    if (!selectedUv || !drawnGeometry) {
      addToast('Selecciona una UV y dibuja el polígono', 'error'); return;
    }
    setSaving(true);
    try {
      await apiService.put(`/unidades-vecinales/${selectedUv}`, { geometry: drawnGeometry });
      addToast('Polígono guardado', 'success');
      setMode('view');
      setDrawnGeometry(null);
      drawnItemsRef.current?.clearLayers();
      onDataChange();
    } catch (err) {
      addToast(err.message || 'Error', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePolygon(uvId) {
    try {
      await apiService.put(`/unidades-vecinales/${uvId}`, { geometry: null });
      addToast('Polígono eliminado', 'success');
      onDataChange();
    } catch (err) {
      addToast('Error', 'error');
    }
  }

  function startEditPoly(uvId) {
    setMode('editPoly');
    onSelectUv(uvId);
    drawnItemsRef.current?.clearLayers();
    setDrawnGeometry(null);
  }

  function cancelMode() {
    setMode('view');
    setDrawnGeometry(null);
    drawnItemsRef.current?.clearLayers();
  }

  // Test address search
  async function handleTestAddress() {
    if (!testAddress.trim() || testAddress.trim().length < 5) {
      addToast('Ingresa una dirección para buscar', 'error'); return;
    }
    setTestResult({ searching: true });

    // Remove previous marker
    if (testMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(testMarkerRef.current);
      testMarkerRef.current = null;
    }

    try {
      const result = await apiService.get(`/unidades-vecinales/buscar?direccion=${encodeURIComponent(testAddress)}`);

      const map = mapInstanceRef.current;
      if (result.coords && map) {
        // Add marker
        const marker = L.marker([result.coords.lat, result.coords.lng], {
          icon: L.divIcon({
            className: '',
            html: '<div style="width:14px;height:14px;background:#dc2626;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          })
        }).addTo(map);
        testMarkerRef.current = marker;
        map.setView([result.coords.lat, result.coords.lng], 16);
      }

      if (result.encontrada) {
        const uv = result.unidadVecinal;
        setTestResult({
          found: true,
          uvNumero: uv.numero,
          uvNombre: uv.nombre,
          macrozona: uv.macrozona,
          coords: result.coords
        });
        // Highlight the matched UV
        onSelectUv(uv._id);
      } else {
        setTestResult({ found: false, coords: result.coords });
      }
    } catch (err) {
      setTestResult({ found: false, error: err.message });
    }
  }

  function clearTest() {
    setTestAddress('');
    setTestResult(null);
    if (testMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(testMarkerRef.current);
      testMarkerRef.current = null;
    }
  }

  // Open edit form for selected UV
  function openEditUv(uv) {
    setEditForm({
      nombre: uv.nombre || '',
      macrozona: uv.macrozona || 1,
      poblaciones: [...(uv.poblaciones || [])]
    });
    setEditPobInput('');
  }

  async function handleSaveEdit() {
    if (!selectedUv || !editForm) return;
    setSavingEdit(true);
    try {
      await apiService.put(`/unidades-vecinales/${selectedUv}`, {
        nombre: editForm.nombre,
        macrozona: parseInt(editForm.macrozona),
        poblaciones: editForm.poblaciones
      });
      addToast('UV actualizada', 'success');
      setEditForm(null);
      onDataChange();
    } catch (err) {
      addToast(err.message || 'Error al actualizar', 'error');
    } finally {
      setSavingEdit(false);
    }
  }

  function addPoblacion() {
    const val = editPobInput.trim();
    if (!val || editForm.poblaciones.includes(val)) return;
    setEditForm(f => ({ ...f, poblaciones: [...f.poblaciones, val] }));
    setEditPobInput('');
  }

  const selectedData = uvList.find(u => u._id === selectedUv);

  return (
    <div style={{ display: 'flex', gap: 0, height: 650, borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
      {/* Side Panel */}
      <div style={{ width: 280, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
        {/* Search UV */}
        <div style={{ padding: '12px 12px 4px' }}>
          <input
            value={search} onChange={e => onSearchChange(e.target.value)}
            placeholder="Filtrar UV..."
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}
          />
        </div>

        {/* Test address */}
        <div style={{ padding: '4px 12px 8px' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            <input
              value={testAddress}
              onChange={e => setTestAddress(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTestAddress()}
              placeholder="Probar dirección..."
              style={{ flex: 1, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12, boxSizing: 'border-box' }}
            />
            <button onClick={handleTestAddress} disabled={testResult?.searching}
              style={{ padding: '7px 10px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
              {testResult?.searching ? '...' : 'Buscar'}
            </button>
          </div>
          {testResult && !testResult.searching && (
            <div style={{
              marginTop: 6, padding: '8px 10px', borderRadius: 8, fontSize: 12,
              background: testResult.found ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${testResult.found ? '#bbf7d0' : '#fecaca'}`
            }}>
              {testResult.found ? (
                <div>
                  <div style={{ fontWeight: 600, color: '#166534' }}>
                    UV {testResult.uvNumero} {testResult.uvNombre ? `— ${testResult.uvNombre}` : ''}
                  </div>
                  <div style={{ color: '#166534', marginTop: 2 }}>
                    Macrozona {testResult.macrozona}
                  </div>
                  {testResult.coords && (
                    <div style={{ color: '#6b7280', marginTop: 2, fontSize: 11 }}>
                      {testResult.coords.lat.toFixed(5)}, {testResult.coords.lng.toFixed(5)}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#991b1b' }}>
                  No se encontró UV para esta dirección
                  {testResult.coords && (
                    <div style={{ color: '#6b7280', marginTop: 2, fontSize: 11 }}>
                      Coordenadas: {testResult.coords.lat.toFixed(5)}, {testResult.coords.lng.toFixed(5)}
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>Precisión aprox. (OpenStreetMap)</span>
                <button onClick={clearTest} style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                  Limpiar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ padding: '0 12px 8px', display: 'flex', gap: 6 }}>
          {mode === 'view' && (
            <>
              <button onClick={() => { setMode('create'); setDrawnGeometry(null); drawnItemsRef.current?.clearLayers(); }}
                style={{ flex: 1, padding: '8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                + Nueva UV
              </button>
              {selectedUv && !selectedData?.geometry?.coordinates && (
                <button onClick={() => startEditPoly(selectedUv)}
                  style={{ flex: 1, padding: '8px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Dibujar Polígono
                </button>
              )}
            </>
          )}
          {mode !== 'view' && (
            <button onClick={cancelMode}
              style={{ flex: 1, padding: '8px', background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Cancelar
            </button>
          )}
        </div>

        {/* Create form */}
        {mode === 'create' && (
          <div style={{ padding: '8px 12px', borderTop: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6', background: '#f9fafb' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>Nueva Unidad Vecinal</p>
            <input value={createForm.nombre} onChange={e => setCreateForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Nombre de la UV" style={{ width: '100%', padding: 7, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, marginBottom: 6, boxSizing: 'border-box' }} />
            <select value={createForm.macrozona} onChange={e => setCreateForm(f => ({ ...f, macrozona: e.target.value }))}
              style={{ width: '100%', padding: 7, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, marginBottom: 8, boxSizing: 'border-box' }}>
              {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>Macrozona {n}</option>)}
            </select>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 8px' }}>
              {drawnGeometry ? 'Polígono dibujado' : 'Dibuja el polígono en el mapa con la herramienta de la derecha'}
            </p>
            <button onClick={handleCreate} disabled={saving || !drawnGeometry}
              style={{ width: '100%', padding: 8, background: drawnGeometry ? '#2563eb' : '#93c5fd', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : 'Crear UV'}
            </button>
          </div>
        )}

        {/* Edit polygon form */}
        {mode === 'editPoly' && selectedData && (
          <div style={{ padding: '8px 12px', borderTop: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6', background: '#f0fdf4' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#166534', margin: '0 0 4px' }}>Dibujar polígono para UV {selectedData.numero}</p>
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 8px' }}>
              {drawnGeometry ? 'Polígono listo. Click guardar.' : 'Usa la herramienta de polígono en el mapa.'}
            </p>
            <button onClick={handleSavePolygon} disabled={saving || !drawnGeometry}
              style={{ width: '100%', padding: 8, background: drawnGeometry ? '#16a34a' : '#86efac', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : 'Guardar Polígono'}
            </button>
          </div>
        )}

        {/* UV list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
          {filteredList.map(uv => {
            const isActive = uv._id === selectedUv;
            const hasPoly = !!uv.geometry?.coordinates;
            return (
              <button key={uv._id} onClick={() => onSelectUv(uv._id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: 'calc(100% - 16px)', margin: '1px 8px',
                  padding: '9px 10px', background: isActive ? '#eff6ff' : 'transparent',
                  border: isActive ? '1px solid #bfdbfe' : '1px solid transparent',
                  borderRadius: 8, cursor: 'pointer', textAlign: 'left', fontSize: 13
                }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: hasPoly ? '#16a34a' : '#d1d5db' }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isActive ? '#1d4ed8' : '#374151', fontWeight: isActive ? 600 : 400 }}>
                  UV {uv.numero} {uv.nombre ? `— ${uv.nombre}` : ''}
                </span>
                {uv.macrozona && (
                  <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 6, background: MZ_COLORS[uv.macrozona] + '20', color: MZ_COLORS[uv.macrozona], fontWeight: 600, flexShrink: 0 }}>
                    MZ{uv.macrozona}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected UV detail + edit */}
        {selectedData && mode === 'view' && (
          <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', background: '#f9fafb', fontSize: 12, maxHeight: 280, overflow: 'auto' }}>
            {!editForm ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontWeight: 700, color: '#111827' }}>UV {selectedData.numero} — {selectedData.nombre || 'Sin nombre'}</div>
                  <button onClick={() => openEditUv(selectedData)} style={{ fontSize: 11, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                    Editar
                  </button>
                </div>
                {selectedData.macrozona && (
                  <div style={{ display: 'inline-block', fontSize: 11, padding: '1px 6px', borderRadius: 6, background: MZ_COLORS[selectedData.macrozona] + '20', color: MZ_COLORS[selectedData.macrozona], fontWeight: 600 }}>
                    Macrozona {selectedData.macrozona}
                  </div>
                )}
                {selectedData.poblaciones?.length > 0 && (
                  <div style={{ color: '#6b7280', marginTop: 4 }}>Poblaciones: {selectedData.poblaciones.join(', ')}</div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {selectedData.geometry?.coordinates ? (
                    <button onClick={() => handleDeletePolygon(selectedData._id)} style={{ padding: '5px 10px', fontSize: 11, color: '#dc2626', background: '#fff', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer' }}>
                      Borrar polígono
                    </button>
                  ) : (
                    <button onClick={() => startEditPoly(selectedData._id)} style={{ padding: '5px 10px', fontSize: 11, color: '#fff', background: '#111827', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                      Dibujar polígono
                    </button>
                  )}
                  <button onClick={() => onDeleteUv(selectedData)} style={{ padding: '5px 10px', fontSize: 11, color: '#dc2626', background: '#fff', border: '1px solid #fecaca', borderRadius: 6, cursor: 'pointer' }}>
                    Eliminar
                  </button>
                </div>
              </>
            ) : (
              /* Edit mode */
              <>
                <div style={{ fontWeight: 600, color: '#111827', marginBottom: 6 }}>Editar UV {selectedData.numero}</div>
                <input value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))}
                  placeholder="Nombre" style={{ width: '100%', padding: 6, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, marginBottom: 6, boxSizing: 'border-box' }} />
                <select value={editForm.macrozona} onChange={e => setEditForm(f => ({ ...f, macrozona: e.target.value }))}
                  style={{ width: '100%', padding: 6, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, marginBottom: 6, boxSizing: 'border-box' }}>
                  {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>Macrozona {n}</option>)}
                </select>
                <div style={{ marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 3 }}>Poblaciones</div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <input value={editPobInput} onChange={e => setEditPobInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPoblacion())}
                      placeholder="Agregar..." style={{ flex: 1, padding: 5, border: '1px solid #d1d5db', borderRadius: 6, fontSize: 11, boxSizing: 'border-box' }} />
                    <button onClick={addPoblacion} style={{ padding: '5px 8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>+</button>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                    {editForm.poblaciones.map((p, i) => (
                      <span key={i} style={{ padding: '2px 6px', background: '#e5e7eb', borderRadius: 6, fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 }}>
                        {p}
                        <button onClick={() => setEditForm(f => ({ ...f, poblaciones: f.poblaciones.filter((_, j) => j !== i) }))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#6b7280', padding: 0, lineHeight: 1 }}>&times;</button>
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditForm(null)} style={{ flex: 1, padding: 6, background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                  <button onClick={handleSaveEdit} disabled={savingEdit}
                    style={{ flex: 1, padding: 6, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', opacity: savingEdit ? 0.6 : 1 }}>
                    {savingEdit ? '...' : 'Guardar'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ flex: 1 }} />
    </div>
  );
}
