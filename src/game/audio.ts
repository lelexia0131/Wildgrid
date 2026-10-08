import type { Settings } from './types';
type Sound = 'place' | 'pickup' | 'rotate' | 'win' | 'click' | 'select' | 'error';
// Original pentatonic melody and chord progression, synthesized locally.
// No recordings, samples, network requests, or third-party audio assets.
class WildernessAudio {
  private ctx?: AudioContext;
  private music?: GainNode;
  private effects?: GainNode;
  private timer?: number;
  private step = 0;
  private next = 0;
  private scene: 'menu' | 'game' = 'menu';
  private settings: Settings = { music: .35, effects: .65, muted: false, facilityTips: true, continuousPlacement: true };
  private melody = [72,0,76,79,0,76,74,0, 72,0,67,0,69,72,0,0, 69,0,72,76,0,74,72,0, 67,0,64,0,67,69,0,0, 72,0,76,79,81,0,79,76, 74,0,72,0,69,67,0,0, 69,72,0,74,76,0,72,0, 67,0,69,0,72,0,0,0];
  setScene(scene: 'menu' | 'game') { this.scene = scene; }
  setSettings(settings: Settings) {
    this.settings = settings;
    if (this.ctx && this.music && this.effects) {
      this.music.gain.setTargetAtTime(settings.muted ? 0 : settings.music * .3, this.ctx.currentTime, .08);
      this.effects.gain.setTargetAtTime(settings.muted ? 0 : settings.effects * .35, this.ctx.currentTime, .03);
    }
  }
  async start() {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.music = this.ctx.createGain(); this.music.connect(this.ctx.destination);
        this.effects = this.ctx.createGain(); this.effects.connect(this.ctx.destination);
        this.setSettings(this.settings);
        this.next = this.ctx.currentTime + .08;
        this.timer = window.setInterval(() => this.schedule(), 100);
        document.addEventListener('visibilitychange', () => {
          if (!this.ctx) return;
          if (document.hidden) void this.ctx.suspend();
          else { this.next = this.ctx.currentTime + .1; void this.ctx.resume().catch(() => {}); }
        });
      }
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      this.schedule();
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
    oscillator.start(time); oscillator.stop(time + duration + .03);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  private schedule() {
    if (!this.ctx || !this.music || this.ctx.state !== 'running') return;
    const beat = this.scene === 'menu' ? .38 : .34;
    if (this.next < this.ctx.currentTime) this.next = this.ctx.currentTime + .03;
    while (this.next < this.ctx.currentTime + .22) {
      const melody = this.melody[this.step % this.melody.length];
      if (melody) this.note(melody, this.next, 1.4, .25, this.music);
      const root = [48, 45, 41, 43][Math.floor(this.step / 16) % 4];
      if (this.step % 4 === 0) this.note(root + [12,19,24,19][Math.floor(this.step / 4) % 4], this.next, 1.8, .13, this.music, 'triangle');
      if (this.step % 16 === 0) {
        this.note(root, this.next, 4, .2, this.music);
        this.note(root + 7, this.next + .04, 3.8, .08, this.music);
      }
      this.step++; this.next += beat;
    }
  }
  play(sound: Sound) {
    if (!this.ctx || !this.effects || this.ctx.state !== 'running') return;
    const notes: Record<Sound, number[]> = { place: [79,84], pickup: [79,72], rotate: [76,81], win: [72,76,79,84,88], click: [76], select: [81], error: [55,53] };
    notes[sound].forEach((note, i) => this.note(note, this.ctx!.currentTime + i * (sound === 'win' ? .14 : .045), sound === 'win' ? .9 : .18, sound === 'error' ? .14 : .32, this.effects!));
  }
  dispose() { if (this.timer) clearInterval(this.timer); void this.ctx?.close(); }
}
export const audio = new WildernessAudio();
