import type { App } from '../app';
import { drawPlanet, drawStar, drawStarfield } from '../../art/draw';
import { difficultyProfile } from '../../core/difficulty';
import { DIFFICULTIES } from '../../core/factions';
import { Game } from '../../core/game';
import { type Difficulty } from '../../core/types';
import { IntroPlayer, INTRO_SCENES } from '../../render/intro';
import { esc } from '../text';

export function renderMenu(this: App) {
  this.overlay.innerHTML = '';
  this.stage.innerHTML = `
    <div class="menu" data-testid="start-menu">
      <div class="menu-card">
        <p class="eyebrow">Year 2460 · Week 1</p>
        <h1>Proxima</h1>
        <p class="tag">Six factions woke in the wreck of Halcyon. The world is harsh on every face. One of them will decide what it becomes.</p>
        <div>
          <p class="muted">Difficulty</p>
          <div class="row" data-testid="difficulty">
            ${DIFFICULTIES.map((item) => `<button class="btn small ${this.setup.difficulty === item.id ? 'on' : ''}" data-action="difficulty" data-difficulty="${item.id}" data-testid="difficulty-${item.id}">${esc(item.label)}</button>`).join('')}
          </div>
          <p class="muted" data-testid="difficulty-blurb">${esc(difficultyProfile(this.setup.difficulty).blurb)}</p>
        </div>
        <label class="row"><input type="checkbox" data-setting="allied" ${this.setup.allied ? 'checked' : ''}/> Allied Victory</label>
        <label class="row"><input type="checkbox" data-setting="events" ${this.setup.events ? 'checked' : ''}/> Random events</label>
        <label class="row" data-testid="update-check-toggle"><input type="checkbox" data-setting="updates" ${this.updateCheck ? 'checked' : ''}/> Check for updates when Proxima starts</label>
        <div class="stack">
          <button class="btn primary" data-action="play-intro" data-testid="play-intro">Play Introduction</button>
          <button class="btn" data-action="new-game" data-testid="new-game">New Game</button>
          <button class="btn" data-action="load-game" data-testid="load-game">Load Game</button>
          <button class="btn" data-action="game-options" data-testid="game-options">Game Options</button>
          <button class="btn" data-action="menu-audio" data-testid="menu-audio">Audio</button>
          <button class="btn" data-action="quit" data-testid="quit">Quit</button>
        </div>
      </div>
      <canvas class="menu-bg" id="menu-bg"></canvas>
    </div>`;
  const canvas = this.stage.querySelector('#menu-bg') as HTMLCanvasElement;
  const loop = (t: number) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawStarfield(ctx, rect.width, rect.height, t * 0.01);
      drawStar(ctx, rect.width * 0.28, rect.height * 0.32, 28, t * 0.001);
      drawPlanet(ctx, rect.width * 0.62, rect.height * 0.55, 110, t * 0.001);
    }
    this.backdrop = requestAnimationFrame(loop);
  };
  this.backdrop = requestAnimationFrame(loop);
}

export function renderIntro(this: App) {
  const scene = INTRO_SCENES[this.introIndex];
  this.stage.innerHTML = `
    <div class="intro" data-testid="intro-screen">
      <canvas class="intro-canvas" id="intro-canvas" data-action="intro-next"></canvas>
      <div class="intro-bar">
        <div class="intro-copy">
          <p class="eyebrow">Introduction ${this.introIndex + 1} / ${INTRO_SCENES.length}</p>
          <h2>${esc(scene.title)}</h2>
          <p data-testid="intro-text">${esc(scene.text)}</p>
        </div>
        <div class="intro-actions">
          <button class="btn" data-action="intro-back" data-testid="intro-back" ${this.introIndex === 0 ? 'disabled' : ''}>Back</button>
          <button class="btn primary" data-action="intro-next" data-testid="intro-next">${this.introIndex === INTRO_SCENES.length - 1 ? 'Finish' : 'Next'}</button>
          <button class="btn" data-action="intro-skip" data-testid="intro-skip">Skip intro</button>
          <button class="btn" data-action="intro-exit" data-testid="intro-exit">Exit</button>
        </div>
      </div>
    </div>`;
  this.introPlayer = new IntroPlayer(this.stage.querySelector('#intro-canvas') as HTMLCanvasElement, () => this.introIndex);
}

export function exitIntro(this: App) {
  this.screen = 'menu';
  this.render();
}

