import type { Settings } from '../../engine';
export type Sound = 'place' | 'pickup' | 'rotate' | 'win' | 'click' | 'select' | 'close' | 'page' | 'confirm' | 'success' | 'error';
// Bundled Camp Evening recording; interaction effects are synthesized locally.
const musicUrl = new URL('../../assets/audio/camp-evening.mp3', import.meta.url).href;
const musicGap = 3;
export class WildernessAudio {
  private ctx?: AudioContext;
  private music?: GainNode;
  private effects?: GainNode;
  private musicBuffer?: AudioBuffer;
  private musicSource?: AudioBufferSourceNode;
  private musicLoading?: Promise<void>;
  private musicOffset = 0;
  private musicStartedAt = 0;
  private effectTimes: number[] = [];
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
      // Finish a mute before suspending the clock, rather than freezing its fade.
      this.setSettings(this.settings);
    }
    void this.syncContext();
  };
  private settings: Settings = { music: .35, effects: .65, muted: false, facilityTips: true, continuousPlacement: true, facilityNames: false, ruleDisplay: true };
  setSettings(settings: Settings) {
    this.settings = { ...settings };
    if (this.ctx && this.music && this.effects) {
      const music = settings.muted ? 0 : settings.music * .3;
      const effects = settings.muted ? 0 : settings.effects * .35;
      this.setGain(this.music.gain, music);
      this.setGain(this.effects.gain, effects);
      if (!music) this.stopMusic();
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
  private stopMusic() {
    const source = this.musicSource;
    if (!source || !this.ctx) return;
    this.musicOffset += this.ctx.currentTime - this.musicStartedAt;
    if (this.musicOffset >= this.musicBuffer!.duration) this.musicOffset = -musicGap;
    this.musicSource = undefined;
    source.onended = () => source.disconnect();
    source.stop(this.ctx.currentTime + (this.ctx.state === 'running' && !document.hidden ? .015 : 0));
  }
  private loadMusic() {
    if (this.musicLoading) return this.musicLoading;
    const ctx = this.ctx!;
    const loading: Promise<void> = fetch(musicUrl).then(async response => {
      if (!response.ok) throw new Error('BGM unavailable');
      const bytes = await response.arrayBuffer();
      if (this.ctx !== ctx) return;
      const buffer = await ctx.decodeAudioData(bytes);
      if (this.ctx !== ctx) return;
      this.musicBuffer = buffer;
      this.syncMusic();
    }).catch(() => { /* A later user gesture can retry loading the local recording. */ }).finally(() => {
      if (this.musicLoading === loading) this.musicLoading = undefined;
    });
    this.musicLoading = loading;
    return loading;
  }
  private syncMusic() {
    if (!this.ctx || !this.music || document.hidden || this.ctx.state !== 'running' || this.settings.muted || !this.settings.music || this.musicSource) return;
    if (!this.musicBuffer) { void this.loadMusic(); return; }
    const source = this.ctx.createBufferSource();
    source.buffer = this.musicBuffer;
    source.connect(this.music);
    this.musicSource = source;
    this.musicStartedAt = this.ctx.currentTime;
    source.onended = () => {
      source.disconnect();
      if (this.musicSource !== source) return;
      this.musicSource = undefined;
      this.musicOffset = -musicGap;
      this.syncMusic();
    };
    // A negative offset is the silence still owed before the next play.
    source.start(this.musicStartedAt + Math.max(0, -this.musicOffset), Math.max(0, this.musicOffset));
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
        this.setSettings(this.settings);
        document.addEventListener('visibilitychange', this.onVisibility);
      }
      if (document.hidden) return;
      await this.syncContext();
    } catch { /* Browsers without Web Audio can still play the game. */ }
  }
  private note(midi: number, time: number, duration: number, gain: number, bus: GainNode) {
    if (!this.ctx) return;
    const oscillator = this.ctx.createOscillator(), envelope = this.ctx.createGain();
    oscillator.type = 'sine'; oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(gain, time + .012);
    envelope.gain.exponentialRampToValueAtTime(.001, time + duration);
    oscillator.connect(envelope); envelope.connect(bus);
    const voices = this.effectVoices;
    voices.add(oscillator);
    oscillator.start(time); oscillator.stop(time + duration + .03);
    oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); envelope.disconnect(); };
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
    this.stopMusic(); document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.ctx) { this.stopVoices(this.effectVoices); void this.ctx.close(); }
    this.ctx = undefined; this.music = undefined; this.effects = undefined; this.paper = undefined;
    this.musicBuffer = undefined; this.musicLoading = undefined; this.musicOffset = 0;
    this.lastUiSound = undefined; this.lastUiEffect = -Infinity; this.effectTimes = [];
  }
}
export const audio = new WildernessAudio();
