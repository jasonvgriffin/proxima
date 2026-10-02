import { preloadLeaderPortraits, watchLeaderPortraits } from '../art/portraits';
import { requestRoundOrders } from '../ai/client';
import { AudioBus } from '../audio/engine';
import { playLoggedCues, playTerraformProgress, snapshotLog, snapshotTerraform } from '../audio/listen';
import { normalizeDifficulty } from '../core/difficulty';
import { defaultAxes, defaultPersonalities } from '../core/factions';
import { Game } from '../core/game';
import { type Difficulty, type FactionId, type MapSizeId, type Proposal, type SaveEnvelope, type SocialAxis, type Unit } from '../core/types';
import { createSaveStore, type SaveStore } from '../platform/saves';
import { createPlatform, type PlatformClient, type UpdateNotice } from '../platform/updates';
import { IntroPlayer, INTRO_SCENES } from '../render/intro';
import { MapView } from '../render/mapview';
import { renderSocialRecap } from './recap';
import { renderTutorial } from './tutorial';
import { handleAudioSettings } from './audioSettings';
import { renderMenu as renderMenuScreen, renderIntro as renderIntroScreen, exitIntro as exitIntroScreen } from './screens/start';
import { renderSetup as renderSetupScreen, renderProfile as renderProfileScreen, startGame as startGameScreen, customizePanel as customizePanelScreen, factionButton as factionButtonScreen } from './screens/newGame';
import { renderOptions as renderOptionsScreen, openPause as openPauseScreen, openAudioPanel as openAudioPanelScreen, askSaveFirst as askSaveFirstScreen } from './screens/options';
import { mountGame as mountGameScreen, refreshGame as refreshGameScreen, showThinking as showThinkingScreen, unitIcon as unitIconScreen, inspector as inspectorScreen, tilePanel as tilePanelScreen, openTile as openTileScreen, onTile as onTileScreen, openCombat as openCombatScreen, openTerraform as openTerraformScreen, adjacentFoe as adjacentFoeScreen, openVictory as openVictoryScreen, openDefeat as openDefeatScreen, openEvent as openEventScreen } from './screens/hud';
import { openDiplomacy as openDiplomacyScreen, openSpies as openSpiesScreen, openSocial as openSocialScreen, openTrade as openTradeScreen, sendTrade as sendTradeScreen } from './screens/diplomacy';
import { pickTech as pickTechScreen, openTechTree as openTechTreeScreen, applyTreeCam as applyTreeCamScreen, fitTree as fitTreeScreen, onTreeHover as onTreeHoverScreen, onTreePointerDown as onTreePointerDownScreen, onTreePointerMove as onTreePointerMoveScreen, onTreePointerUp as onTreePointerUpScreen, onTreeWheel as onTreeWheelScreen, maybePromptResearch as maybePromptResearchScreen, openDesign as openDesignScreen, paintDesignPreview as paintDesignPreviewScreen, saveDesign as saveDesignScreen } from './screens/tech';
import { openSave as openSaveScreen, openLoad as openLoadScreen, writeSlot as writeSlotScreen, readSlot as readSlotScreen, finishPending as finishPendingScreen, exitDesktop as exitDesktopScreen, envelope as envelopeScreen, runSave as runSaveScreen, showSaveError as showSaveErrorScreen, writeAutosave as writeAutosaveScreen, continueAutosave as continueAutosaveScreen } from './screens/load';
import { debugDefeat as debugDefeatScreen, debugTrade as debugTradeScreen, debugEvent as debugEventScreen, debugTransport as debugTransportScreen, debugFinishTerraform as debugFinishTerraformScreen, debugMidgame as debugMidgameScreen, showPortraitSheet as showPortraitSheetScreen, showUnitSheet as showUnitSheetScreen, debugDiplomacy as debugDiplomacyScreen, seedDiplomacyOffer as seedDiplomacyOfferScreen, spawnRaider as spawnRaiderScreen, debugRecap as debugRecapScreen } from './debug';
import { paintBanner as paintBannerScreen, bootUpdates as bootUpdatesScreen, persistUpdateCheck as persistUpdateCheckScreen, pollUpdates as pollUpdatesScreen, handleUpdateAction as handleUpdateActionScreen, answerUpdatePrompt as answerUpdatePromptScreen, openDownloadConsent as openDownloadConsentScreen, runDownload as runDownloadScreen, previewUpdate as previewUpdateScreen, previewDownloadConsent as previewDownloadConsentScreen } from './updatesFlow';
import { paintEmblems as paintEmblemsScreen, paintMarks as paintMarksScreen } from './paint';

