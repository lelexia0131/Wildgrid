import type { Settings } from '../engine';
export type Sound = 'place' | 'pickup' | 'rotate' | 'win' | 'click' | 'select' | 'close' | 'page' | 'confirm' | 'success' | 'error';
// Original pentatonic melody and chord progression, synthesized locally.
// No recordings, samples, network requests, or third-party audio assets.
export class WildernessAudio {
  private ctx?: AudioContext;
  private music?: GainNode;
  private effects?: GainNode;
  private timer?: number;
  private step = 0;
  private next = 0;
  private scene: 'menu' | 'game' = 'menu';
  private effectTimes: number[] = [];
  private musicVoices = new Set<OscillatorNode>();
  private effectVoices = new Set<AudioScheduledSourceNode>();
  private paper?: AudioBuffer;
  private lastUiSound?: Sound;
  private lastUiEffect = -Infinity;
  private feedbackVersion = 0;
  private syncing?: Promise<void>;
  private visibilityVersion = 0;
  private onVisibility = () => {
    if (!this.ctx) return;
    this.visibilityVersion++;
    if (document.hidden) {
      this.stopTimer();
      // Finish a mute before suspending the clock, rather than freezing its fade.
      this.setSettings(this.settings);
    }
    void this.syncContext();
  };
  private settings: Settings = { music: .35, effects: .65, muted: false, facilityTips: true, continuousPlacement: true, facilityNames: false, ruleDisplay: true };
  // Original 352-step theme plus a 32-step F–G bridge back into C.
  // 130.56 seconds in-game, 145.92 seconds in the menu.
  private melody = [
    // Original theme.
    72,0,76,79,0,76,74,0, 72,0,67,0,69,72,0,0,
    69,0,72,76,0,74,72,0, 67,0,64,0,67,69,0,0,
    72,0,76,79,81,0,79,76, 74,0,72,0,69,67,0,0,
    69,72,0,74,76,0,72,0, 67,0,69,0,72,0,0,0,
    // Theme variation.
    72,0,76,0,79,76,74,0, 76,0,72,0,67,69,72,0,
    69,0,72,0,76,79,76,0, 74,72,0,69,67,0,69,0,
    72,0,74,76,79,0,81,0, 79,76,0,74,72,69,0,0,
    67,0,69,72,74,0,76,0, 74,72,0,69,67,0,0,0,
    // Higher development and response.
    79,0,76,79,84,0,81,79, 76,0,74,0,72,76,0,0,
    81,0,79,76,72,0,76,0, 79,0,76,74,72,69,0,0,
    79,0,81,84,81,0,79,0, 76,79,0,76,74,72,0,0,
    74,0,79,0,81,79,76,0, 74,72,0,69,67,0,0,0,
    76,0,79,0,84,79,76,0, 72,0,74,76,79,0,76,0,
    72,0,76,79,81,0,79,76, 72,0,69,0,67,69,0,0,
    69,0,72,76,79,0,76,0, 74,0,72,69,67,0,69,0,
    67,0,72,74,76,0,74,72, 69,0,67,0,69,72,0,0,
    // Reprise.
    72,0,76,79,0,76,74,0, 72,0,76,0,79,76,0,0,
    69,0,72,76,0,74,72,0, 69,0,67,0,64,67,69,0,
    72,0,76,79,81,0,79,76, 74,0,72,0,76,74,69,0,
    69,72,0,74,76,0,79,0, 76,74,0,72,69,67,0,0,
    // Quiet return to the opening.
    76,0,72,0,79,0,76,0, 74,0,72,0,67,69,0,0,
    69,0,72,0,76,0,72,0, 69,0,67,0,72,0,0,0,
    // Keep the original theme intact; carry the final G into the opening C.
    69,0,72,0,69,0,72,0, 69,0,72,0,69,0,0,0,
    67,0,74,0,79,0,74,0, 67,0,74,0,67,0,0,0,
  ];
  setScene(scene: 'menu' | 'game') { this.scene = scene; }
  setSettings(settings: Settings) {
    this.settings = { ...settings };
    if (this.ctx && this.music && this.effects) {
      const music = settings.muted ? 0 : settings.music * .3;
      const effects = settings.muted ? 0 : settings.effects * .35;
      this.setGain(this.music.gain, music);
      this.setGain(this.effects.gain, effects);
      if (!music) {
        this.stopTimer();
        this.stopVoices(this.musicVoices);
        this.next = this.ctx.currentTime + .08;
      }
      if (!effects) { this.stopVoices(this.effectVoices); this.effectTimes = []; }
      this.syncMusic();
    }
  }
  private setGain(gain: AudioParam, value: number) {
    const now = this.ctx!.currentTime;
    if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(now);
    else {
      const current = gain.value;
      gain.cancelScheduledValues(now);
      gain.setValueAtTime(current, now);
    }
    if (this.ctx!.state === 'running' && !document.hidden) gain.linearRampToValueAtTime(value, now + (value ? .04 : .015));
    else gain.setValueAtTime(value, now);
  }
  private stopVoices(voices: Set<AudioScheduledSourceNode>) {
    const end = this.ctx!.currentTime + (this.ctx!.state === 'running' && !document.hidden ? .015 : 0);
    for (const voice of voices) voice.stop(end);
    voices.clear();
  }
  private stopTimer() {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }
  private syncMusic() {
    if (!this.ctx || document.hidden || this.ctx.state !== 'running' || this.settings.muted || !this.settings.music) {
      this.stopTimer(); return;
    }
    if (this.timer === undefined) {
      this.next = Math.max(this.next, this.ctx.currentTime + .08);
      this.timer = window.setInterval(() => this.schedule(), 100);
    }
    this.schedule();
  }
  private syncContext() {
    if (this.syncing) return this.syncing;
    const ctx = this.ctx!;
    let visibilityVersion = this.visibilityVersion;
    this.syncing = (async () => {
      // Coalesce starts and reconcile the latest visibility after each async transition.
      while (this.ctx === ctx && ctx.state !== 'closed') {
        visibilityVersion = this.visibilityVersion;
        const hidden = document.hidden;
        if (hidden) { if (ctx.state !== 'suspended') await ctx.suspend(); }
        else if (ctx.state !== 'running') await ctx.resume();
        if (hidden !== document.hidden) continue;
        this.syncMusic();
        break;
      }
    })().catch(() => { /* A later user gesture can retry browser audio unlock. */ }).finally(() => {
      this.syncing = undefined;
      if (this.ctx === ctx && visibilityVersion !== this.visibilityVersion) return this.syncContext();
    });
    return this.syncing;
  }
  async start() {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.music = this.ctx.createGain(); this.music.connect(this.ctx.destination);
        this.effects = this.ctx.createGain(); this.effects.connect(this.ctx.destination);
        this.music.gain.setValueAtTime(0, this.ctx.currentTime);
        this.effects.gain.setValueAtTime(0, this.ctx.currentTime);
        this.next = this.ctx.currentTime + .08;
        this.setSettings(this.settings);
        document.addEventListener('visibilitychange', this.onVisibility);
      }
      if (document.hidden) return;
      await this.syncContext();
    } catch { /* Browsers without Web Audio can still play the game. */ }
  }
  private note(midi: number, time: number, duration: number, gain: number, bus: GainNode, type: OscillatorType = 'sine') {
    if (!this.ctx) return;
    const oscillator = this.ctx.createOscillator(), envelope = this.ctx.createGain();
    oscillator.type = type; oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(gain, time + .012);
    envelope.gain.exponentialRampToValueAtTime(.001, time + duration);
    oscillator.connect(envelope); envelope.connect(bus);
    const voices = bus === this.music ? this.musicVoices : this.effectVoices;
    voices.add(oscillator);
    oscillator.start(time); oscillator.stop(time + duration + .03);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
  }
  private schedule() {
    if (!this.ctx || !this.music || this.ctx.state !== 'running' || document.hidden || this.settings.muted || !this.settings.music) return;
    const beat = this.scene === 'menu' ? .38 : .34;
    if (this.next < this.ctx.currentTime) this.next = this.ctx.currentTime + .03;
    while (this.next < this.ctx.currentTime + .22) {
      const melody = this.melody[this.step % this.melody.length];
      if (melody) this.note(melody, this.next, 1.4, .25, this.music);
      const root = [48, 45, 41, 43][Math.floor(this.step / 16) % 4];
      const arpeggio = this.step === this.melody.length - 4 ? 12 : [12,19,24,19][Math.floor(this.step / 4) % 4];
      if (this.step % 4 === 0) this.note(root + arpeggio, this.next, 1.8, .13, this.music, 'triangle');
      if (this.step % 16 === 0) {
        this.note(root, this.next, 4, .2, this.music);
        this.note(root + 7, this.next + .04, 3.8, .08, this.music);
      }
      this.step = (this.step + 1) % this.melody.length; this.next += beat;
    }
  }
  private turnPage(time: number, gain: number) {
    const ctx = this.ctx!;
    if (!this.paper) {
      this.paper = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .14), ctx.sampleRate);
      const data = this.paper.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain();
    source.buffer = this.paper;
    filter.type = 'bandpass'; filter.Q.value = .7;
    filter.frequency.setValueAtTime(1800, time);
    filter.frequency.exponentialRampToValueAtTime(700, time + .14);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(gain, time + .018);
    envelope.gain.exponentialRampToValueAtTime(.001, time + .14);
    source.connect(filter); filter.connect(envelope); envelope.connect(this.effects!);
    this.effectVoices.add(source);
    source.start(time); source.stop(time + .14);
    source.onended = () => { this.effectVoices.delete(source); source.disconnect(); filter.disconnect(); envelope.disconnect(); };
  }
  play(sound: Sound) {
    if (!this.ctx || !this.effects || this.ctx.state !== 'running' || document.hidden || this.settings.muted || !this.settings.effects) return;
    try {
      const now = this.ctx.currentTime;
      if (!['place', 'pickup', 'rotate', 'win', 'page'].includes(sound)) {
        if (this.lastUiSound === sound && now - this.lastUiEffect < .035) return;
        this.lastUiSound = sound; this.lastUiEffect = now;
      }
      this.effectTimes = this.effectTimes.filter(time => now - time < .22);
      this.effectTimes.push(now);
      const gain = (sound === 'error' ? .14 : sound === 'close' || sound === 'page' ? .2 : .32) / Math.sqrt(this.effectTimes.length);
      if (sound === 'page') { this.turnPage(now, gain); return; }
      const notes: Record<Exclude<Sound, 'page'>, number[]> = { place: [79,84], pickup: [79,72], rotate: [76,81], win: [72,76,79,84,88], click: [76], select: [81], close: [74,67], confirm: [76,84], success: [79,84,88], error: [55,53] };
      notes[sound].forEach((note, i) => this.note(note, now + i * (sound === 'win' ? .14 : .045), sound === 'win' ? .75 : sound === 'close' ? .1 : sound === 'success' ? .24 : .18, gain, this.effects!));
    } catch { /* Audio feedback must never interrupt an interaction. */ }
  }
  feedback(sound: Sound = 'click') {
    const version = ++this.feedbackVersion;
    if (document.hidden || this.settings.muted || !this.settings.effects) return;
    if (this.ctx?.state === 'running') { this.play(sound); return; }
    const requested = performance.now();
    void this.start().then(() => {
      if (version === this.feedbackVersion && performance.now() - requested < 250) this.play(sound);
    }).catch(() => { /* A failed browser audio unlock must not block the control. */ });
  }
  dispose() {
    this.feedbackVersion++;
    this.stopTimer(); document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.ctx) { this.stopVoices(this.musicVoices); this.stopVoices(this.effectVoices); void this.ctx.close(); }
    this.ctx = undefined; this.music = undefined; this.effects = undefined; this.paper = undefined;
    this.lastUiSound = undefined; this.lastUiEffect = -Infinity; this.effectTimes = [];
  }
}
export const audio = new WildernessAudio();
