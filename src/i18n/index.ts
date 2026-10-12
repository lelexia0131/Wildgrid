import type { FacilityKind } from '../game/types';

export type Language = 'zh' | 'en';
type LessonCopy = { title: string; text: string };
type Dictionary = {
  settings: { language: string; tutorials: string; reset: string; resetReady: string; saveError: string };
  controls: { back: string; next: string; skip: string; finish: string; understood: string; continue: string; action: string; progress: string };
  basics: Record<'welcome' | 'board' | 'clues' | 'select' | 'place' | 'feedback' | 'goal' | 'rotate' | 'pickup' | 'replace' | 'undo' | 'complete' | 'wrong' | 'right' | 'multi' | 'el', LessonCopy>;
  facilities: Record<FacilityKind, LessonCopy>;
};
const zh: Dictionary = {
  settings: { language: '语言', tutorials: '教程引导', reset: '重新查看教程', resetReady: '教程已重置', saveError: '教程设置暂未保存，浏览器存储不可用。' },
  controls: { back: '上一步', next: '下一步', skip: '跳过', finish: '完成', understood: '我知道了', continue: '点击聚焦处以继续', action: '完成圈出的操作后继续', progress: '指导员' },
  basics: {
    welcome: { title: '欢迎来到野格', text: '欢迎来到野格！我是你的营地指导员。第一天我们先一起安顿一座小营地，慢慢来，不用急。准备好了，就点下一步吧。' },
    board: { title: '从这片营地开始', text: '这片草地就是我们的营地。先看看棋盘：设施放在草地上，棋盘已有的地形留在原处。' },
    clues: { title: '读懂行列提示', text: '留意边上的黄色短杠，每条代表这一行或列还要占一格。刚好填满会变成勾；红色差额是在提醒我们放多了。' },
    select: { title: '挑一件设施', text: '先从待放区挑一件设施吧。点一下卡片就能准备放置，上面的数量告诉我们还剩多少。' },
    place: { title: '放在正确位置', text: '点击圈出的草地。这处位置与水源上下左右相邻，也符合这一行和这一列的占格提示。' },
    feedback: { title: '看懂规则反馈', text: '红色叹号表示已经违反规则，黄色圆点表示还在等条件满足。放对的设施没有冲突标记；继续核对黄色短杠，完成其余设施。' },
    goal: { title: '规划的目标', text: '把全部设施安顿好，让行列提示都变成勾，再满足每件设施的要求，这片营地就准备好了。' },
    rotate: { title: '转成竖向', text: '这关圈出的位置需要竖向的双格营地。再点一次已选营地卡片，旋转 90°，然后按圈出的起点放下。' },
    pickup: { title: '拿起设施', text: '已经放对的营地也可以拿起。点一下圈出的营地，看看它如何回到待放区；下一步会用撤销把它恢复，不必另找位置。' },
    replace: { title: '重新找个落点', text: '设施已经拿在手里了，方向也还保留着。找片空草地，点一下重新放好。' },
    undo: { title: '撤销刚才的拿起', text: '点击圈出的撤销按钮，刚才拿起的营地会回到原本正确的位置。误操作时也可以这样恢复。' },
    complete: { title: '营地规划完成', text: '营地安顿好了！全部设施、行列目标和设施规则都已满足，我们可以继续出发了。' },
    wrong: { title: '放错示例', text: '看这个对比示例：营地只在水源斜角，不能算邻水，会出现红色冲突标记。' },
    right: { title: '放对示例', text: '营地与水源共享一条边，才算上下左右邻水。同时检查行列占格数，两个条件都满足才放对。' },
    multi: { title: '多格设施怎么计数', text: '黄色短杠数的是占用格数，不是建筑数量。双格营地占两格，三格营地占三格；多格营地只需其中一格上下左右邻水。' },
    el: { title: 'L 形的空格', text: 'L 形营地占三个格，拐角里的空格没有被占用，可以留给别的设施。旋转会改变三个占用格的方向，计数仍然是三格。' },
  },
  facilities: {
    camp: { title: '营地', text: '这是营地，靠着水源安顿下来吧。至少一格要上下左右邻水，多格营地也只需一格；别重叠或盖住固定地形。' },
    fire: { title: '篝火', text: '这是篝火，让营地暖和起来。把它放在营地的上下左右，记得远离森林，斜角也要避开。' },
    tower: { title: '瞭望塔', text: '瞭望塔能让我们看得更远，把它安排在山地的上下左右。两座塔之间要留点距离，斜角也不能紧挨。' },
    picnic: { title: '野餐桌', text: '有了野餐桌，就能在营地旁歇歇脚。它占两格，可以横放或竖放，至少一格上下左右邻营地；两格都要避开篝火，斜角也一样。' },
    cabin: { title: '林间木屋', text: '林间木屋适合靠着树林。它占 L 形三格，可以四向旋转，至少一格上下左右邻森林；每一格都别上下左右挨着水。' },
    foodTruck: { title: '餐车', text: '餐车来了，给营地留条通道吧。沿上下左右方向与营地隔一格空草地，间隔处保持空着，也别直接挨着任何营地。' },
    powerTower: { title: '电塔', text: '这座电塔周围要留出安全距离。上下左右别挨着营地，周围八格都不能有篝火；斜角挨着营地倒没关系。' },
    pool: { title: '泳池', text: '替泳池找个近水的地方吧。上下左右至少邻一格水，周围八格还得有一格营地；水只在斜角可不够。' },
  },
};
const en: Dictionary = {
  settings: { language: 'Language', tutorials: 'Tutorials', reset: 'Replay tutorials', resetReady: 'Tutorials reset.', saveError: 'Tutorial settings could not be saved. Browser storage is unavailable.' },
  controls: { back: 'Back', next: 'Next', skip: 'Skip', finish: 'Finish', understood: 'Got it', continue: 'Tap the focus to continue', action: 'Complete the highlighted action to continue', progress: 'Guide' },
  basics: {
    welcome: { title: 'Welcome to Wildgrid', text: 'Welcome to Wildgrid! I’ll be your camp guide. On our first day, we’ll settle one small camp together. Take your time—there’s no rush. Tap Next when you’re ready.' },
    board: { title: 'Start with your campsite', text: 'This patch of grass is our campsite. Take a look around: facilities go on grass, while the terrain already on the board stays put.' },
    clues: { title: 'Read the row and column clues', text: 'Watch the yellow dashes along the edges. Each one is a cell that row or column still needs filled. A check means just right; red means we filled too many.' },
    select: { title: 'Choose a facility', text: 'Let’s pick a facility from the tray. Tap its card to get ready to place it. The number tells us how many are left.' },
    place: { title: 'Place it correctly', text: 'Tap the highlighted grass. This position shares an edge with water and fits both its row and column clues.' },
    feedback: { title: 'Read the feedback', text: 'A red exclamation means a rule is broken. A yellow dot is waiting for a requirement. Correct facilities have no conflict marker. Check the remaining yellow dashes and finish the other facilities.' },
    goal: { title: 'Your goal', text: 'Let’s settle every facility into place, turn all the clues into checks, and meet each facility’s requirements. Then our campsite is ready.' },
    rotate: { title: 'Turn it vertically', text: 'This highlighted position needs a vertical two-cell camp. Tap the selected camp card once more to rotate it 90°, then place it at the highlighted starting cell.' },
    pickup: { title: 'Pick up a facility', text: 'Even a correctly placed camp can be picked up. Tap the highlighted camp to return it to the tray. Next we will undo this action and restore its correct position.' },
    replace: { title: 'Choose a new spot', text: 'We’ve picked it up, with its direction preserved. Find some empty grass and tap to set it down again.' },
    undo: { title: 'Undo the pickup', text: 'Tap the highlighted Undo button. The camp returns to its previous correct position. Undo can also restore an accidental move.' },
    complete: { title: 'Campsite complete', text: 'Our campsite is ready! All facilities, clues and rules are satisfied. We can head onward.' },
    wrong: { title: 'Incorrect placement', text: 'In this example the camp touches water only diagonally. That does not count as adjacent water, so it gets a red conflict marker.' },
    right: { title: 'Correct placement', text: 'The camp must share an edge with water. Also check the row and column totals: correct placement satisfies both the facility rule and the clues.' },
    multi: { title: 'Count occupied cells', text: 'Yellow dashes count cells, not buildings. A two-cell camp fills two cells; a three-cell camp fills three. Only one of its cells needs to share an edge with water.' },
    el: { title: 'The gap in an L shape', text: 'An L-shaped camp occupies three cells. Its corner gap stays empty and can hold another facility. Rotating changes the occupied positions, but the count stays three.' },
  },
  facilities: {
    camp: { title: 'Camp', text: 'Here’s our camp. Let’s settle beside the water: at least one cell must share an edge with it, even for a multi-cell camp. Keep clear of other facilities and fixed terrain.' },
    fire: { title: 'Campfire', text: 'This campfire will warm the campsite. Place it along an edge of a camp cell, and keep it away from forests—even diagonally.' },
    tower: { title: 'Lookout tower', text: 'A lookout tower gives us a better view. Place it along an edge of a mountain, with space between towers. They cannot touch diagonally either.' },
    picnic: { title: 'Picnic table', text: 'A picnic table gives us a place to rest beside camp. It fills two cells and rotates. At least one cell must share an edge with camp; keep both away from campfires, even diagonally.' },
    cabin: { title: 'Woodland cabin', text: 'Let’s tuck this woodland cabin beside the trees. Its three-cell L shape rotates four ways. At least one cell must share an edge with a forest; none may share an edge with water.' },
    foodTruck: { title: 'Food truck', text: 'The food truck has arrived. Leave exactly one empty grass cell between it and camp in a straight horizontal or vertical line. Keep that gap empty, and never share an edge with any camp.' },
    powerTower: { title: 'Power tower', text: 'This power tower needs some breathing room. No camp along an edge, and no campfire in any of the eight surrounding cells. A camp on the diagonal is fine.' },
    pool: { title: 'Pool', text: 'Let’s find a waterside spot for this pool. It needs water along an edge and a camp cell in one of the eight surrounding cells. Water only on the diagonal won’t do.' },
  },
};
export const dictionaries: Record<Language, Dictionary> = { zh, en };
export type BasicCopyKey = keyof Dictionary['basics'];
