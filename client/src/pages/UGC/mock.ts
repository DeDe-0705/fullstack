/**
 * 小红书风格瀑布流的 mock 数据。
 *
 * 为什么这样设计：
 * - 封面图使用 picsum.photos 并按「宽固定、高随机」生成，瀑布流的核心就是卡片高度不一致，
 *   这样 mock 才能真实还原布局场景（Masonry / 虚拟列表都依赖真实高度）。
 * - 提供 `fetchMockNotes` 模拟分页 + 网络延迟，方便观察 loading / 无限滚动，
 *   和 server 端「模拟延迟便于演示」的约定保持一致。
 */

export interface NoteAuthor {
  id: string;
  nickname: string;
  avatar: string;
}

/** 笔记分类，对应页面上方的频道 Tab（旅游 / 美食 / 游戏……） */
export const CATEGORIES = [
  '旅游',
  '美食',
  '穿搭',
  '家居',
  '健身',
  '宠物',
  '美妆',
  '游戏',
  '职场',
  '生活',
] as const;

export type NoteCategory = (typeof CATEGORIES)[number];

export interface Note {
  id: string;
  /** 笔记标题 */
  title: string;
  /** 笔记分类 */
  category: NoteCategory;
  /** 封面图地址 */
  cover: string;
  /** 封面图宽高，瀑布流布局需要提前知道宽高比来占位，避免图片加载后跳动 */
  coverWidth: number;
  coverHeight: number;
  author: NoteAuthor;
  likeCount: number;
  /** 是否为图文笔记（false 表示视频笔记，卡片上会显示播放标识） */
  isImage: boolean;
}

// 标题与分类一一成对，保证生成的笔记标题和分类语义一致
const TITLES: ReadonlyArray<readonly [NoteCategory, string]> = [
  ['旅游', '周末去了趟阿那亚，被这片海治愈了'],
  ['美食', '一人食｜15 分钟搞定的日式照烧鸡腿饭'],
  ['穿搭', '小个子穿搭｜158cm 的显高秘诀全在这了'],
  ['家居', '租房改造｜花 800 块把老破小变成奶油风'],
  ['健身', '坚持晨跑 100 天，身体发生了什么变化'],
  ['美食', '北京胡同咖啡地图｜私藏的 6 家小店'],
  ['美妆', '新手化妆教程｜日常通勤妆 5 分钟出门'],
  ['宠物', '猫咪日常｜我家主子的迷惑行为大赏'],
  ['旅游', '露营装备清单｜第一次露营带这些就够了'],
  ['健身', '减脂餐合集｜一周不重样的低卡晚餐'],
  ['家居', '书桌布置｜打造高效学习的氛围感角落'],
  ['旅游', '川西自驾攻略｜4 天 3 晚保姆级路线'],
  ['美妆', '平价好物分享｜学生党闭眼入的护肤清单'],
  ['生活', '手帐排版｜极简风的周计划这样写'],
  ['生活', '阳台种菜日记｜小番茄终于结果啦'],
  ['职场', '面试经验｜前端大厂面经复盘（附答案）'],
  ['生活', 'Vlog｜和我过一天｜自由职业者的日常'],
  ['家居', '家居好物｜提升幸福感的 10 件小东西'],
  ['游戏', '原神抽卡实录｜欧皇附体的十连时刻'],
  ['旅游', 'citywalk｜上海武康路半日漫游指南'],
  ['游戏', 'Switch 双人游戏推荐｜情侣必玩清单'],
  ['游戏', '黑神话二周目｜那些你错过的隐藏彩蛋'],
];

const NICKNAMES = [
  '芝士就是力量',
  '桃桃乌龙',
  '一只小透明',
  '风吹过的夏天',
  '阿宅的日常',
  '焦糖玛奇朵',
  '山脚下的猫',
  '半糖去冰',
  '漫游星球',
  '今天也要加油鸭',
] as const;

const COVER_WIDTH = 400;

/** 封面高度在 300~560 之间随机，接近小红书常见的 3:4 ~ 4:5 竖图比例区间 */
function randomCoverHeight (): number {
  return 300 + Math.floor(Math.random() * 260);
}

function pick<T> (list: readonly T[], index: number): T {
  return list[index % list.length];
}

/** 生成一页笔记数据，page 从 1 开始，用于模拟分页时的数据差异 */
export function generateMockNotes (page: number, pageSize = 20, type?: NoteCategory): Note[] {
  return Array.from({ length: pageSize }, (_, i) => {
    // 用全局递增的序号保证 id、图片种子跨页不重复
    const seq = (page - 1) * pageSize + i;
    const coverHeight = randomCoverHeight();
    const [category, title] = pick(TITLES, seq);
    return {
      id: `note-${seq}`,
      title,
      category,
      // seed 保证同一条笔记的图片地址稳定，避免重渲染时图片闪烁
      cover: `https://picsum.photos/seed/note-${seq}/${COVER_WIDTH}/${coverHeight}`,
      coverWidth: COVER_WIDTH,
      coverHeight,
      author: {
        id: `user-${seq % NICKNAMES.length}`,
        nickname: pick(NICKNAMES, seq),
        avatar: `https://i.pravatar.cc/100?img=${(seq % 70) + 1}`,
      },
      likeCount: Math.floor(Math.random() * 10000),
      isImage: Math.random() > 0.2,
    };
  }).filter((note) => {
    if (type) {
      return note.category === type;
    }
    return true
  });
}

export interface FetchNotesResult {
  list: Note[];
  /** 是否还有更多数据，模拟到底时结束无限滚动 */
  hasMore: boolean;
}

const TOTAL_PAGES = 10;
const MOCK_DELAY = 600;

/** 模拟分页请求：延迟返回数据，便于演示 loading 与无限滚动 */
export function fetchMockNotes (page: number, pageSize = 20, type?: NoteCategory): Promise<FetchNotesResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        list: page > TOTAL_PAGES ? [] : generateMockNotes(page, pageSize, type),
        hasMore: page < TOTAL_PAGES,
      });
    }, MOCK_DELAY);
  });
}

export function fetchMockNoteByQuery (query: string): Promise<Note[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(generateMockNotes(1, 20, undefined).filter((note) => {
        return note.title.includes(query) || note.author.nickname.includes(query);
      }));
    }, MOCK_DELAY);
  });
}
