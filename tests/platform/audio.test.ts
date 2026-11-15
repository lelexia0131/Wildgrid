import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WildernessAudio } from '../../src/platform/audio/WildernessAudio';
import type { Settings } from '../../src/engine';
import { readSave, writeSave } from '../../src/save-system/adventureStorage';

type Voice = { midi: number; start: number; end: number; type: string; bus: number; release: number; gain: number; offset?: number; finish?: () => void };
type GainEvent = { bus: number; method: string; value: number; time: number };
type Probe = { events: GainEvent[]; requests: string[]; contexts: () => number; buffers: () => number; clock: () => number; failLoad: () => void; defer: (operation: 'load' | 'resume' | 'suspend') => () => void };
const settings: Settings = { music: .35, effects: .65, muted: false, facilityTips: true, continuousPlacement: true, facilityNames: false, ruleDisplay: true };
const trackDuration = 194.98;
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

async function withAudio(check: (voices: Voice[], advance: (time: number) => void, visibility: (hidden: boolean) => Promise<void>, audio: WildernessAudio, probe: Probe) => void | Promise<void>, initialSettings = settings) {
  const voices: Voice[] = [], events: GainEvent[] = [], requests: string[] = [];
  let visibilityChange = () => {}, bus = 0, contexts = 0, buffers = 0, failLoad = false;
  let resumeGate: Promise<void> | undefined, suspendGate: Promise<void> | undefined, loadGate: Promise<void> | undefined;
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
      return { duration: length / this.sampleRate, getChannelData: () => data };
    }
    async decodeAudioData(_bytes: ArrayBuffer) { return { duration: trackDuration }; }
    createBiquadFilter() {
      const filter = { type: '', Q: { value: 0 }, frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, target: undefined as ReturnType<Context['createGain']> | undefined,
        connect: (node: ReturnType<Context['createGain']>) => { filter.target = node; }, disconnect: () => {},
      };
      return filter;
    }
    createBufferSource() {
      let target: ReturnType<Context['createGain']> | ReturnType<Context['createBiquadFilter']>;
      const voice: Voice = { midi: 0, start: 0, end: Infinity, type: '', bus: -1, release: 0, gain: 0 };
      const source = { buffer: undefined as { duration: number } | undefined, onended: null as (() => void) | null,
        connect: (node: typeof target) => { target = node; }, disconnect: () => {},
        start: (time = 0, offset = 0) => {
          const gain = 'gain' in target ? target : target.target!;
          const type = 'gain' in target ? 'music' : 'paper';
          Object.assign(voice, { start: time, offset, end: time + source.buffer!.duration - offset, type, bus: type === 'music' ? gain.bus : gain.target, release: gain.release, gain: gain.peak, finish: () => source.onended?.() });
          voices.push(voice);
        }, stop: (time: number) => { voice.end = time; },
      };
      return source;
    }
    async resume() { if (resumeGate) await resumeGate; this.state = 'running'; }
    async suspend() { if (suspendGate) await suspendGate; this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
  }
  let context: Context;
  const replacements = {
    AudioContext: function () { contexts++; bus = 0; context = new Context(); return context; },
    fetch: async (url: string) => {
      requests.push(url);
      if (failLoad) { failLoad = false; throw new Error('Unavailable audio'); }
      const gate = loadGate;
      return { ok: true, arrayBuffer: async () => { if (gate) await gate; return new ArrayBuffer(8); } };
    },
    document: documentStub,
  };
  const originals = Object.entries(replacements).map(([key, value]) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    return { key, descriptor };
  });
  const audio = new WildernessAudio();
  try {
    audio.setSettings(initialSettings);
    await audio.start(); await settle();
    await check(voices, time => { if (context.state === 'running') context.currentTime = time; }, async hidden => {
      documentStub.hidden = hidden; visibilityChange(); await settle();
    }, audio, { events, requests, contexts: () => contexts, buffers: () => buffers, clock: () => context.currentTime, failLoad: () => { failLoad = true; }, defer: operation => {
      if (operation === 'resume') context.state = 'suspended';
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      if (operation === 'resume') resumeGate = gate; else if (operation === 'suspend') suspendGate = gate; else loadGate = gate;
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

test('approved BGM loads once and waits three audio-clock seconds between complete plays', async () => {
  await withAudio(async (voices, advance, _visibility, audio, probe) => {
    assert.equal(probe.requests.length, 1);
    assert.match(probe.requests[0], /camp-evening\.mp3$/);
    assert.equal(voices.length, 1);
    assert.equal(voices[0].type, 'music');
    assert.equal(voices[0].offset, 0);
    await Promise.all([audio.start(), audio.start(), audio.start()]);
    audio.setSettings({ ...settings, music: .5 });
    assert.equal(voices.length, 1, 'Volume changes and repeated gestures must not restart or layer BGM');
    advance(trackDuration); voices[0].finish!();
    assert.equal(voices.length, 2);
    assert.equal(voices[1].start, trackDuration + 3);
    assert.equal(voices[1].offset, 0);
    advance(trackDuration * 2 + 3); voices[1].finish!();
    assert.equal(voices[2].start, trackDuration * 2 + 6);
    assert.equal(probe.requests.length, 1);
    assert.equal(probe.contexts(), 1);
  });
});

test('backgrounding freezes music progress and the scheduled loop gap', async () => {
  await withAudio(async (voices, advance, visibility, _audio, probe) => {
    advance(20); await visibility(true); advance(100);
    assert.equal(probe.clock(), 20);
    await visibility(false);
    assert.equal(voices.length, 1);
    advance(trackDuration); voices[0].finish!();
    advance(trackDuration + 1); await visibility(true); advance(500);
    assert.equal(probe.clock(), trackDuration + 1);
    await visibility(false);
    assert.equal(voices.length, 2);
    assert.equal(voices[1].start, trackDuration + 3);
  });
});

test('zero music pauses at its current position while sound effects remain independent', async () => {
  await withAudio(async (voices, advance, visibility, audio, probe) => {
    advance(20);
    audio.setSettings({ ...settings, music: 0 });
    assert.equal(voices[0].end, 20.015);
    audio.play('place'); assert.equal(voices.filter(v => v.bus === 1).length, 2);
    advance(30); await visibility(true); await visibility(false); await audio.start();
    assert.equal(voices.filter(v => v.type === 'music').length, 1);
    audio.setSettings({ ...settings, music: .4 });
    const resumed = voices.filter(v => v.type === 'music')[1];
    assert.equal(resumed.start, 30);
    assert.equal(resumed.offset, 20);
    assert.equal(probe.requests.length, 1);
  });
});

test('muting during the loop gap preserves its remaining silence when music is restored', async () => {
  await withAudio(async (voices, advance, _visibility, audio) => {
    advance(trackDuration); voices[0].finish!();
    advance(trackDuration + 1); audio.setSettings({ ...settings, muted: true });
    const stopped = voices[1].end;
    advance(300); audio.setSettings(settings);
    assert.equal(voices[1].end, stopped);
    assert.equal(voices[2].start, 302);
    assert.equal(voices[2].offset, 0);
    voices[1].finish!();
    assert.equal(voices.length, 3, 'A cancelled play must not enqueue another loop');
  });
});

test('saved zero music stays unloaded until enabled and concurrent starts share the load', async () => {
  await withAudio(async (voices, _advance, _visibility, audio, probe) => {
    assert.equal(voices.length, 0);
    assert.equal(probe.requests.length, 0);
    const release = probe.defer('load');
    audio.setSettings(settings);
    await Promise.all([audio.start(), audio.start(), audio.start()]);
    assert.equal(probe.requests.length, 1);
    assert.equal(voices.length, 0);
    release(); await settle();
    assert.equal(voices.length, 1);
  }, { ...settings, music: 0 });
});

test('loading music does not delay effects or bypass mute and visibility', async () => {
  await withAudio(async (voices, _advance, visibility, audio, probe) => {
    const release = probe.defer('load');
    audio.setSettings(settings);
    audio.feedback('place');
    assert.equal(voices.filter(v => v.bus === 1).length, 2);
    audio.setSettings({ ...settings, muted: true });
    release(); await settle();
    assert.equal(voices.filter(v => v.type === 'music').length, 0);
    await visibility(true); audio.setSettings(settings); await settle();
    assert.equal(voices.filter(v => v.type === 'music').length, 0);
    await visibility(false);
    assert.equal(voices.filter(v => v.type === 'music').length, 1);
  }, { ...settings, music: 0 });
});

test('failed music loading can retry without breaking effects', async () => {
  await withAudio(async (voices, _advance, _visibility, audio, probe) => {
    probe.failLoad(); audio.setSettings(settings); await settle();
    audio.play('click');
    assert.equal(voices.filter(v => v.bus === 1).length, 1);
    assert.equal(voices.filter(v => v.type === 'music').length, 0);
    await audio.start(); await settle();
    assert.equal(probe.requests.length, 2);
    assert.equal(voices.filter(v => v.type === 'music').length, 1);
  }, { ...settings, music: 0 });
});

test('disposing rejects stale audio loads and cancels a scheduled replay', async () => {
  await withAudio(async (voices, advance, _visibility, audio, probe) => {
    const releaseOld = probe.defer('load');
    audio.setSettings(settings); await audio.start();
    audio.dispose();
    const releaseNew = probe.defer('load');
    await audio.start();
    releaseOld(); await settle(); await audio.start();
    assert.equal(probe.requests.length, 2);
    assert.equal(voices.length, 0);
    releaseNew(); await settle();
    assert.equal(voices.length, 1);
    advance(trackDuration); voices[0].finish!();
    assert.equal(voices.length, 2);
    audio.dispose(); voices[1].finish!();
    assert.equal(voices.length, 2);
    assert.equal(probe.contexts(), 2);
  }, { ...settings, music: 0 });
});

test('rapid effects remain distinct with restrained gain; mute and hidden pages stay silent', async () => {
  await withAudio(async (voices, _advance, visibility, audio) => {
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
  await withAudio((voices, advance, _visibility, audio, probe) => {
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
  await withAudio(async (voices, _advance, _visibility, audio, probe) => {
    const release = probe.defer('resume');
    audio.feedback('click'); audio.feedback('select'); audio.feedback('close');
    assert.equal(voices.filter(voice => voice.bus === 1).length, 0);
    release(); await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(voices.filter(voice => voice.bus === 1).map(voice => voice.midi), [74,67]);
  });
});

test('mute stops both buses and asynchronous background changes respect the latest setting', async () => {
  await withAudio(async (voices, advance, visibility, audio, probe) => {
    audio.play('win'); advance(.2); audio.setSettings({ ...settings, muted: true });
    assert.ok(voices.every(v => v.end <= .215 + 1e-9));
    const before = voices.length;
    const releaseSuspend = probe.defer('suspend');
    await visibility(true); await visibility(false);
    audio.setSettings({ ...settings, music: 0 });
    releaseSuspend(); await audio.start();
    const releaseResume = probe.defer('resume');
    const starting = Promise.all([audio.start(), audio.start()]);
    await visibility(true);
    releaseResume(); await starting;
    advance(4); assert.equal(voices.length, before);
    await visibility(false); await audio.start(); audio.play('click');
    assert.equal(voices.length, before + 1);
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

