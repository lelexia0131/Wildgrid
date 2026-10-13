import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WildernessAudio } from '../src/game/audio';

type Voice = { midi: number; start: number; end: number; type: string; bus: number; release: number; gain: number };

async function withAudio(scene: 'menu' | 'game', check: (voices: Voice[], advance: (time: number) => void, visibility: (hidden: boolean) => Promise<void>, audio: WildernessAudio) => void | Promise<void>) {
  const voices: Voice[] = [];
  let tick = () => {}, visibilityChange = () => {}, bus = 0;
  const documentStub = { hidden: false, addEventListener: (_name: string, callback: () => void) => { visibilityChange = callback; }, removeEventListener: () => {} };
  class Context {
    currentTime = 0;
    state = 'running';
    destination = {};
    createGain() {
      const node = { bus: bus++, target: -1, release: 0, peak: 0, gain: {
        setValueAtTime: () => {}, linearRampToValueAtTime: (value: number) => { node.release = value; node.peak = Math.max(node.peak, value); },
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
    async resume() { this.state = 'running'; }
    async suspend() { this.state = 'suspended'; }
    async close() { this.state = 'closed'; }
  }
  const context = new Context();
  const replacements = { AudioContext: function () { return context; }, window: { setInterval: (callback: () => void) => { tick = callback; return 1; } }, document: documentStub, clearInterval: () => {} };
  const originals = Object.entries(replacements).map(([key, value]) => {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    return { key, descriptor };
  });
  const audio = new WildernessAudio();
  try {
    audio.setScene(scene);
    await audio.start();
    await check(voices, time => { context.currentTime = time; tick(); }, async hidden => {
      documentStub.hidden = hidden; visibilityChange(); await Promise.resolve();
    }, audio);
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
    audio.setSettings({ music: .35, effects: .65, muted: true, facilityTips: true, continuousPlacement: true, facilityNames: false });
    audio.play('place');
    assert.equal(voices.filter(voice => voice.bus === 1).length, 6);
  });
});

