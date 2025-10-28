'use client';

import React, { useEffect } from 'react';

// CSS Modules (usa las clases .scope como ancla local)
import ui from './ui.module.css';
import puzzle from './puzzle.module.css';
import volume from './volume.module.css';

import { initGame } from './game-runtime';
import { initVolumeSystem } from './volumeSystem';
import { initAudioBridge } from './audio-bridge';
import { initVolumeUI } from './volume-ui';

export default function GamePage() {
  useEffect(() => {
    // 1) Inicializadores (orden recomendado)
    initVolumeSystem();
    const cleanupAudio = initAudioBridge?.();
    const cleanupVolumeUI = initVolumeUI?.();
    const cleanupGame = initGame?.();

    // Limpieza al desmontar (StrictMode monta/demonta en dev)
    return () => {
      try { cleanupGame && cleanupGame(); } catch {}
      try { cleanupVolumeUI && cleanupVolumeUI(); } catch {}
      try { cleanupAudio && cleanupAudio(); } catch {}
    };
  }, []);

  // Activa reglas del ui + puzzle + volume bajo el mismo contenedor
  const rootClass = [ui.scope, puzzle.scope, volume.scope].join(' ');

  return (
    <div id="app" className={rootClass}>
      {/* HUD superior (móvil) */}
      <header className="hud">
        <div className="hud-left">
          <h1 className="title">Construyendo el propósito</h1>
        </div>

        <div className="hud-center">
          <div className="timer" aria-live="polite">
            <span id="time-mm">02</span>:<span id="time-ss">00</span>
          </div>
          <div className="progress">
            <div id="progress-bar"></div>
          </div>
          <div className="pieces-count"><span id="pieces-count">0/0</span></div>
        </div>

        <div className="hud-right">
          <button id="btn-reset" className="btn ghost">Reiniciar</button>
          {/* JS inyecta botón música y “Referencia” en móvil */}
        </div>
      </header>

      {/* LAYOUT principal: tablero + panel derecho */}
      <main className="layout stage">
        {/* Tablero */}
        <section className="board-area">
          <div id="board-wrap">
            <div id="board-frame">
              <div id="board" className="board">
                <div id="guide-grid"></div>
                {/* Piezas se inyectan aquí por initGame() */}
              </div>
            </div>
          </div>
        </section>

        {/* Panel lateral (desktop) */}
        <aside className="side-panel">
          <div className="side-card">
            <div className="time-large" aria-hidden="true">
              <span id="time-mm-right">02</span>:<span id="time-ss-right">00</span>
            </div>

            <div className="progress right">
              <div id="progress-bar-right"></div>
            </div>

            <div className="pieces-count right">
              <span id="pieces-count-right">0/0</span>
            </div>

            <button
              id="btn-music-right"
              type="button"
              className="volume-toggle-btn"
              aria-label="Volumen"
            >
              <img src="/games/1/volume_system/icons/unmute.svg" alt="" />
            </button>

            {/* Imagen de referencia (desktop) */}
            <div className="ref-box">
              <img
                id="ref-image"
                src="/games/1/assets/_reference.jpg"
                alt="Referencia del rompecabezas"
              />
            </div>
          </div>
        </aside>
      </main>

      {/* Banner final */}
      <div id="end-banner" className="end-banner" hidden>
        <div className="modal-card">
          <h2 id="end-title">¡Tiempo!</h2>
          <p className="score-text">
            Puntaje: <strong id="final-score">0</strong>
          </p>
          <p id="end-extra" className="score-text"></p>
          <div className="modal-actions">
            <button id="btn-end-action" className="btn primary">Continuar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