type Screen = 'menu' | 'intro' | 'setup' | 'options' | 'profile' | 'game' | 'recap';

export class App {
  stage: HTMLElement;
  overlay: HTMLElement;
  audio = new AudioBus();
  saves: SaveStore = createSaveStore();
  platform: PlatformClient = createPlatform();
  updateCheck = false;
  updateNotice: UpdateNotice | null = null;
  updateDismissed = false;
  screen: Screen = 'menu';
  game: Game | null = null;
  introIndex = 0;
  introPlayer: IntroPlayer | null = null;
  map: MapView | null = null;
  gameMounted = false;
  backdrop = 0;
  selectedUnit: number | null = null;
  selectedCity: number | null = null;
  focusTile: { x: number; y: number } | null = null;
  preferTile = false;
  reach = new Set<string>();
  profileId: FactionId = 'helm';
  profileReturn: Screen = 'menu';
  customizeOpen = false;
  diplomacyFocus: FactionId | null = null;
  pending: { mode: 'new' | 'exit' } | null = null;
  thinking = false;
  treeCam = { x: 16, y: 12, zoom: 0.38 };
  treeSelected: string | null = null;
  treeNotice = '';
  treeDidFit = false;
  treeDrag: { x: number; y: number; panX: number; panY: number; pointer: number } | null = null;
  setup = {
    faction: 'helm' as FactionId,
    difficulty: 'normal' as Difficulty,
    allied: false,
    events: false,
    personalities: defaultPersonalities(),
    axes: defaultAxes('helm'),
    seed: 1 + Math.floor(Math.random() * 999983),
    mapSize: 'medium' as MapSizeId,
  };

  constructor(root: HTMLElement) {
    root.innerHTML = '<div id="stage"></div><div id="update-banner"></div><div id="overlay"></div><div id="toast" hidden></div>';
    this.stage = root.querySelector('#stage')!;
    this.overlay = root.querySelector('#overlay')!;
    watchLeaderPortraits(() => this.paintEmblems());
    preloadLeaderPortraits();
    root.addEventListener('click', (event) => this.onClick(event));
    root.addEventListener('change', (event) => this.onChange(event));
    root.addEventListener('input', (event) => this.onInput(event));
    window.addEventListener('keydown', (event) => this.onKey(event));
    root.addEventListener('pointerover', (event) => this.onTreeHover(event));
    root.addEventListener('pointerdown', (event) => this.onTreePointerDown(event));
    window.addEventListener('pointermove', (event) => this.onTreePointerMove(event));
    window.addEventListener('pointerup', (event) => this.onTreePointerUp(event));
    root.addEventListener('wheel', (event) => this.onTreeWheel(event), { passive: false });
    root.addEventListener('pointerdown', (event) => {
      this.audio.unlock();
      const el = event.target instanceof Element ? event.target : null;
      if (el?.closest('[data-action="play-intro"]')) return;
      this.syncSoundscape();
    }, { once: true });
    if (import.meta.env.DEV) {
      window.__proximaDebug = {
        spawnRaider: () => this.spawnRaider(),
        showRecap: () => this.debugRecap(),
        showPortraits: () => this.showPortraitSheet(),
        showUnits: () => this.showUnitSheet(),
        seedDiplomacyOffer: () => this.seedDiplomacyOffer(),
        showDefeat: () => this.debugDefeat(),
        showTrade: () => this.debugTrade(),
        showEvent: (kind?: string) => this.debugEvent(kind),
        showDiplomacy: (faction?: string) => this.debugDiplomacy(faction),
        showTransport: () => this.debugTransport(),
        showMidgame: () => this.debugMidgame(),
        finishTerraform: () => this.debugFinishTerraform(),
        state: () => this.game?.serialize() ?? null,
        tilePoint: (x: number, y: number) => this.map?.clientPoint(x, y) ?? null,
        showUpdateBanner: () => this.previewUpdate(),
        showDownloadConsent: () => this.previewDownloadConsent(),
        showSaveError: () => this.showSaveError('Could not save the game, so Proxima stayed open.', new Error('Save file is unreadable (slot-1.json).')),
      };
    }
    this.render();
    void this.bootUpdates();
  }

