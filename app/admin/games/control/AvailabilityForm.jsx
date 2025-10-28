'use client';

import { useEffect, useState } from 'react';
import { useFormState, useFormStatus } from 'react-dom';
import { updateGameAvailabilityAction } from '../actions';

const initialState = { ok: false };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        padding: '0.8rem 1.6rem',
        borderRadius: '999px',
        border: 'none',
        backgroundColor: pending ? '#4c4c4c' : '#1FAA8F',
        color: '#111',
        fontWeight: 600,
        cursor: pending ? 'wait' : 'pointer',
        transition: 'background-color 0.2s ease',
      }}
    >
      {pending ? 'Guardando cambios…' : 'Guardar cambios'}
    </button>
  );
}

export default function AvailabilityForm({ catalog, initialSettings }) {
  const [state, formAction] = useFormState(async (_prevState, formData) => {
    return updateGameAvailabilityAction(formData);
  }, initialState);

  const [manualEnabled, setManualEnabled] = useState(initialSettings.manualControlEnabled);
  const [unlockedMap, setUnlockedMap] = useState(initialSettings.unlockedGames);

  useEffect(() => {
    setManualEnabled(initialSettings.manualControlEnabled);
    setUnlockedMap(initialSettings.unlockedGames);
  }, [initialSettings.manualControlEnabled, initialSettings.unlockedGames]);

  useEffect(() => {
    if (state?.ok) {
      setManualEnabled(state.manualControlEnabled);
      setUnlockedMap(state.unlockedGames);
    }
  }, [state]);

  const handleGameToggle = (gameId, checked) => {
    setUnlockedMap((current) => ({
      ...current,
      [String(gameId)]: checked,
    }));
  };

  const successMessage = state?.ok ? 'Configuracion guardada correctamente.' : '';
  const errorMessage = !state?.ok && state?.error ? 'No fue posible guardar los cambios.' : '';

  return (
    <form
      action={formAction}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        backgroundColor: 'rgba(0,0,0,0.35)',
        padding: '1.5rem',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <fieldset
        style={{
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '1.25rem',
        }}
      >
        <legend style={{ padding: '0 0.5rem' }}>Control manual</legend>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            name="manualControlEnabled"
            checked={manualEnabled}
            onChange={(event) => setManualEnabled(event.target.checked)}
            style={{ transform: 'scale(1.2)' }}
          />
          Activar control manual de desbloqueos
        </label>
        <p style={{ marginTop: '0.75rem', color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem' }}>
          Cuando este interruptor esta activo, SOLO se mostraran como desbloqueados los juegos que marques
          abajo. Al desactivarlo, se regresa al comportamiento automatico (3 juegos por defecto + uno nuevo
          por semana).
        </p>
      </fieldset>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
        }}
      >
        {catalog.map((game) => {
          const checked = Boolean(unlockedMap[String(game.id)]);
          return (
            <label
              key={game.id}
              htmlFor={`game-${game.id}`}
              style={{
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '12px',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                backgroundColor: 'rgba(32,32,32,0.55)',
                cursor: manualEnabled ? 'pointer' : 'not-allowed',
                opacity: manualEnabled ? 1 : 0.6,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                  {game.title}
                </div>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem' }}>
                  {game.description}
                </p>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 'auto',
                  gap: '0.75rem',
                }}
              >
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    color: checked ? '#4AE3C2' : '#FFAE63',
                  }}
                >
                  {checked ? 'Desbloqueado' : 'Bloqueado'}
                </span>
                <input
                  id={`game-${game.id}`}
                  type="checkbox"
                  name={`game-${game.id}`}
                  checked={checked}
                  disabled={!manualEnabled}
                  onChange={(event) => handleGameToggle(game.id, event.target.checked)}
                  style={{ transform: 'scale(1.1)' }}
                />
              </div>
            </label>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <SubmitButton />
        {successMessage ? (
          <span style={{ color: '#4AE3C2', fontSize: '0.9rem', fontWeight: 600 }}>{successMessage}</span>
        ) : null}
        {errorMessage ? (
          <span style={{ color: '#FFAE63', fontSize: '0.9rem', fontWeight: 600 }}>{errorMessage}</span>
        ) : null}
      </div>
    </form>
  );
}

