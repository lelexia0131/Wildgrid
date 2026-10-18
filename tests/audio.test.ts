import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WildernessAudio } from '../src/game/audio';
import type { Settings } from '../src/engine';
import { readSave, writeSave } from '../src/game/storage';

type Voice = { midi: number; start: number; end: number; type: string; bus: number; release: number; gain: number };
type GainEvent = { bus: number; method: string; value: number; time: number };
type Probe = { events: GainEvent[]; timers: Set<number>; contexts: () => number; buffers: () => number; defer: (operation: 'resume' | 'suspend') => () => void };
const settings: Settings = { music: .35, effects: .65, muted: false, facilityTips: true, continuousPlacement: true, facilityNames: false, ruleDisplay: true };

async function withAudio(scene: 'menu' | 'game', check: (voices: Voice[], advance: (time: number) => void, visibility: (hidden: boolean) => Promise<void>, audio: WildernessAudio, probe: Probe) => void | Promise<void>, initialSettings = settings) {
  const voices: Voice[] = [];
  const events: GainEvent[] = [], timers = new Set<number>();
  let tick = () => {}, visibilityChange = () => {}, bus = 0, timerId = 0, contexts = 0, buffers = 0;
  let resumeGate: Promise<void> | undefined, suspendGate: Promise<void> | undefined;
  const documentStub = { hidden: false, addEventListener: (_name: string, callback: () => void) => { visibilityChange = callback; }, removeEventListener: () => {} };
  class Context {
    currentTime = 0;
    sampleRate = 8000;
    state = 'running';
    destination = {};
    createGain() {
      const record = (method: string, value: number, time: number) => { events.push({ bus: node.bus, method, value, time }); node.gain.value = value; };
      const node = { bus: bus++, target: -1, release: 0, peak: 0, gain: {
        value: 0,
        cancelAndHoldAtTime: (time: number) => record('hold', node.gain.value, time),
        cancelScheduledValues: (time: number) => record('cancel', node.gain.value, time),
        setValueAtTime: (value: number, time: number) => record('set', value, time),
        linearRampToValueAtTime: (value: number, time: number) => { record('ramp', value, time); node.release = value; node.peak = Math.max(node.peak, value); },
        exponentialRampToValueAtTime: (value: number) => { node.release = value; }, setTargetAtTime: () => {},
      }, connect: (target: { bus: number }) => { node.target = target.bus; }, disconnect: () => {} };
      return node;
    }
    createOscillator() {
      let envelope: ReturnType<Context['createGain']>;
      const voice: Voice = { midi: 0, start: 0, end: 0, type: '', bus: -1, release: 0, gain: 0 };
      const oscillator = { type: 'sine', frequency: { value: 0 }, onended: () => {},
        connect: (node: typeof envelope) => { envelope = node; }, disconnect: () => {},
        start: (time: number) => {
          Object.assign(voice, { midi: Math.round(69 + 12 * Math.log2(oscillator.frequency.value / 440)), start: time, type: oscillator.type, bus: envelope.target, release: envelope.release, gain: envelope.peak });
          voices.push(voice);
        }, stop: (time: number) => { voice.end = time; },
      };
      return oscillator;
    }
    createBuffer(_channels: number, length: number) {
      buffers++;
      const data = new Float32Array(length);
      return { getChannelData: () => data };
    }
    createBiquadFilter() {
      const filter = { type: '', Q: { value: 0 }, frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, target: undefined as ReturnType<Context['createGain']> | undefined,
        connect: (node: ReturnType<Context['createGain']>) => { filter.target = node; }, disconnect: () => {},
      };
      return filter;
    }
    createBufferSource() {
      let filter: ReturnType<Context['createBiquadFilter']>;
      const voice: Voice = { midi: 0, start: 0, end: 0, type: 'paper', bus: -1, release: 0, gain: 0 };
      return { buffer: undefined, onended: () => {}, connect: (node: typeof filter) => { filter = node; }, disconnect: () => {},
        start: (time: number) => { Object.assign(voice, { start: time, bus: filter.target!.target, release: filter.target!.release, gain: filter.target!.peak }); voices.push(voice); },
        stop: (time: number) => { voice.end = time; },
      };
    }
    async resume() { if (resumeGate) await resumeGate; this.state = 'running'; }
    async suspend() { if (suspendGate) await suspendGate; this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
  }
  const context = new Context();
  const replacements = { AudioContext: function () { contexts++; return context; }, window: { setInterval: (callback: () => void) => { tick = callback; timers.add(++timerId); return timerId; } }, document: documentStub, clearInterval: (id: number) => timers.delete(id) };
  const originals = Object.entries(replacements).map(([key, value]) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    return { key, descriptor };
  });
  const audio = new WildernessAudio();
  try {
    audio.setScene(scene);
    audio.setSettings(initialSettings);
    await audio.start();
    await check(voices, time => { context.currentTime = time; tick(); }, async hidden => {
      documentStub.hidden = hidden; visibilityChange(); await new Promise<void>(resolve => setImmediate(resolve));
    }, audio, { events, timers, contexts: () => contexts, buffers: () => buffers, defer: operation => {
      if (operation === 'resume') context.state = 'suspended';
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      if (operation === 'resume') resumeGate = gate; else suspendGate = gate;
      return release;
    } });
  } finally {
    audio.dispose();
    for (const { key, descriptor } of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

for (const scene of ['menu', 'game'] as const) {
  const beat = scene === 'menu' ? .38 : .34;
  const opening = .08, cycle = 384 * beat;
  test(`${scene} BGM preserves the original opening melody, accompaniment and legato`, async () => {
    const original = [
      72,0,76,79,0,76,74,0, 72,0,67,0,69,72,0,0,
      69,0,72,76,0,74,72,0, 67,0,64,0,67,69,0,0,
      72,0,76,79,81,0,79,76, 74,0,72,0,69,67,0,0,
      69,72,0,74,76,0,72,0, 67,0,69,0,72,0,0,0,
    ];
    await withAudio(scene, (voices, advance) => {
      for (let time = .1; time < beat * 64; time += .1) advance(time);
      const intro = voices.filter(voice => voice.start < opening + beat * 64 - 1e-6);
      const melody = intro.filter(voice => voice.type === 'sine' && voice.midi >= 64);
      assert.deepEqual(melody.map(voice => [Math.round((voice.start - opening) / beat), voice.midi]), original.flatMap((midi, step) => midi ? [[step, midi]] : []));
      const arpeggios = intro.filter(voice => voice.type === 'triangle');
      assert.deepEqual(arpeggios.map(voice => voice.midi), [60,67,72,67,57,64,69,64,53,60,65,60,55,62,67,62]);
      const bass = intro.filter(voice => voice.type === 'sine' && voice.midi < 60);
      assert.deepEqual(bass.map(voice => voice.midi), [48,55,45,52,41,48,43,50]);
      for (const voice of intro) {
        const duration = voice.type === 'triangle' ? 1.83 : voice.midi >= 64 ? 1.43 : voice.gain === .2 ? 4.03 : 3.83;
        assert.ok(Math.abs(voice.end - voice.start - duration) < 1e-6, 'Keep the original note tails');
        assert.equal(voice.gain, voice.type === 'triangle' ? .13 : voice.midi >= 64 ? .25 : voice.gain === .2 ? .2 : .08);
        assert.equal(voice.release, .001);
      }
    });
  });
  test(`${scene} BGM keeps the bridge and repeated theme on the continuous audio clock`, async () => {
    await withAudio(scene, (voices, advance) => {
      for (let time = .1; time < cycle * 2 + .3; time += .1) advance(time);
      const melody = voices.filter(voice => voice.bus === 0 && voice.type === 'sine' && voice.midi >= 64);
      const roots = voices.filter(voice => voice.bus === 0 && voice.type === 'sine' && voice.midi < 60 && Math.abs((voice.start - opening) / beat - Math.round((voice.start - opening) / beat)) < 1e-6);
      assert.deepEqual(roots.slice(0, 48).map(voice => voice.midi), Array.from({ length: 48 }, (_, i) => [48, 45, 41, 43][i % 4]));
      const repeated = melody.findIndex(voice => Math.abs(voice.start - opening - cycle) < 1e-6);
      assert.ok(repeated > 0, 'The opening must return on the next cycle without a timing reset');
      assert.equal(melody[repeated - 1].midi, 67, 'Keep the final G in the original pentatonic palette');
      assert.ok(Math.abs(melody[repeated].start - melody[repeated - 1].start - 4 * beat) < 1e-6, 'Keep the legato pickup timing at the seam');
      assert.deepEqual(melody.slice(repeated, repeated * 2).map(voice => voice.midi), melody.slice(0, repeated).map(voice => voice.midi));
      const carry = voices.find(voice => voice.type === 'triangle' && Math.abs(voice.start - opening - cycle + 4 * beat) < 1e-6);
      assert.equal(carry?.midi, 55, 'The final accompaniment must carry G into C instead of leaving D ringing');
      assert.ok(carry!.end > opening + cycle, 'Preserve a sounding accompaniment across the seam');
    });
  });
}

test('backgrounding and returning preserve the already scheduled BGM clock', async () => {
  const collect = async (paused: boolean) => {
    let captured: Voice[] = [];
    await withAudio('menu', async (voices, advance, visibility) => {
      if (paused) { await visibility(true); await visibility(false); }
      for (let time = .1; time < 3; time += .1) advance(time);
      captured = voices.map(voice => ({ ...voice }));
    });
    return captured;
  };
  assert.deepEqual(await collect(true), await collect(false));
});

test('rapid effects remain distinct with restrained gain; mute and hidden pages stay silent', async () => {
  await withAudio('game', async (voices, _advance, visibility, audio) => {
    audio.play('place'); audio.play('place'); audio.play('rotate');
    const effects = voices.filter(voice => voice.bus === 1);
    assert.equal(effects.length, 6);
    assert.ok(effects[2].gain < effects[0].gain && effects[4].gain < effects[2].gain);
    await visibility(true); audio.play('win');
    assert.equal(voices.filter(voice => voice.bus === 1).length, 6);
    await visibility(false);
    audio.setSettings({ music: .35, effects: .65, muted: true, facilityTips: true, continuousPlacement: true, facilityNames: false, ruleDisplay: true });
    audio.play('place');
    assert.equal(voices.filter(voice => voice.bus === 1).length, 6);
  });
});

test('close, confirmation, success and paper feedback are distinct and respect the effects bus', async () => {
  await withAudio('menu', (voices, advance, _visibility, audio, probe) => {
    audio.feedback('close'); advance(.2); audio.feedback('confirm'); advance(.4); audio.feedback('success');
    const tones = voices.filter(voice => voice.bus === 1);
    assert.deepEqual(tones.map(voice => voice.midi), [74,67,76,84,79,84,88]);
    assert.ok(tones[0].end - tones[0].start < .15, 'Closing has a short tail');
    advance(.8); audio.feedback('page'); audio.feedback('page');
    const paper = voices.filter(voice => voice.type === 'paper');
    assert.equal(paper.length, 2, 'Every successful turn gets one paper sound, including rapid turns');
    assert.equal(probe.buffers(), 1, 'Reuse the locally synthesized paper buffer');
    assert.ok(paper.every(voice => voice.bus === 1 && voice.end - voice.start <= .141));
    assert.ok(paper[1].gain < paper[0].gain, 'Rapid turns reduce gain instead of growing louder');
    audio.setSettings({ ...settings, effects: 0 }); audio.feedback('page'); audio.feedback('close');
    assert.equal(voices.filter(voice => voice.bus === 1).length, 9);
    assert.ok(paper.every(voice => voice.end <= .815 + 1e-9), 'Turning effects off also stops paper tails');
  });
});

test('audio unlock coalesces rapid feedback without queuing stale clicks', async () => {
  await withAudio('game', async (voices, _advance, _visibility, audio, probe) => {
    const release = probe.defer('resume');
    audio.feedback('click'); audio.feedback('select'); audio.feedback('close');
    assert.equal(voices.filter(voice => voice.bus === 1).length, 0);
    release(); await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(voices.filter(voice => voice.bus === 1).map(voice => voice.midi), [74,67]);
  });
});

test('zero music stops tails, pending notes and scheduling across scenes and visibility; effects stay independent', async () => {
  await withAudio('game', async (voices, advance, visibility, audio, probe) => {
    for (let time = .1; time <= .6; time += .1) advance(time);
    const music = voices.filter(voice => voice.bus === 0);
    assert.ok(music.some(voice => voice.start > .6), 'Include notes scheduled ahead of the audio clock');
    audio.setSettings({ ...settings, music: 0, effects: .6 });
    assert.equal(probe.timers.size, 0);
    assert.ok(music.every(voice => voice.end <= .615 + 1e-9));
    assert.deepEqual(probe.events.filter(event => event.bus === 0).slice(-2).map(event => [event.method, event.value]), [['hold', .105], ['ramp', 0]]);
    audio.play('place'); audio.play('win');
    assert.equal(voices.filter(voice => voice.bus === 1).length, 7);
    for (const scene of ['menu', 'game'] as const) {
      audio.setScene(scene); await Promise.all([audio.start(), audio.start()]);
      advance(3); await visibility(true); await visibility(false); await audio.start(); advance(6);
    }
    assert.equal(voices.filter(voice => voice.bus === 0).length, music.length);
    assert.equal(probe.timers.size, 0);
    assert.equal(probe.contexts(), 1);
    assert.equal(probe.events.filter(event => event.bus === 0).at(-1)?.value, 0);
  });
});

test('saved zero music creates no BGM; restoring it starts one scheduler without reviving stopped tails', async () => {
  await withAudio('menu', async (voices, advance, _visibility, audio, probe) => {
    assert.equal(voices.length, 0);
    assert.equal(probe.timers.size, 0);
    audio.setSettings({ ...settings, music: .4, effects: 0 });
    await Promise.all([audio.start(), audio.start(), audio.start()]);
    const opening = voices.length;
    assert.equal(opening, 4);
    assert.equal(probe.timers.size, 1);
    audio.play('click'); audio.play('win');
    assert.equal(voices.length, opening);
    audio.setSettings({ ...settings, music: 0 });
    const stopped = voices.map(voice => voice.end);
    audio.setSettings({ ...settings, music: .4, effects: 0 });
    await Promise.all([audio.start(), audio.start()]);
    assert.equal(probe.timers.size, 1);
    assert.deepEqual(voices.slice(0, opening).map(voice => voice.end), stopped);
    assert.ok(voices.slice(opening).every(voice => voice.start >= .08));
    advance(1);
    assert.ok(probe.events.filter(event => event.bus === 0 && event.method === 'ramp').every(event => event.value <= .12));
    assert.equal(probe.contexts(), 1);
  }, { ...settings, music: 0, effects: .6 });
});

test('mute stops both buses and async background/resume uses the latest zero setting', async () => {
  await withAudio('game', async (voices, advance, visibility, audio, probe) => {
    audio.play('win'); advance(.2);
    audio.setSettings({ ...settings, muted: true });
    assert.ok(voices.every(voice => voice.end <= .215 + 1e-9));
    const before = voices.length;
    audio.play('win'); advance(2);
    assert.equal(voices.length, before);
    assert.equal(probe.timers.size, 0);
    const releaseSuspend = probe.defer('suspend');
    await visibility(true); await visibility(false);
    audio.setSettings({ ...settings, music: 0, effects: .6 });
    releaseSuspend(); await audio.start();
    assert.equal(probe.timers.size, 0);
    const releaseResume = probe.defer('resume');
    const starting = Promise.all([audio.start(), audio.start()]);
    await visibility(true);
    audio.setSettings({ ...settings, music: 0, effects: .6 });
    releaseResume(); await starting;
    advance(4); assert.equal(voices.length, before);
    await visibility(false); await audio.start();
    audio.play('click');
    assert.equal(voices.length, before + 1);
    assert.equal(probe.timers.size, 0);
    assert.equal(probe.contexts(), 1);
  });
});

test('audio settings round-trip through the existing save without replacing zero or changing progress', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let stored = JSON.stringify({ version: 1, completed: [15], current: 31, progress: {}, settings });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => stored, setItem: (_key: string, value: string) => { stored = value; } } });
  try {
    for (const audioSettings of [{ music: 0, effects: .6, muted: false }, { music: .4, effects: 0, muted: false }, { music: 0, effects: .6, muted: true }]) {
      const save = readSave(); save.settings = { ...save.settings, ...audioSettings };
      assert.equal(writeSave(save), true);
      const restored = readSave();
      assert.deepEqual({ music: restored.settings.music, effects: restored.settings.effects, muted: restored.settings.muted }, audioSettings);
      assert.deepEqual(restored.completed, [15]); assert.equal(restored.current, 31);
      assert.deepEqual(restored.progress, save.progress);
    }
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});