  render() {
    this.stopMotion();
    if (this.screen === 'menu') this.renderMenu();
    else if (this.screen === 'intro') this.renderIntro();
    else if (this.screen === 'setup') this.renderSetup();
    else if (this.screen === 'options') this.renderOptions();
    else if (this.screen === 'profile') this.renderProfile();
    else if (this.screen === 'recap') this.renderRecap();
    else this.mountGame();
    this.paintBanner();
    this.syncSoundscape();
  }

  stopMotion() {
    cancelAnimationFrame(this.backdrop);
    this.introPlayer?.destroy();
    this.introPlayer = null;
    if (this.screen !== 'game') {
      this.map?.destroy();
      this.map = null;
      this.gameMounted = false;
    }
  }

  renderRecap() {
    renderSocialRecap(this.stage, this.game, this.setup.faction);
  }

  async onClick(event: MouseEvent) {
    if (this.thinking) return;
    const node = (event.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
    if (!node) return;
    const action = node.dataset.action;
    if (await this.handleUpdateAction(action, node)) return;
    if (action === 'play-intro') {
      this.introIndex = 0;
      this.screen = 'intro';
      this.render();
    } else if (action === 'intro-next') {
      if (this.introIndex >= INTRO_SCENES.length - 1) this.exitIntro();
      else {
        this.introIndex += 1;
        this.render();
      }
    } else if (action === 'intro-skip') this.exitIntro();
    else if (action === 'intro-back') {
      if (this.introIndex > 0) {
        this.introIndex -= 1;
        this.render();
      }
    } else if (action === 'intro-exit') this.exitIntro();
    else if (action === 'new-game') {
      this.customizeOpen = false;
      this.screen = 'setup';
      this.render();
    } else if (action === 'back-menu') {
      this.screen = 'menu';
      this.game = null;
      this.render();
    } else if (action === 'game-options') {
      this.screen = 'options';
      this.render();
    } else if (action === 'menu-audio') this.openAudioPanel();
    else if (action === 'quit') void this.exitDesktop();
    else if (action === 'difficulty') this.setup.difficulty = normalizeDifficulty(node.dataset.difficulty);
    else if (action === 'map-size') {
      const id = node.dataset.mapSize;
      if (id === 'small' || id === 'medium' || id === 'large') this.setup.mapSize = id;
    }
    else if (action === 'pick-faction') {
      this.setup.faction = node.dataset.faction as FactionId;
      this.setup.axes = defaultAxes(this.setup.faction);
      this.render();
    } else if (action === 'open-profile') {
      this.profileId = this.setup.faction;
      this.profileReturn = 'setup';
      this.screen = 'profile';
      this.render();
    } else if (action === 'open-profile-game') {
      this.profileId = this.game?.state.playerFaction ?? 'helm';
      this.profileReturn = 'game';
      this.screen = 'profile';
      this.render();
    } else if (action === 'profile-back') {
      this.screen = this.profileReturn;
      this.render();
    } else if (action === 'reroll-seed') {
      this.setup.seed = 1 + Math.floor(Math.random() * 999983);
      this.render();
    } else if (action === 'toggle-customize') {
      this.customizeOpen = !this.customizeOpen;
      this.render();
    } else if (action === 'setup-axis') {
      const axis = node.dataset.axis as SocialAxis;
      this.setup.axes[axis] = node.dataset.option ?? this.setup.axes[axis];
      this.render();
    } else if (action === 'start-game') this.startGame();
    else if (action === 'continue') await this.runSave(() => this.continueAutosave(), 'Could not load the autosave.');
    else if (action === 'load-game') await this.runSave(() => this.openLoad(false), 'Could not open the save list.');
    else if (action === 'toggle-grid') {
      this.map?.toggleGrid();
      this.refreshGame();
    } else if (action === 'end-turn') await this.endTurn();
    else if (action === 'select-unit') {
      this.selectedUnit = Number(node.dataset.id);
      this.selectedCity = null;
      this.preferTile = false;
      const unit = this.game?.unitById(this.selectedUnit);
      if (unit) this.focusTile = { x: unit.x, y: unit.y };
      this.refreshGame();
    } else if (action === 'select-city') {
      this.selectedCity = Number(node.dataset.id);
      this.selectedUnit = null;
      this.preferTile = false;
      const city = this.game?.state.cities.find((entry) => entry.id === this.selectedCity);
      if (city) this.focusTile = { x: city.x, y: city.y };
      this.refreshGame();
    } else if (action === 'show-tile') {
      const unit = this.selectedUnit != null ? this.game?.unitById(this.selectedUnit) : undefined;
      const city = this.selectedCity != null ? this.game?.state.cities.find((entry) => entry.id === this.selectedCity) : undefined;
      const at = unit ?? city ?? this.focusTile;
      if (at) this.openTile(at.x, at.y);
    } else if (action === 'hide-tile') {
      this.preferTile = false;
      this.refreshGame();
    } else if (action === 'found-city' && this.selectedUnit != null) this.act(() => this.game!.foundCity(this.selectedUnit!), 'found');
    else if (action === 'terraform-open') this.openTerraform();
    else if (action === 'terraform-pick' && this.selectedUnit != null) {
      const project = node.dataset.project as 'farm';
      this.closeOverlay();
      this.act(() => this.game!.startTerraform(this.selectedUnit!, project), 'terraform');
    } else if (action === 'toggle-search' && this.selectedUnit != null) this.act(() => this.game!.toggleSearch(this.selectedUnit!), 'click');
    else if (action === 'attack') {
      const unit = this.selectedUnit != null ? this.game?.unitById(this.selectedUnit) : undefined;
      const foe = unit ? this.adjacentFoe(unit) : undefined;
      if (unit && foe) this.openCombat(unit.id, foe.x, foe.y);
    } else if (action === 'combat-cancel') this.closeOverlay();
    else if (action === 'combat-confirm') {
      const attacker = Number(node.dataset.attacker);
      const x = Number(node.dataset.x);
      const y = Number(node.dataset.y);
      this.closeOverlay();
      this.act(() => this.game!.confirmAttack(attacker, x, y), 'attack');
    } else if (action === 'open-diplomacy') {
      this.diplomacyFocus = null;
      this.openDiplomacy();
    } else if (action === 'diplomacy-return') this.openDiplomacy();
    else if (action === 'diplomacy-back') {
      this.diplomacyFocus = null;
      this.openDiplomacy();
    } else if (action === 'select-diplomat') {
      const id = node.dataset.faction as FactionId | undefined;
      if (id && this.game && id !== this.game.state.playerFaction) {
        if (!this.game.inContact(this.game.state.playerFaction, id)) this.toast('No contact yet.');
        else {
          this.diplomacyFocus = id;
          this.openDiplomacy();
        }
      }
    }
    else if (action === 'open-spies') this.openSpies();
    else if (action === 'open-social') this.openSocial();
    else if (action === 'open-research') this.openTechTree();
    else if (action === 'tech-node' || action === 'tech-research' || action === 'tech-goal') this.pickTech(node.dataset.tech ?? '', action);
    else if (action === 'tree-zoom-in') {
      this.treeCam.zoom = Math.min(1.5, this.treeCam.zoom * 1.12);
      this.applyTreeCam();
    } else if (action === 'tree-zoom-out') {
      this.treeCam.zoom = Math.max(0.22, this.treeCam.zoom / 1.12);
      this.applyTreeCam();
    } else if (action === 'tree-fit') this.fitTree();
    else if (action === 'open-design') this.openDesign();
    else if (action === 'propose') this.act(() => this.game!.propose(node.dataset.target as FactionId, node.dataset.kind as Proposal | 'war'), 'click');
    else if (action === 'accept-offer') this.act(() => this.game!.acceptOffer(Number(node.dataset.id)), 'click');
    else if (action === 'reject-offer') this.act(() => this.game!.rejectOffer(Number(node.dataset.id)), 'click');
    else if (action === 'recruit-spy') this.act(() => this.game!.recruitSpy(), 'click');
    else if (action === 'place-spy') {
      const host = (this.overlay.querySelector(`[data-spy-host="${node.dataset.id}"]`) as HTMLSelectElement | null)?.value as FactionId | undefined;
      if (host) this.act(() => this.game!.placeSpy(Number(node.dataset.id), host), 'click');
    } else if (action === 'steal-tech') this.act(() => this.game!.stealTech(Number(node.dataset.id), node.dataset.tech ?? ''), 'click');
    else if (action === 'sabotage') this.act(() => this.game!.sabotage(Number(node.dataset.id)), 'click');
    else if (action === 'frame') {
      const section = node.closest('section');
      const left = (section?.querySelector('[data-frame="left"]') as HTMLSelectElement | null)?.value as FactionId | undefined;
      const right = (section?.querySelector('[data-frame="right"]') as HTMLSelectElement | null)?.value as FactionId | undefined;
      if (left && right) this.act(() => this.game!.frameJob(Number(node.dataset.id), left, right), 'click');
    } else if (action === 'sweep') this.act(() => this.game!.sweepSpies(), 'click');
    else if (action === 'switch-axis') this.act(() => this.game!.setSocial(node.dataset.axis as SocialAxis, node.dataset.option ?? ''), 'click');
    else if (action === 'research-pick') this.act(() => this.game!.chooseResearch(node.dataset.tech ?? ''), 'click');
    else if (action === 'save-design') this.saveDesign();
    else if (action === 'set-production' && this.game) {
      this.act(() => this.game!.setProduction(Number(node.dataset.city), node.dataset.design ?? ''), 'click');
    } else if (action === 'rush') this.act(() => this.game!.rushBuy(Number(node.dataset.city)), 'click');
    else if (action === 'open-trade') this.openTrade(node.dataset.target as FactionId);
    else if (action === 'send-trade') this.sendTrade(node.dataset.target as FactionId);
    else if (action === 'event-choice') {
      this.act(() => this.game!.chooseEvent(node.dataset.choice ?? ''), 'click');
    }
    else if (action === 'load-unit') this.act(() => this.game!.loadUnit(Number(node.dataset.transport), Number(node.dataset.passenger)), 'click');
    else if (action === 'unload-unit') {
      this.act(() => this.game!.unloadUnit(Number(node.dataset.transport), Number(node.dataset.passenger), Number(node.dataset.x), Number(node.dataset.y)), 'click');
    }
    else if (action === 'close') this.closeOverlay();
    else if (action === 'resume') this.closeOverlay();
    else if (action === 'pause-save') await this.runSave(() => this.openSave('manual'), 'Could not open the save list.');
    else if (action === 'pause-load') await this.runSave(() => this.openLoad(true), 'Could not open the save list.');
    else if (action === 'pause-tutorial' || action === 'tutorial-next' || action === 'tutorial-back') {
      const step = action === 'pause-tutorial' ? 0 : Number(node.dataset.step) + (action === 'tutorial-next' ? 1 : -1);
      this.overlay.innerHTML = renderTutorial(step);
      this.paintEmblems();
    }
    else if (action === 'pause-new') this.askSaveFirst('new');
    else if (action === 'pause-exit') this.askSaveFirst('exit');
    else if (action === 'confirm-cancel') this.closeOverlay();
    else if (action === 'confirm-discard') void this.finishPending(false);
    else if (action === 'confirm-save') await this.runSave(() => this.openSave(this.pending?.mode === 'exit' ? 'then-exit' : 'then-new'), 'Could not open the save list. Proxima stayed open.');
    else if (action === 'save-slot') await this.runSave(() => this.writeSlot(Number(node.dataset.slot), node.dataset.purpose ?? 'manual'), 'Could not save the game. Proxima stayed open.');
    else if (action === 'load-slot') await this.runSave(() => this.readSlot(Number(node.dataset.slot)), 'Could not load that save.');
    else if (action === 'view-recap') {
      this.screen = 'recap';
      this.render();
    }
    if (action === 'difficulty' || action === 'map-size') this.render();
    this.afterActionRefresh(action);
  }

  afterActionRefresh(action: string | undefined) {
    const overlays = ['propose', 'accept-offer', 'reject-offer', 'recruit-spy', 'place-spy', 'steal-tech', 'sabotage', 'frame', 'sweep', 'switch-axis', 'research-pick', 'tech-node', 'tech-research', 'tech-goal', 'save-design', 'rush'];
    if (action && overlays.includes(action) && this.screen === 'game') {
      if (action === 'open-diplomacy' || action.startsWith('propose') || action.includes('offer')) this.openDiplomacy();
      else if (['recruit-spy', 'place-spy', 'steal-tech', 'sabotage', 'frame', 'sweep'].includes(action)) this.openSpies();
      else if (action === 'switch-axis') this.openSocial();
      else if (action === 'research-pick' || action === 'tech-node' || action === 'tech-research' || action === 'tech-goal') this.openTechTree();
      else this.refreshGame();
    }
  }

  onChange(event: Event) {
    if (this.applyAudioSettings(event)) return;
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    if (target.dataset.setting === 'allied') this.setup.allied = (target as HTMLInputElement).checked;
    if (target.dataset.setting === 'events') this.setup.events = (target as HTMLInputElement).checked;
    if (target.dataset.setting === 'autosave' && this.game) {
      this.game.state.autosaveEnabled = (target as HTMLInputElement).checked;
    }
    if (target.dataset.setting === 'updates') {
      this.updateCheck = (target as HTMLInputElement).checked;
      void this.persistUpdateCheck(this.updateCheck);
    }
    if (target.dataset.personality && target.dataset.trait) {
      const id = target.dataset.personality as FactionId;
      const trait = target.dataset.trait as keyof (typeof this.setup.personalities)[FactionId];
      this.setup.personalities[id] = { ...this.setup.personalities[id], [trait]: target.value };
    }
    if (target.dataset.setting === 'production' && this.game) {
      const design = target.value;
      if (design) this.act(() => this.game!.setProduction(Number(target.dataset.city), design), 'click');
    }
    if (target.id === 'design-chassis') this.paintDesignPreview();
  }

  onInput(event: Event) {
    this.applyAudioSettings(event);
  }

  async endTurn() {
    const game = this.game;
    if (!game || this.thinking) return;
    const player = game.state.factions[game.state.playerFaction];
    const researchBefore = { techs: [...player.techs], researching: player.researching };
    const logBefore = snapshotLog(game.state.log);
    const workBefore = snapshotTerraform(game.state.units, game.state.playerFaction);
    this.thinking = true;
    this.showThinking(true);
    try {
      const ended = await game.endTurnWith((state, order) => requestRoundOrders(state, order));
      this.showThinking(false);
      this.audio.play('turn');
      playTerraformProgress(this.audio, workBefore, snapshotTerraform(game.state.units, game.state.playerFaction));
      playLoggedCues(this.audio, logBefore, game.state.log, game.state.playerFaction);
      this.toast(ended.message);
      this.refreshGame();
      if (ended.autosave) {
        // Let the new week paint before the save is serialized, so end turn does not hitch first.
        // The worker result is already on the board, so the rotating autosave stores that week.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        });
        await this.runSave(() => this.writeAutosave(), 'Autosave failed. Your game is still running.');
      }
      this.maybePromptResearch(researchBefore);
    } finally {
      this.thinking = false;
      this.showThinking(false);
    }
  }

  act(fn: () => { ok: boolean; message: string }, sound: 'click' | 'found' | 'terraform' | 'attack') {
    const logBefore = snapshotLog(this.game?.state.log ?? []);
    const result = fn();
    this.audio.play(result.ok ? sound : 'error');
    playLoggedCues(this.audio, logBefore, this.game?.state.log ?? [], this.game?.state.playerFaction ?? '');
    this.toast(result.message);
    if (this.screen === 'game') this.refreshGame();
    return result;
  }

  onKey(event: KeyboardEvent) {
    if (this.thinking) return;
    if (event.key === 'Escape') {
      if (this.screen === 'game') {
        if (this.game?.state.winner || this.game?.state.playerDefeated) return;
        if (this.game?.state.events.prompt && this.overlay.querySelector('[data-testid="event-popup"]')) return;
        if (this.overlay.innerHTML) this.closeOverlay();
        else this.openPause();
      } else if (this.overlay.querySelector('[data-testid="audio-panel"]')) this.closeOverlay();
      return;
    }
    const tag = event.target instanceof HTMLElement ? event.target.tagName : '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (this.screen !== 'game' || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.toLowerCase() === 't') {
      event.preventDefault();
      if (this.overlay.querySelector('[data-testid="tech-tree"]')) this.closeOverlay();
      else if (!this.overlay.innerHTML) this.openTechTree();
      return;
    }
    if (event.key.toLowerCase() === 'i' && this.map?.hover && !this.overlay.innerHTML) {
      event.preventDefault();
      this.openTile(this.map.hover.x, this.map.hover.y);
      return;
    }
    if (event.key.toLowerCase() !== 'm') return;
    event.preventDefault();
    this.audio.toggleMuted();
    this.syncSoundscape();
    this.syncMuteControls();
    this.toast(this.audio.muted ? 'Muted.' : 'Sound restored.');
  }

