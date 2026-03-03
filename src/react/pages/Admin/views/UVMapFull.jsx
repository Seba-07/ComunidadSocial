import { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '../../../../services/ApiService';
import { useUiStore } from '../../../stores/uiStore';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import L from 'leaflet';
import 'leaflet-draw';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const MZ_COLORS = { 1: '#ef4444', 2: '#f59e0b', 3: '#10b981', 4: '#3b82f6', 5: '#8b5cf6', 6: '#ec4899', 7: '#06b6d4' };
const MZ_NAMES = { 1: 'Cerro Renca', 2: 'Huamachuco', 3: 'Central', 4: 'Sur/Mapocho', 5: 'Lo Velásquez', 6: 'Oriente', 7: 'Sur-Poniente' };

const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#78716c', '#64748b', '#111827'
];

function getUvColor(uv) {
  return uv.color || MZ_COLORS[uv.macrozona] || '#6b7280';
}

const panelInput = { width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13, boxSizing: 'border-box', background: '#fff' };
const panelSelect = { ...panelInput, cursor: 'pointer' };
const btnSm = (bg, color) => ({ padding: '6px 12px', background: bg, color, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' });

export default function UVMapFull({ uvList, selectedUv, onSelectUv, onDataChange, search, onSearchChange, filteredList, onDeleteUv }) {
  const addToast = useUiStore(s => s.addToast);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polyLayersRef = useRef({});
  const drawnItemsRef = useRef(null);
  const testMarkerRef = useRef(null);

  const [mode, setMode] = useState('view'); // view | create | drawPoly | reDraw
  const [createForm, setCreateForm] = useState({ nombre: '', macrozona: 1, color: '' });
  const [drawnGeometry, setDrawnGeometry] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testAddress, setTestAddress] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editPobInput, setEditPobInput] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // === MAP INIT ===
  useEffect(() => {
    if (mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { center: [-33.395, -70.720], zoom: 14 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OSM', maxZoom: 19 }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;

    const drawControl = new L.Control.Draw({
      position: 'topright',
      draw: { polygon: { allowIntersection: false, shapeOptions: { color: '#2563eb', weight: 3, fillOpacity: 0.25 } }, polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false },
      edit: { featureGroup: drawnItems }
    });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, (e) => { drawnItems.clearLayers(); drawnItems.addLayer(e.layer); setDrawnGeometry(e.layer.toGeoJSON().geometry); });
    map.on(L.Draw.Event.EDITED, (e) => { e.layers.eachLayer(l => setDrawnGeometry(l.toGeoJSON().geometry)); });

    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  // === LOAD POLYGONS ===
  const loadPolygons = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    Object.values(polyLayersRef.current).forEach(l => map.removeLayer(l));
    polyLayersRef.current = {};
    try {
      const geojson = await apiService.get('/unidades-vecinales/geojson');
      geojson.features.forEach(f => {
        const color = f.properties.color || MZ_COLORS[f.properties.macrozona] || '#6b7280';
        const isSel = f.properties._id === selectedUv;
        const layer = L.geoJSON(f, {
          style: { color: isSel ? '#2563eb' : color, weight: isSel ? 4 : 2, fillOpacity: isSel ? 0.3 : 0.15, fillColor: color },
          onEachFeature: (feat, l) => {
            l.bindTooltip(`<strong>UV ${feat.properties.numero}</strong>${feat.properties.nombre ? '<br>' + feat.properties.nombre : ''}`, { direction: 'center' });
            l.on('click', () => { onSelectUv(feat.properties._id); setEditForm(null); });
          }
        });
        layer.addTo(map);
        polyLayersRef.current[f.properties._id] = layer;
      });
    } catch {}
  }, [selectedUv, onSelectUv]);

  useEffect(() => { loadPolygons(); }, [loadPolygons]);

  useEffect(() => {
    Object.entries(polyLayersRef.current).forEach(([id, layer]) => {
      layer.eachLayer(l => {
        const p = l.feature?.properties;
        const color = p?.color || MZ_COLORS[p?.macrozona] || '#6b7280';
        l.setStyle(id === selectedUv ? { weight: 4, fillOpacity: 0.35, color: '#2563eb' } : { weight: 2, fillOpacity: 0.15, color });
      });
    });
  }, [selectedUv]);

  // === ACTIONS ===
  async function handleCreate() {
    if (!createForm.nombre.trim()) { addToast('Nombre requerido', 'error'); return; }
    if (!drawnGeometry) { addToast('Dibuja el polígono primero', 'error'); return; }
    setSaving(true);
    try {
      const maxNum = uvList.reduce((mx, u) => Math.max(mx, parseInt(u.numero) || 0), 0);
      const num = String(maxNum + 1).padStart(3, '0');
      await apiService.post('/unidades-vecinales', { numero: num, idOficial: `RENCA-${num}`, nombre: createForm.nombre.trim(), macrozona: parseInt(createForm.macrozona), geometry: drawnGeometry, color: createForm.color || null, poblaciones: [], calles: [] });
      addToast(`UV ${num} creada`, 'success');
      resetMode(); onDataChange();
    } catch (err) { addToast(err.message || 'Error', 'error'); }
    finally { setSaving(false); }
  }

  async function handleSavePolygon() {
    if (!selectedUv || !drawnGeometry) { addToast('Dibuja el polígono', 'error'); return; }
    setSaving(true);
    try {
      await apiService.put(`/unidades-vecinales/${selectedUv}`, { geometry: drawnGeometry });
      addToast('Polígono guardado', 'success');
      resetMode(); onDataChange();
    } catch (err) { addToast(err.message || 'Error', 'error'); }
    finally { setSaving(false); }
  }

  async function handleDeletePolygon(id) {
    try { await apiService.put(`/unidades-vecinales/${id}`, { geometry: null }); addToast('Polígono eliminado', 'success'); onDataChange(); }
    catch { addToast('Error', 'error'); }
  }

  function startDraw(uvId, isReDraw) {
    setMode(isReDraw ? 'reDraw' : 'drawPoly');
    onSelectUv(uvId);
    drawnItemsRef.current?.clearLayers();
    setDrawnGeometry(null);
    setEditForm(null);

    // If re-drawing, load existing polygon into drawn layer for editing
    if (isReDraw) {
      const uv = uvList.find(u => u._id === uvId);
      if (uv?.geometry?.coordinates && mapInstanceRef.current) {
        const existingLayer = L.geoJSON({ type: 'Feature', geometry: uv.geometry }, {
          style: { color: '#2563eb', weight: 3, fillOpacity: 0.2 }
        });
        existingLayer.eachLayer(l => drawnItemsRef.current.addLayer(l));
      }
    }
  }

  function resetMode() { setMode('view'); setDrawnGeometry(null); drawnItemsRef.current?.clearLayers(); }

  // === TEST ADDRESS ===
  async function handleTestAddress() {
    if (!testAddress.trim() || testAddress.trim().length < 5) return;
    setTestResult({ searching: true });
    if (testMarkerRef.current && mapInstanceRef.current) { mapInstanceRef.current.removeLayer(testMarkerRef.current); testMarkerRef.current = null; }
    try {
      const result = await apiService.get(`/unidades-vecinales/buscar?direccion=${encodeURIComponent(testAddress)}`);
      if (result.coords && mapInstanceRef.current) {
        const marker = L.marker([result.coords.lat, result.coords.lng], {
          icon: L.divIcon({ className: '', html: '<div style="width:14px;height:14px;background:#dc2626;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })
        }).addTo(mapInstanceRef.current);
        testMarkerRef.current = marker;
        mapInstanceRef.current.setView([result.coords.lat, result.coords.lng], 16);
      }
      if (result.encontrada) {
        setTestResult({ found: true, uvNumero: result.unidadVecinal.numero, uvNombre: result.unidadVecinal.nombre, macrozona: result.unidadVecinal.macrozona, coords: result.coords });
        onSelectUv(result.unidadVecinal._id);
      } else {
        setTestResult({ found: false, coords: result.coords });
      }
    } catch (err) { setTestResult({ found: false, error: err.message }); }
  }

  function clearTest() {
    setTestAddress(''); setTestResult(null);
    if (testMarkerRef.current && mapInstanceRef.current) { mapInstanceRef.current.removeLayer(testMarkerRef.current); testMarkerRef.current = null; }
  }

  // === EDIT UV ===
  function openEditUv(uv) { setEditForm({ nombre: uv.nombre || '', macrozona: uv.macrozona || 1, poblaciones: [...(uv.poblaciones || [])], color: uv.color || '' }); setEditPobInput(''); }

  async function handleSaveEdit() {
    if (!selectedUv || !editForm) return;
    setSavingEdit(true);
    try {
      await apiService.put(`/unidades-vecinales/${selectedUv}`, { nombre: editForm.nombre, macrozona: parseInt(editForm.macrozona), poblaciones: editForm.poblaciones, color: editForm.color || null });
      addToast('UV actualizada', 'success'); setEditForm(null); onDataChange();
    } catch (err) { addToast(err.message || 'Error', 'error'); }
    finally { setSavingEdit(false); }
  }

  function addPoblacion() { const v = editPobInput.trim(); if (!v) return; setEditForm(f => ({ ...f, poblaciones: [...f.poblaciones, v] })); setEditPobInput(''); }

  const selectedData = uvList.find(u => u._id === selectedUv);
  const withPoly = uvList.filter(u => u.geometry?.coordinates).length;
  const isDrawMode = mode === 'drawPoly' || mode === 'reDraw' || mode === 'create';

  return (
    <div style={{ display: 'flex', gap: 0, height: 680, borderRadius: 14, overflow: 'hidden', border: '1px solid #d1d5db', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
      {/* === SIDE PANEL === */}
      <div style={{ width: 300, background: '#fafbfc', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e5e7eb', background: '#fff' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 2 }}>Unidades Vecinales</div>
          <div style={{ fontSize: 12, color: '#6b7280' }}>
            {uvList.length} total &middot; <span style={{ color: '#16a34a' }}>{withPoly} con polígono</span> &middot; <span style={{ color: '#f59e0b' }}>{uvList.length - withPoly} pendientes</span>
          </div>
        </div>

        {/* Search + test */}
        <div style={{ padding: '10px 12px', borderBottom: '1px solid #f3f4f6', background: '#fff' }}>
          <input value={search} onChange={e => onSearchChange(e.target.value)} placeholder="Filtrar UV por nombre o número..."
            style={{ ...panelInput, marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 4 }}>
            <input value={testAddress} onChange={e => setTestAddress(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleTestAddress()}
              placeholder="Probar dirección..." style={{ ...panelInput, flex: 1, fontSize: 12 }} />
            <button onClick={handleTestAddress} disabled={testResult?.searching}
              style={btnSm('#111827', '#fff')}>{testResult?.searching ? '...' : 'Probar'}</button>
          </div>
          {testResult && !testResult.searching && (
            <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, fontSize: 12, background: testResult.found ? '#f0fdf4' : '#fef2f2', border: `1px solid ${testResult.found ? '#bbf7d0' : '#fecaca'}` }}>
              {testResult.found ? (
                <>
                  <div style={{ fontWeight: 600, color: '#166534' }}>UV {testResult.uvNumero} — {testResult.uvNombre || ''}</div>
                  <div style={{ color: '#166534', fontSize: 11 }}>Macrozona {testResult.macrozona} ({MZ_NAMES[testResult.macrozona] || ''})</div>
                </>
              ) : (
                <div style={{ color: '#991b1b' }}>No se encontró UV {testResult.coords ? `(${testResult.coords.lat.toFixed(4)}, ${testResult.coords.lng.toFixed(4)})` : ''}</div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                <span style={{ fontSize: 10, color: '#9ca3af' }}>Precisión aprox. (OpenStreetMap)</span>
                <button onClick={clearTest} style={{ fontSize: 10, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Limpiar</button>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ padding: '8px 12px', display: 'flex', gap: 6 }}>
          {mode === 'view' ? (
            <button onClick={() => { setMode('create'); setDrawnGeometry(null); drawnItemsRef.current?.clearLayers(); setCreateForm({ nombre: '', macrozona: 1 }); }}
              style={{ ...btnSm('#2563eb', '#fff'), flex: 1 }}>+ Nueva UV</button>
          ) : (
            <button onClick={resetMode} style={{ ...btnSm('#fff', '#374151'), flex: 1, border: '1px solid #d1d5db' }}>Cancelar</button>
          )}
        </div>

        {/* Create form */}
        {mode === 'create' && (
          <div style={{ padding: '10px 12px', borderTop: '1px solid #e5e7eb', background: '#eff6ff' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8', marginBottom: 8 }}>Nueva UV — dibuja el polígono en el mapa</div>
            <input value={createForm.nombre} onChange={e => setCreateForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Nombre" style={{ ...panelInput, marginBottom: 6 }} />
            <select value={createForm.macrozona} onChange={e => setCreateForm(f => ({ ...f, macrozona: e.target.value }))} style={{ ...panelSelect, marginBottom: 6 }}>
              {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>MZ {n} — {MZ_NAMES[n]}</option>)}
            </select>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Color</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
              {COLOR_PALETTE.map(c => (
                <button key={c} onClick={() => setCreateForm(f => ({ ...f, color: f.color === c ? '' : c }))}
                  style={{ width: 20, height: 20, borderRadius: 5, background: c, border: createForm.color === c ? '3px solid #111827' : '2px solid #e5e7eb', cursor: 'pointer', padding: 0, boxSizing: 'border-box' }} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: drawnGeometry ? '#16a34a' : '#6b7280', marginBottom: 6, fontWeight: drawnGeometry ? 600 : 400 }}>
              {drawnGeometry ? 'Polígono dibujado' : 'Usa la herramienta de polígono en el mapa'}
            </div>
            <button onClick={handleCreate} disabled={saving || !drawnGeometry}
              style={{ ...btnSm(drawnGeometry ? '#2563eb' : '#93c5fd', '#fff'), width: '100%', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : 'Crear UV'}
            </button>
          </div>
        )}

        {/* Draw/Redraw polygon */}
        {(mode === 'drawPoly' || mode === 'reDraw') && selectedData && (
          <div style={{ padding: '10px 12px', borderTop: '1px solid #e5e7eb', background: mode === 'reDraw' ? '#fef3c7' : '#f0fdf4' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: mode === 'reDraw' ? '#92400e' : '#166534', marginBottom: 4 }}>
              {mode === 'reDraw' ? 'Redibujar' : 'Dibujar'} polígono — UV {selectedData.numero}
            </div>
            <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
              {drawnGeometry ? 'Polígono listo.' : mode === 'reDraw' ? 'Dibuja el nuevo polígono (el anterior se mostrará como referencia).' : 'Dibuja el polígono en el mapa.'}
            </div>
            <button onClick={handleSavePolygon} disabled={saving || !drawnGeometry}
              style={{ ...btnSm(drawnGeometry ? '#16a34a' : '#86efac', '#fff'), width: '100%', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Guardando...' : 'Guardar Polígono'}
            </button>
          </div>
        )}

        {/* UV List */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filteredList.map(uv => {
            const active = uv._id === selectedUv;
            const hasPoly = !!uv.geometry?.coordinates;
            const mzColor = getUvColor(uv);
            return (
              <button key={uv._id} onClick={() => { onSelectUv(uv._id); setEditForm(null); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: 'calc(100% - 12px)', margin: '1px 6px',
                  padding: '10px 10px', background: active ? '#eff6ff' : 'transparent',
                  border: active ? '2px solid #bfdbfe' : '2px solid transparent',
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontSize: 13, transition: 'all 0.1s'
                }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: hasPoly ? mzColor : '#d1d5db', border: hasPoly ? 'none' : '2px solid #9ca3af', boxSizing: 'border-box' }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: active ? '#1d4ed8' : '#374151', fontWeight: active ? 600 : 400 }}>
                  UV {uv.numero} {uv.nombre ? `— ${uv.nombre}` : ''}
                </span>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, background: mzColor + '18', color: mzColor, fontWeight: 700, flexShrink: 0 }}>
                  {uv.macrozona || '?'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected UV detail/edit */}
        {selectedData && mode === 'view' && (
          <div style={{ borderTop: '1px solid #e5e7eb', background: '#fff', padding: 14, maxHeight: 300, overflow: 'auto' }}>
            {!editForm ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>UV {selectedData.numero}</div>
                  <button onClick={() => openEditUv(selectedData)} style={{ fontSize: 12, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Editar</button>
                </div>
                {selectedData.nombre && <div style={{ fontSize: 13, color: '#374151', marginBottom: 4 }}>{selectedData.nombre}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 14, height: 14, borderRadius: 4, background: getUvColor(selectedData), flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                    Macrozona {selectedData.macrozona} — {MZ_NAMES[selectedData.macrozona] || ''}
                  </span>
                </div>
                {selectedData.poblaciones?.length > 0 && (
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600 }}>Poblaciones:</span> {selectedData.poblaciones.join(', ')}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selectedData.geometry?.coordinates ? (
                    <>
                      <button onClick={() => startDraw(selectedData._id, true)} style={btnSm('#f59e0b', '#fff')}>Redibujar polígono</button>
                      <button onClick={() => handleDeletePolygon(selectedData._id)} style={btnSm('#fff', '#dc2626')}>Borrar polígono</button>
                    </>
                  ) : (
                    <button onClick={() => startDraw(selectedData._id, false)} style={btnSm('#111827', '#fff')}>Dibujar polígono</button>
                  )}
                  <button onClick={() => onDeleteUv(selectedData)} style={{ ...btnSm('#fff', '#dc2626'), border: '1px solid #fecaca' }}>Eliminar UV</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Editar UV {selectedData.numero}</div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 2 }}>Nombre</label>
                <input value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))} style={{ ...panelInput, marginBottom: 8 }} />
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 2 }}>Macrozona</label>
                <select value={editForm.macrozona} onChange={e => setEditForm(f => ({ ...f, macrozona: e.target.value }))} style={{ ...panelSelect, marginBottom: 8 }}>
                  {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>MZ {n} — {MZ_NAMES[n]}</option>)}
                </select>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>Color del polígono</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                  {COLOR_PALETTE.map(c => (
                    <button key={c} onClick={() => setEditForm(f => ({ ...f, color: f.color === c ? '' : c }))}
                      style={{
                        width: 22, height: 22, borderRadius: 6, background: c, border: editForm.color === c ? '3px solid #111827' : '2px solid #e5e7eb',
                        cursor: 'pointer', padding: 0, boxSizing: 'border-box'
                      }} title={c} />
                  ))}
                </div>
                <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 2 }}>Poblaciones</label>
                <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
                  <input value={editPobInput} onChange={e => setEditPobInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addPoblacion())}
                    placeholder="Agregar..." style={{ ...panelInput, flex: 1, fontSize: 12 }} />
                  <button onClick={addPoblacion} style={btnSm('#2563eb', '#fff')}>+</button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                  {editForm.poblaciones.map((p, i) => (
                    <span key={i} style={{ padding: '3px 8px', background: '#e5e7eb', borderRadius: 8, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {p}
                      <button onClick={() => setEditForm(f => ({ ...f, poblaciones: f.poblaciones.filter((_, j) => j !== i) }))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#9ca3af', padding: 0, lineHeight: 1 }}>&times;</button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditForm(null)} style={{ ...btnSm('#fff', '#374151'), flex: 1, border: '1px solid #d1d5db' }}>Cancelar</button>
                  <button onClick={handleSaveEdit} disabled={savingEdit} style={{ ...btnSm('#2563eb', '#fff'), flex: 1, opacity: savingEdit ? 0.6 : 1 }}>
                    {savingEdit ? '...' : 'Guardar'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* === MAP === */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        {saving && (
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', background: '#2563eb', color: '#fff', padding: '6px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            Guardando...
          </div>
        )}
        {isDrawMode && (
          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', padding: '8px 20px', borderRadius: 10, fontSize: 13, zIndex: 1000, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
            Usa la herramienta de polígono (arriba derecha) para dibujar en el mapa
          </div>
        )}
      </div>
    </div>
  );
}
