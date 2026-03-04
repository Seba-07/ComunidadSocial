import { useState } from 'react';
import { apiService } from '@services/ApiService.js';
import { useUiStore } from '../../stores/uiStore';

export default function VotingPanel({ agendaItem, orgId, assemblyId, currentUser, onVoted }) {
  const [selectedVotes, setSelectedVotes] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const addToast = useUiStore((s) => s.addToast);

  const userRut = currentUser?.rut;
  const alreadyVoted = (agendaItem.voterRegistry || agendaItem.votes)?.some((v) => v.voterRut === userRut);

  if (alreadyVoted) {
    return (
      <div style={{ padding: 12, background: '#d1fae5', borderRadius: 8, fontSize: 13, color: '#065f46', fontWeight: 500 }}>
        Ya has emitido tu voto en este punto.
      </div>
    );
  }

  const { votingMode, candidates = [] } = agendaItem;

  async function handleSubmit() {
    let votes = [];

    if (votingMode === 'per_cargo') {
      const cargos = [...new Set(candidates.map((c) => c.cargo))];
      for (const cargo of cargos) {
        if (!selectedVotes[cargo]) {
          addToast(`Selecciona un candidato para ${cargo}`, 'error');
          return;
        }
        votes.push({ cargo, candidateRut: selectedVotes[cargo] });
      }
    } else if (votingMode === 'per_lista') {
      if (!selectedVotes.lista) {
        addToast('Selecciona una lista', 'error');
        return;
      }
      votes.push({ lista: selectedVotes.lista });
    }

    setSubmitting(true);
    try {
      await apiService.castVote(orgId, assemblyId, agendaItem.id || agendaItem._id, votes);
      addToast('Voto registrado correctamente', 'success');
      if (onVoted) onVoted();
    } catch (error) {
      addToast(error.message || 'Error al registrar voto', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (votingMode === 'per_lista') {
    const listas = [...new Set(candidates.map((c) => c.lista))];
    return (
      <div style={{ marginTop: 12 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Selecciona una lista:</p>
        {listas.map((lista) => {
          const members = candidates.filter((c) => c.lista === lista);
          return (
            <label key={lista} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, cursor: 'pointer' }}>
              <input
                type="radio"
                name="lista-vote"
                checked={selectedVotes.lista === lista}
                onChange={() => setSelectedVotes({ lista })}
              />
              <span style={{ fontWeight: 500 }}>{lista}</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                ({members.map((m) => `${m.firstName} ${m.lastName}`).join(', ')})
              </span>
            </label>
          );
        })}
        <button
          className="btn-auth"
          style={{ marginTop: 12 }}
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? 'Enviando...' : 'Votar'}
        </button>
      </div>
    );
  }

  // per_cargo
  const cargos = [...new Set(candidates.map((c) => c.cargo))];
  return (
    <div style={{ marginTop: 12 }}>
      {cargos.map((cargo) => {
        const cargoLabel = cargo.charAt(0).toUpperCase() + cargo.slice(1);
        const cargoCandidates = candidates.filter((c) => c.cargo === cargo);
        return (
          <div key={cargo} style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{cargoLabel}:</p>
            {cargoCandidates.map((c) => (
              <label key={c.rut} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 4, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name={`vote-${cargo}`}
                  checked={selectedVotes[cargo] === c.rut}
                  onChange={() => setSelectedVotes((v) => ({ ...v, [cargo]: c.rut }))}
                />
                <span>{c.firstName} {c.lastName}</span>
              </label>
            ))}
          </div>
        );
      })}
      <button
        className="btn-auth"
        style={{ marginTop: 8 }}
        disabled={submitting}
        onClick={handleSubmit}
      >
        {submitting ? 'Enviando...' : 'Votar'}
      </button>
    </div>
  );
}