  /** Menu theme, intro cue, or the exploration playlist. The ambient bed plays only in a game. */
  syncSoundscape() {
    if (this.screen === 'game') this.audio.startAmbient();
    else this.audio.stopAmbient();
    const scene = this.screen === 'intro' ? 'intro' : this.screen === 'game' ? 'game' : 'menu';
    this.audio.setScene(scene);
  }

  syncMuteControls() {
    this.overlay.querySelectorAll<HTMLInputElement>('[data-setting="mute"]').forEach((box) => {
      box.checked = this.audio.muted;
    });
  }

  applyAudioSettings(event: Event): boolean {
    if (!handleAudioSettings(this.audio, event)) return false;
    this.syncSoundscape();
    return true;
  }

  closeOverlay() {
    if (this.overlay.querySelector('[data-testid="tech-tree"]')) this.treeNotice = '';
    this.overlay.innerHTML = '';
    this.treeDrag = null;
  }

  toast(message: string) {
    const node = document.querySelector('#toast') as HTMLElement | null;
    if (!node) return;
    node.hidden = false;
    node.textContent = message;
    window.setTimeout(() => {
      node.hidden = true;
    }, 2200);
  }

  renderMenu() {
    return renderMenuScreen.call(this);
  }
  renderIntro() {
    return renderIntroScreen.call(this);
  }
  exitIntro() {
    return exitIntroScreen.call(this);
  }

