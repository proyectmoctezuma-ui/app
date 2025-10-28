'use client';

import React, { useEffect } from 'react';

import ui from './ui.module.css';
import train from './train.module.css';
import volume from '../1/volume.module.css';

import { initTrenGame } from './game-runtime';
import { initVolumeSystem } from '../1/volumeSystem';
import { initVolumeUI } from './volume-ui';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: 'no',
  viewportFit: 'cover',
};

export default function Game2Page() {
  useEffect(() => {
    initVolumeSystem();
    const cleanupAudioUI = initVolumeUI?.();
    const cleanupGame = initTrenGame?.();

    return () => {
      try { cleanupGame && cleanupGame(); } catch {}
      try { cleanupAudioUI && cleanupAudioUI(); } catch {}
    };
  }, []);

  const rootClass = [ui.scope, train.scope, volume.scope].join(' ');

  return (
    <div id="app" className={rootClass}>
      <header className="hud">
        <img className="hud__logo" src="/games/2/assets/logo.jpg" alt="Logo" />
        <div className="hud__title">El tren de las decisiones</div>
        <div className="hud__progress">
          <div className="progressbar">
            <div className="progressbar__fill" id="progressFill"></div>
          </div>
          <div className="hud__counter">
            <span id="qCounter">0</span>/<span id="qTotal">0</span>
          </div>
        </div>
        <div className="hud__score">
          Puntaje: <strong id="scoreLabel">40</strong> - Errores: <strong id="errorsLabel">0</strong>
        </div>
        <div className="hud-right"></div>
      </header>

      <main className="stage">
        <div className="canvas-wrap">
          <canvas id="decoBg"></canvas>
          <canvas id="board"></canvas>
          <canvas id="decoTop"></canvas>
          <div id="fadeOverlay" className="fade"></div>
        </div>

        <aside className="ui-panel" role="region" aria-label="Preguntas y respuestas">
          <button
            id="btn-music-right"
            type="button"
            className="volume-toggle-btn"
            aria-label="Volumen"
          >
            <img src="/games/2/volume_system/icons/unmute.svg" alt="" />
          </button>

          <div className="question-card">
            <div id="questionText" className="question-card__text"></div>
            <div className="answers">
              <button id="btnA" className="answer-btn" data-answer="A"></button>
              <button id="btnB" className="answer-btn" data-answer="B"></button>
            </div>
          </div>
        </aside>
      </main>

      <div id="gameFinal" className="overlay hidden">
        <div className="overlay__card">
          <h2 id="finalTitle">Resultado</h2>
          <p id="finalBody"></p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button id="btn-end-action" className="answer-btn">Continuar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
