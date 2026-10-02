import { AudioBus, TRACKS } from '../audio/engine';
import { esc } from './text';

const VOLUME_KEYS = ['master', 'music', 'sfx', 'ambient'] as const;

/** The music, effects, ambient, and mute controls shared by the start menu and the pause menu. */
export function renderAudioSettings(audio: AudioBus): string {
  const sliders = VOLUME_KEYS.map((key) => {
    const value = audio[key];
    return `<label class="slider">${key} <input type="range" min="0" max="1" step="0.01" value="${value}" data-volume="${key}" data-testid="audio-volume-${key}"/><b>${Math.round(value * 100)}</b></label>`;
  }).join('');
  return `
    <div class="audio-settings" data-testid="audio-settings">
      <label class="row"><input type="checkbox" data-setting="mute" data-testid="audio-mute" ${audio.muted ? 'checked' : ''}/> Mute all</label>
      <p class="muted audio-note">Mute all silences music, effects, and ambient, then restores these same levels. Press M in a game. Ambient is a low wind and reactor hum during play, and it rests on the menu and the recap.</p>
      <label class="row"><input type="checkbox" data-setting="music" data-testid="audio-music" ${audio.musicOn ? 'checked' : ''}/> Music</label>
      <label class="row"><input type="checkbox" data-setting="sfx" data-testid="audio-sfx" ${audio.sfxOn ? 'checked' : ''}/> Sound effects</label>
      ${sliders}
      <label class="row">Track <select data-setting="track" data-testid="audio-track">${TRACKS.map((track) => `<option value="${track.id}" ${audio.track === track.id ? 'selected' : ''}>${esc(track.name)}</option>`).join('')}</select></label>
      <label class="row">Order <select data-setting="mode" data-testid="audio-mode"><option value="loop" ${audio.mode === 'loop' ? 'selected' : ''}>Loop</option><option value="shuffle" ${audio.mode === 'shuffle' ? 'selected' : ''}>Shuffle</option></select></label>
      <p class="muted audio-note" data-testid="music-credits">Music: <a href="https://opengameart.org/content/exploration-theme" target="_blank" rel="noopener noreferrer">Cleyton Kauffman</a>, <a href="https://opengameart.org/content/dark-sci-fi-audio-pack" target="_blank" rel="noopener noreferrer">SRG774</a>, <a href="https://opengameart.org/content/outworld" target="_blank" rel="noopener noreferrer">vitalezzz</a> (CC0, <a href="https://opengameart.org/" target="_blank" rel="noopener noreferrer">OpenGameArt</a>)</p>
    </div>`;
}

/** One handler for both menus. Returns true when the event belonged to these controls. */
export function handleAudioSettings(audio: AudioBus, event: Event): boolean {
  const target = event.target;
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return false;
  if (event.type === 'input' && target instanceof HTMLInputElement) {
    const key = target.dataset.volume;
    if (key !== 'master' && key !== 'music' && key !== 'sfx' && key !== 'ambient') return false;
    audio.setVolume(key, Number(target.value));
    const label = target.parentElement?.querySelector('b');
    if (label) label.textContent = String(Math.round(audio[key] * 100));
    return true;
  }
  if (event.type !== 'change') return false;
  const setting = target.dataset.setting;
  if (setting === 'mute' && target instanceof HTMLInputElement) {
    audio.setMuted(target.checked);
    return true;
  }
  if (setting === 'music' && target instanceof HTMLInputElement) {
    audio.setMusic(target.checked);
    return true;
  }
  if (setting === 'sfx' && target instanceof HTMLInputElement) {
    audio.setSfx(target.checked);
    return true;
  }
  if (setting === 'mode' && target instanceof HTMLSelectElement) {
    audio.setMode(target.value === 'shuffle' ? 'shuffle' : 'loop');
    return true;
  }
  if (setting === 'track' && target instanceof HTMLSelectElement) {
    audio.setTrack(target.value);
    return true;
  }
  return false;
}