  renderSetup() {
    return renderSetupScreen.call(this);
  }
  renderProfile() {
    return renderProfileScreen.call(this);
  }
  startGame() {
    return startGameScreen.call(this);
  }
  customizePanel() {
    return customizePanelScreen.call(this);
  }
  factionButton(id: FactionId) {
    return factionButtonScreen.call(this, id);
  }

  renderOptions() {
    return renderOptionsScreen.call(this);
  }
  openPause() {
    return openPauseScreen.call(this);
  }
  openAudioPanel() {
    return openAudioPanelScreen.call(this);
  }
  askSaveFirst(mode: 'new' | 'exit') {
    return askSaveFirstScreen.call(this, mode);
  }

  mountGame() {
    return mountGameScreen.call(this);
  }
  showThinking(on: boolean) {
    return showThinkingScreen.call(this, on);
  }
  refreshGame() {
    return refreshGameScreen.call(this);
  }
  unitIcon(unit: Unit, large = false): string {
    return unitIconScreen.call(this, unit, large);
  }
  inspector(): string {
    return inspectorScreen.call(this);
  }
  tilePanel(): string {
    return tilePanelScreen.call(this);
  }
  openTile(x: number, y: number) {
    return openTileScreen.call(this, x, y);
  }
  onTile(x: number, y: number, mods: { shift: boolean; alt: boolean } = { shift: false, alt: false }) {
    return onTileScreen.call(this, x, y, mods);
  }
  openCombat(attackerId: number, x: number, y: number) {
    return openCombatScreen.call(this, attackerId, x, y);
  }
  openTerraform() {
    return openTerraformScreen.call(this);
  }
  adjacentFoe(unit: Unit): { x: number; y: number; name: string } | null {
    return adjacentFoeScreen.call(this, unit);
  }
  openVictory() {
    return openVictoryScreen.call(this);
  }
  openDefeat() {
    return openDefeatScreen.call(this);
  }
  openEvent() {
    return openEventScreen.call(this);
  }

