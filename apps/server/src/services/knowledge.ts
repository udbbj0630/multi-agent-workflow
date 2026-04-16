/**
 * 知识边界引擎
 *
 * 每个知识点是一棵树，按深度分层。
 * 根据孩子年龄限制呜哩的知识深度。
 */

interface KnowledgeLevel {
  level: number;
  minAge: number;
  maxAge: number;
  points: string[];
}

interface KnowledgeTree {
  concept: string;
  levels: KnowledgeLevel[];
  boundaryMessage: string;
}

const knowledgeDB: KnowledgeTree[] = [
  {
    concept: '苹果',
    levels: [
      { level: 1, minAge: 3, maxAge: 4, points: ['颜色是红色或绿色', '形状是圆圆的', '味道甜甜的', '可以生吃也可以榨汁'] },
      { level: 2, minAge: 4, maxAge: 6, points: ['有很多品种，比如富士、嘎啦', '是从苹果树上长出来的', '先开花再结果', '秋天成熟'] },
      { level: 3, minAge: 6, maxAge: 8, points: ['全世界都种苹果', '中国有很多种苹果', '有丰富的维生素', '不同地方种的苹果味道不一样'] },
    ],
    boundaryMessage: '这个呜哩也不太确定呢，我们下次再研究好不好？你可以问问爸爸妈妈～',
  },
  {
    concept: '恐龙',
    levels: [
      { level: 1, minAge: 3, maxAge: 4, points: ['恐龙是很久很久以前的动物', '现在没有了', '有些恐龙很大，有些很小', '霸王龙很有名'] },
      { level: 2, minAge: 4, maxAge: 6, points: ['恐龙有很多种类', '三角龙头上有三个角', '梁龙的脖子很长', '有些恐龙吃草，有些吃肉'] },
      { level: 3, minAge: 6, maxAge: 8, points: ['恐龙灭绝是因为小行星撞击地球', '化石是恐龙留下的骨头变成的', '鸟类可能是恐龙的后代'] },
    ],
    boundaryMessage: '哇这个问题好深奥！呜哩的小脑袋想不出来了，下次我们一起查查看吧！',
  },
  {
    concept: '月亮',
    levels: [
      { level: 1, minAge: 3, maxAge: 4, points: ['月亮在天上', '有时候圆圆的有时候弯弯的', '晚上能看到月亮', '月亮是黄色的'] },
      { level: 2, minAge: 4, maxAge: 6, points: ['月亮是地球的邻居', '月亮上没有水', '月亮会发光是因为太阳照着它', '月亮会变圆变弯'] },
      { level: 3, minAge: 6, maxAge: 8, points: ['月亮绕着地球转', '宇航员去过月球', '月球上有很多坑', '月亮和地球的距离很远很远'] },
    ],
    boundaryMessage: '太空的秘密太多了！呜哩下次去Z星球图书馆帮你查查！',
  },
  {
    concept: '水',
    levels: [
      { level: 1, minAge: 3, maxAge: 4, points: ['水是透明的', '水可以喝', '鱼在水里游', '下雨就是水从天上掉下来'] },
      { level: 2, minAge: 4, maxAge: 6, points: ['水没有颜色没有味道', '水可以变成冰', '冰可以变成水', '水蒸气就是热水冒出的白气'] },
      { level: 3, minAge: 6, maxAge: 8, points: ['水有三种形态：液态、固态、气态', '地球上的水大部分是海水', '要节约用水', '水循环让雨水不断产生'] },
    ],
    boundaryMessage: '水的学问可大了！呜哩建议你去问问爸爸妈妈或者老师哦～',
  },
  {
    concept: '猫',
    levels: [
      { level: 1, minAge: 3, maxAge: 4, points: ['猫毛茸茸的', '猫会喵喵叫', '猫喜欢吃鱼', '猫很可爱'] },
      { level: 2, minAge: 4, maxAge: 6, points: ['猫有尖尖的爪子', '猫会在晚上看得见', '猫喜欢抓老鼠', '小猫叫小猫咪'] },
      { level: 3, minAge: 6, maxAge: 8, points: ['猫有很强的平衡感', '猫的胡须可以感知周围', '不同品种的猫长得不一样'] },
    ],
    boundaryMessage: '猫咪的秘密太多了！呜哩下次再和你一起研究～',
  },
];

/**
 * 根据概念和孩子年龄，获取知识边界约束
 * 返回给 LLM 的 prompt 片段
 */
export function getKnowledgeBoundary(concept: string, childAge: number): string | null {
  const tree = knowledgeDB.find((item) =>
    item.concept === concept || concept.includes(item.concept) || item.concept.includes(concept),
  );

  if (!tree) return null;

  const allowedLevel = tree.levels
    .filter((level) => childAge >= level.minAge && childAge <= level.maxAge)
    .reduce(
      (max, level) => (level.level > max.level ? level : max),
      { level: 0, minAge: 0, maxAge: 0, points: [] as string[] },
    );

  if (allowedLevel.level === 0) {
    const baseLevel = tree.levels[0];
    return `关于"${tree.concept}"，这个孩子还小，只能说最基础的：${baseLevel.points.join('、')}。不要说更复杂的。`;
  }

  const allAllowedPoints = tree.levels
    .filter((level) => level.level <= allowedLevel.level)
    .flatMap((level) => level.points);

  return `关于"${tree.concept}"，这个${childAge}岁的孩子可以聊这些内容：${allAllowedPoints.join('、')}。` +
    `不要超出这个范围。如果孩子问了更深入的问题，就说："${tree.boundaryMessage}"`;
}

/**
 * 检测对话中是否触及已知知识概念
 */
export function detectConcept(text: string): string | null {
  for (const tree of knowledgeDB) {
    if (text.includes(tree.concept)) return tree.concept;
  }
  return null;
}

/**
 * 获取所有已知概念
 */
export function getAllConcepts(): string[] {
  return knowledgeDB.map((tree) => tree.concept);
}

export function getGuidedTopics(childAge: number, weakDimensions: string[]): string[] {
  const topics: string[] = [];
  const weakSet = new Set(weakDimensions);

  if (weakSet.has('creativity')) {
    topics.push(
      childAge <= 5 ? '一起想象会飞的动物住在哪里' : '编一个“如果今天月亮掉进花园里”的故事',
      '用玩具或小动物做角色扮演',
    );
  }

  if (weakSet.has('critical_thinking') || weakSet.has('criticalThinking')) {
    topics.push(
      '聊聊“为什么会下雨/天会黑”这类因果问题',
      childAge <= 5 ? '比较两个玩具哪里一样哪里不一样' : '猜一猜一件事情接下来会发生什么',
    );
  }

  if (weakSet.has('communication')) {
    topics.push(
      '请孩子讲讲今天最开心或最不开心的一件事',
      '一起回忆一件事情的先后顺序：先发生什么，后来呢',
    );
  }

  if (weakSet.has('collaboration')) {
    topics.push(
      '一起商量怎么帮助一个难过的小动物朋友',
      '玩轮流接话的小故事游戏',
    );
  }

  if (topics.length === 0) {
    topics.push(
      '聊聊今天见到的人和发生的事',
      '说说最喜欢的玩具或动物',
      '一起编一个小冒险故事',
    );
  }

  const uniqueTopics = [...new Set(topics)];
  return uniqueTopics.slice(0, 5);
}