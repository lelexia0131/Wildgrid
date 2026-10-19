import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewardFrame, rewardSegments } from '../src/ui/components/survivalRewardAnimation';
import { rankFor } from '../src/game-modes/survival/survivalDifficulty';

test('reward frames use lifetime thresholds and finish at the actual rank', () => {
  for (const [before, earned] of [[500, 50], [9, 1], [0, 100], [490, 610], [1000, 100], [1100, 0]]) {
    const segments = rewardSegments(before + earned, earned);
    const first = rewardFrame(segments, 0), last = rewardFrame(segments, 1);
    assert.equal(first.xp, before);
    assert.equal(last.xp, before + earned);
    assert.equal(last.rank, rankFor(before + earned));
    assert.equal(last.fill, last.next === undefined ? 1 : (last.xp - last.start) / (last.next - last.start));
    let previous = first;
    for (let tick = 1; tick <= 1200; tick++) {
      const frame = rewardFrame(segments, tick / 1200);
      assert.ok(frame.xp >= previous.xp && frame.xp <= before + earned);
      assert.ok(frame.fill >= 0 && frame.fill <= 1);
      if (frame.rank !== previous.rank) {
        assert.equal(previous.fill, 1, 'each crossed rank must visibly fill before resetting');
        assert.equal(frame.rank, previous.rank + 1);
      } else assert.ok(frame.fill >= previous.fill);
      previous = frame;
    }
  }
});

test('exact thresholds show the full old rank, then zero at the new rank', () => {
  const segments = rewardSegments(100, 100);
  assert.deepEqual(segments, [{ from: 0, to: 10, rank: 0 }, { from: 10, to: 100, rank: 1 }, { from: 100, to: 100, rank: 2 }]);
  assert.equal(rewardFrame(segments, .32).fill, 1);
  assert.equal(rewardFrame(segments, .65).fill, 1);
  assert.equal(rewardFrame(segments, 1).fill, 0);
});

test('highest rank stays full while its lifetime XP continues increasing', () => {
  const segments = rewardSegments(1100, 100);
  const middle = rewardFrame(segments, .5);
  assert.equal(middle.xp, 1050);
  assert.equal(middle.fill, 1);
  assert.equal(middle.next, undefined);
});

test('a one-point reward still moves smoothly between integer counter updates', () => {
  const segments = rewardSegments(551, 1);
  const frame = rewardFrame(segments, .5);
  assert.equal(frame.xp, 550);
  assert.ok(frame.fill > .1 && frame.fill < .102);
});