  openDiplomacy() {
    return openDiplomacyScreen.call(this);
  }
  openSpies() {
    return openSpiesScreen.call(this);
  }
  openSocial() {
    return openSocialScreen.call(this);
  }
  openTrade(target: FactionId) {
    return openTradeScreen.call(this, target);
  }
  sendTrade(target: FactionId) {
    return sendTradeScreen.call(this, target);
  }

  pickTech(id: string, action: string) {
    return pickTechScreen.call(this, id, action);
  }
  openTechTree() {
    return openTechTreeScreen.call(this);
  }
  applyTreeCam() {
    return applyTreeCamScreen.call(this);
  }
  fitTree() {
    return fitTreeScreen.call(this);
  }
  onTreeHover(event: Event) {
    return onTreeHoverScreen.call(this, event);
  }
  onTreePointerDown(event: PointerEvent) {
    return onTreePointerDownScreen.call(this, event);
  }
  onTreePointerMove(event: PointerEvent) {
    return onTreePointerMoveScreen.call(this, event);
  }
  onTreePointerUp(event: PointerEvent) {
    return onTreePointerUpScreen.call(this, event);
  }
  onTreeWheel(event: WheelEvent) {
    return onTreeWheelScreen.call(this, event);
  }
  maybePromptResearch(before: { techs: string[]; researching: string | null }) {
    return maybePromptResearchScreen.call(this, before);
  }
  openDesign() {
    return openDesignScreen.call(this);
  }
  paintDesignPreview() {
    return paintDesignPreviewScreen.call(this);
  }
  saveDesign() {
    return saveDesignScreen.call(this);
  }

