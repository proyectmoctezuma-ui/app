'use client';

import React, { useEffect } from 'react';
import ui from './ui.module.css';
import board from './board.module.css';
import volume from './volume.module.css';

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: 'no',
  viewportFit: 'cover',
};

import { initEscalerasGame } from './game-runtime';
import { initVolumeSystem } from '../1/volumeSystem';
import { initVolumeUI } from './volume-ui';

export default function Game3Page() {
  useEffect(() => {
    initVolumeSystem();
    const cleanupVolumeUI = initVolumeUI?.();
    const cleanupGame = initEscalerasGame?.();

    return () => {
      try { cleanupGame && cleanupGame(); } catch {}
      try { cleanupVolumeUI && cleanupVolumeUI(); } catch {}
    };
  }, []);

  const rootClass = [ui.scope, board.scope, volume.scope].join(' ');

  return (
    <div id="app" className={rootClass}>
      <header className="topbar">
        <div className="brand">
          <img
            className="brand__logo"
            src="/games/3/img/logo.jpg"
            alt="Escaleras verdes"
          />
          <div className="stat">
            <span className="label">Tiempo</span>
            <span className="value" id="timeLabel">2:00</span>
          </div>
        </div>

        <div className="stat">
          <span className="label">Puntaje</span>
          <span className="value" id="scoreLabel">0</span>
        </div>

        <div className="hud-right" />
      </header>

      <main className="layout">
        <section id="boardWrap" className="board-wrap">
          <div id="board" className="board">
            <img
              id="piece"
              className="piece"
              src="/games/3/img/ficha.png"
              alt="Ficha"
            />
            <canvas id="debugCanvas" className="debug-canvas" aria-hidden="true" />
          </div>
        </section>

        <aside id="sidePanel" className="side-panel">
          <div className="panel-section">
            <div className="panel-stats">
              <div><strong>Tiempo:</strong> <span id="timeLabelDesktop">--:--</span></div>
              <div><strong>Puntos:</strong> <span id="scoreLabelDesktop">0</span></div>
            </div>
          </div>

          <button
            id="btn-music-right"
            type="button"
            className="volume-toggle-btn"
            aria-label="Volumen"
          >
            <img src="/games/3/volume_system/icons/unmute.svg" alt="" />
          </button>

          <div className="panel-section">
            <h3 className="panel-title">Dado</h3>
            <div id="dicePanel" className="dice-panel">
              <img
                id="diceImgPanel"
                src="/games/3/img/dados/1.png"
                alt="Dado"
                className="dice-img"
              />
            </div>
            <button id="rollButtonDesktop" className="btn wide">Tirar el dado</button>
          </div>
        </aside>
      </main>

      <div className="bottom-cta">
        <button id="rollButton" className="roll-btn" disabled>Tirar el dado</button>
      </div>

      <div
        id="diceOverlay"
        className="dice-overlay hidden"
        aria-hidden="true"
      >
        <div className="dice-box">
          <img
            id="diceImgOverlay"
            src="/games/3/img/dados/1.png"
            alt="Dado"
            className="dice-img"
          />
        </div>
      </div>

      <div
        id="promptModal"
        className="prompt-modal hidden"
        aria-hidden="true"
        role="dialog"
        aria-modal="true"
      >
        <div className="prompt-card prompt-card--media">
          <div className="prompt-media">
            <img id="promptImage" src="" alt="" />
          </div>
          <div className="prompt-body">
            <h2 id="promptTitle" />
            <p id="promptText" />
            <div className="prompt-actions">
              <button id="promptAccept" className="btn">Continuar</button>
            </div>
          </div>
          <button id="promptClose" className="prompt-close" aria-label="Cerrar">×</button>
        </div>
      </div>

      <div
        id="systemModal"
        className="prompt-modal hidden"
        aria-hidden="true"
        role="dialog"
        aria-modal="true"
      >
        <div className="prompt-card prompt-card--simple">
          <div className="prompt-body only-text">
            <h2 id="systemTitle" />
            <p id="systemText" />
            <div className="prompt-actions">
              <button id="systemAccept" className="btn">Entendido</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
