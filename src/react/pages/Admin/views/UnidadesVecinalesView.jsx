import { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../../stores/uiStore';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';

const UVMapFull = lazy(() => import('./UVMapFull'));

export default function UnidadesVecinalesView() {
  const addToast = useUiStore(s => s.addToast);
  const [unidades, setUnidades] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUv, setSelectedUv] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function loadData() {
    setIsLoading(true);
    try {
      const data = await apiService.get('/unidades-vecinales');
      setUnidades(data.unidades || data || []);
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return unidades;
    const q = search.toLowerCase();
    return unidades.filter(u =>
      (u.numero || '').toLowerCase().includes(q) ||
      (u.nombre || '').toLowerCase().includes(q)
    );
  }, [unidades, search]);

  const withPolygon = unidades.filter(u => u.geometry?.coordinates).length;

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiService.delete(`/unidades-vecinales/${deleteTarget._id}`);
      addToast('UV eliminada', 'success');
      setDeleteTarget(null);
      setSelectedUv(null);
      loadData();
    } catch (err) {
      addToast(err.message, 'error');
    }
  }

  if (isLoading) return <LoadingSpinner text="Cargando unidades vecinales..." />;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>Unidades Vecinales</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6b7280' }}>
            {unidades.length} unidades | {withPolygon} con polígono dibujado | {unidades.length - withPolygon} pendientes
          </p>
        </div>
      </div>

      <Suspense fallback={<div style={{ height: 650, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb', borderRadius: 12 }}>Cargando mapa...</div>}>
        <UVMapFull
          uvList={unidades}
          selectedUv={selectedUv}
          onSelectUv={setSelectedUv}
          onDataChange={loadData}
          search={search}
          onSearchChange={setSearch}
          filteredList={filtered}
          onDeleteUv={setDeleteTarget}
        />
      </Suspense>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar Unidad Vecinal"
        message={`¿Eliminar UV ${deleteTarget?.numero}? Las organizaciones asociadas no se verán afectadas.`}
      />
    </div>
  );
}