  async openSave(purpose: string) {
    return openSaveScreen.call(this, purpose);
  }
  async openLoad(_fromGame: boolean) {
    return openLoadScreen.call(this, _fromGame);
  }
  async writeSlot(slot: number, purpose: string) {
    return writeSlotScreen.call(this, slot, purpose);
  }
  async readSlot(slot: number) {
    return readSlotScreen.call(this, slot);
  }
  async finishPending(saved: boolean) {
    return finishPendingScreen.call(this, saved);
  }
  async exitDesktop() {
    return exitDesktopScreen.call(this);
  }
  envelope(slot: number): SaveEnvelope {
    return envelopeScreen.call(this, slot);
  }
  async runSave(work: () => Promise<void>, fallback: string) {
    return runSaveScreen.call(this, work, fallback);
  }
  showSaveError(message: string, error?: unknown) {
    return showSaveErrorScreen.call(this, message, error);
  }
  writeAutosave() {
    return writeAutosaveScreen.call(this);
  }
  continueAutosave() {
    return continueAutosaveScreen.call(this);
  }

  debugDefeat() {
    return debugDefeatScreen.call(this);
  }
  debugTrade() {
    return debugTradeScreen.call(this);
  }
  debugEvent(kind?: string) {
    return debugEventScreen.call(this, kind);
  }
  debugTransport() {
    return debugTransportScreen.call(this);
  }
  debugFinishTerraform(): { x: number; y: number } | null {
    return debugFinishTerraformScreen.call(this);
  }
  debugMidgame() {
    return debugMidgameScreen.call(this);
  }
  showPortraitSheet() {
    return showPortraitSheetScreen.call(this);
  }
  showUnitSheet() {
    return showUnitSheetScreen.call(this);
  }
  debugDiplomacy(faction?: string) {
    return debugDiplomacyScreen.call(this, faction);
  }
  seedDiplomacyOffer() {
    return seedDiplomacyOfferScreen.call(this);
  }
  spawnRaider(): { x: number; y: number; name: string } | null {
    return spawnRaiderScreen.call(this);
  }
  debugRecap() {
    return debugRecapScreen.call(this);
  }

