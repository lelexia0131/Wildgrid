# Camp Evening BGM

`camp-evening.mp3` is the approved **营地晚风 · 多主题版** (194.98 seconds), encoded at 320 kbps, 44.1 kHz stereo. Its arrangement and natural ending are unchanged. `WildernessAudio` plays it at the original speed in every scene and waits **3 seconds** after it finishes before replaying it.

Vite bundles this local asset and includes it in the generated offline cache. Music is loaded once after an audio-enabled user gesture. Muting pauses its position, including any remaining replay gap; backgrounding suspends the shared audio clock. Interaction effects remain synthesized on their own gain bus.

The recording uses CC0 instrument samples from Versilian Studios' VSCO 2 Community Edition and VCSL. Credits and license copies ship in `public/audio-licenses/`.

- Approved source: `01_营地晚风_多主题版.wav`
- Source SHA-256: `ce1e273715982bbeb58e37c54a1d602b6f9789547c625eb966d8dfa0206b6717`
- MP3 SHA-256: `bbe6c82bc54891b95737e0ee6ebe7e03aa2d389402f76e5c9c05f28f53107000`

Playback regression checks: `npx tsx --test tests/platform/audio.test.ts`.