  paintBanner() {
    return paintBannerScreen.call(this);
  }
  async bootUpdates() {
    return bootUpdatesScreen.call(this);
  }
  async persistUpdateCheck(enabled: boolean) {
    return persistUpdateCheckScreen.call(this, enabled);
  }
  async pollUpdates() {
    return pollUpdatesScreen.call(this);
  }
  async handleUpdateAction(action: string | undefined, node: HTMLElement) {
    return handleUpdateActionScreen.call(this, action, node);
  }
  async answerUpdatePrompt(enable: boolean) {
    return answerUpdatePromptScreen.call(this, enable);
  }
  async openDownloadConsent() {
    return openDownloadConsentScreen.call(this);
  }
  async runDownload() {
    return runDownloadScreen.call(this);
  }
  previewUpdate() {
    return previewUpdateScreen.call(this);
  }
  previewDownloadConsent() {
    return previewDownloadConsentScreen.call(this);
  }

  paintEmblems() {
    return paintEmblemsScreen.call(this);
  }
  paintMarks(root: ParentNode) {
    return paintMarksScreen.call(this, root);
  }

}

export type { DiplomacyFactionRow, DiplomacyFocus, DiplomacyMarkup } from './screens/diplomacy';
export { diplomacyMarkup } from './screens/diplomacy';
