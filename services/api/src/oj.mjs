import { EditorialContentError, validateEditorialContent } from "./editorial-content.mjs";

const legacyOiAlgorithmTags = [
  "顺序结构", "分支结构", "循环结构", "数组", "字符串", "函数", "递归", "结构体", "指针", "STL", "模拟", "枚举", "构造", "Ad-hoc",
  "复杂度分析", "排序", "二分", "三分", "分治", "倍增", "前缀和", "差分", "离散化", "双指针", "滑动窗口", "位运算", "随机化", "启发式算法", "Meet-in-the-middle",
  "贪心", "搜索", "深度优先搜索 DFS", "广度优先搜索 BFS", "迭代加深", "双向搜索", "A*", "IDA*", "剪枝", "记忆化搜索", "回溯", "舞蹈链 DLX",
  "动态规划 DP", "线性 DP", "背包 DP", "区间 DP", "树形 DP", "数位 DP", "状态压缩 DP", "概率 DP", "计数 DP", "插头 DP", "轮廓线 DP", "斜率优化 DP", "四边形不等式优化", "决策单调性", "动态 DP",
  "栈", "队列", "单调栈", "单调队列", "堆", "哈希表", "链表", "并查集", "树状数组", "线段树", "线段树合并", "李超线段树", "ST 表", "稀疏表", "分块", "莫队", "可持久化数据结构", "平衡树", "Treap", "Splay", "替罪羊树", "K-D Tree", "动态树 LCT", "树套树",
  "图论", "图的遍历", "拓扑排序", "最短路", "Dijkstra", "Bellman-Ford", "SPFA", "Floyd", "生成树", "最小生成树", "Kruskal", "Prim", "强连通分量", "双连通分量", "割点", "桥", "2-SAT", "欧拉路径", "哈密顿路径", "差分约束", "基环树", "仙人掌", "网络流", "最大流", "最小割", "费用流", "上下界网络流", "二分图", "二分图匹配", "匈牙利算法", "Hall 定理",
  "树论", "树的直径", "树的重心", "最近公共祖先 LCA", "树链剖分", "树上差分", "虚树", "点分治", "边分治", "树上启发式合并", "DSU on Tree", "长链剖分", "Prufer 序列",
  "字符串算法", "字符串哈希", "Trie", "KMP", "Z 函数", "Manacher", "AC 自动机", "后缀数组 SA", "后缀自动机 SAM", "后缀树", "回文自动机 PAM", "最小表示法", "Lyndon 分解",
  "数学", "高精度", "进制", "快速幂", "矩阵快速幂", "数论", "质数", "筛法", "最大公约数", "扩展欧几里得", "同余", "中国剩余定理 CRT", "逆元", "欧拉函数", "欧拉定理", "费马小定理", "离散对数", "BSGS", "原根", "二次剩余", "Pell 方程", "组合数学", "排列组合", "容斥原理", "鸽巢原理", "生成函数", "线性代数", "矩阵", "高斯消元", "线性基", "群论", "博弈论", "概率论", "期望", "Burnside 引理", "Polya 定理",
  "多项式", "快速傅里叶变换 FFT", "数论变换 NTT", "快速沃尔什变换 FWT", "多项式求逆", "多项式对数", "多项式指数", "拉格朗日插值", "Berlekamp-Massey", "线性递推",
  "计算几何", "向量", "叉积", "点积", "凸包", "旋转卡壳", "半平面交", "扫描线", "平面最近点对", "圆", "极角排序", "三维计算几何", "自适应辛普森法",
  "交互题", "输出答案题", "提交答案题", "Special Judge", "O2 优化", "在线算法", "离线算法", "根号分治", "整体二分", "CDQ 分治", "平行二分", "珂朵莉树", "FHQ Treap", "可撤销并查集", "小波矩阵", "支配树", "后缀平衡树",
];

const additionalOiAlgorithmTags = [
  "冒泡排序", "选择排序", "插入排序", "快速排序", "归并排序", "计数排序", "桶排序", "基数排序",
  "模拟退火", "爬山算法", "随机增量", "01 Trie", "左偏树", "笛卡尔树", "主席树", "线段树分治",
  "可撤销数据结构", "圆方树", "最小树形图", "Johnson 全源最短路", "K 短路", "最小费用最大流",
  "最大权闭合子图", "扩展 KMP", "Duval 算法", "Lucas 定理", "扩展 Lucas", "莫比乌斯反演",
  "杜教筛", "洲阁筛", "Min_25 筛", "FFT 分治", "单位根反演", "凸多边形", "闵可夫斯基和",
  "点定位", "动态凸包", "对拍", "构造题", "通信题", "IO 交互", "随机数据生成",
];

export const oiAlgorithmTags = Object.freeze([
  ...new Set([...legacyOiAlgorithmTags, ...additionalOiAlgorithmTags]),
]);

const tagCategoryDefinitions = [
  ["basics", { en: "Language & Basics", "zh-CN": "入门与基础", ja: "言語と基礎" }, /结构|数组|字符串$|函数|递归|指针|STL|模拟|枚举|构造|Ad-hoc|复杂度/],
  ["basic-algorithms", { en: "Basic Algorithms", "zh-CN": "基础算法", ja: "基本アルゴリズム" }, /排序|二分|三分|分治|倍增|前缀和|差分|离散化|双指针|滑动窗口|位运算|随机|启发式|Meet/],
  ["search", { en: "Search", "zh-CN": "搜索", ja: "探索" }, /搜索|DFS|BFS|A\*|IDA|剪枝|回溯|舞蹈链/],
  ["dynamic-programming", { en: "Dynamic Programming", "zh-CN": "动态规划", ja: "動的計画法" }, /DP|动态规划|背包|决策单调|四边形不等式/],
  ["data-structures", { en: "Data Structures", "zh-CN": "数据结构", ja: "データ構造" }, /栈|队列|堆|哈希|链表|并查集|树状数组|线段树|李超|ST 表|稀疏表|分块|莫队|持久化|平衡树|Treap|Splay|替罪羊|K-D|LCT|树套树|Trie|左偏树|笛卡尔树|主席树|可撤销数据结构|小波矩阵|珂朵莉/],
  ["graph", { en: "Graph Theory", "zh-CN": "图论", ja: "グラフ理論" }, /图|拓扑|最短路|Dijkstra|Bellman|SPFA|Floyd|Kruskal|Prim|连通分量|割点|桥|2-SAT|欧拉路径|哈密顿|差分约束|基环树|仙人掌|网络流|最大流|最小割|费用流|二分图|匈牙利|Hall|树形图|K 短路|Johnson/],
  ["trees", { en: "Trees", "zh-CN": "树论", ja: "木" }, /树论|树的|LCA|树链|树上|虚树|点分治|边分治|DSU on Tree|长链|Prufer|圆方树/],
  ["strings", { en: "Strings", "zh-CN": "字符串", ja: "文字列" }, /字符串|Trie|KMP|Z 函数|Manacher|自动机|后缀|回文|最小表示|Lyndon|Duval/],
  ["math", { en: "Mathematics", "zh-CN": "数学", ja: "数学" }, /数学|高精度|进制|快速幂|数论|质数|筛|欧几里得|同余|剩余定理|逆元|欧拉|费马|离散对数|BSGS|原根|二次剩余|Pell|组合|排列|容斥|鸽巢|生成函数|线性代数|矩阵|高斯|线性基|群论|博弈|概率|期望|Burnside|Polya|Lucas|莫比乌斯/],
  ["polynomial", { en: "Polynomial", "zh-CN": "多项式", ja: "多項式" }, /多项式|FFT|NTT|FWT|插值|Berlekamp|线性递推|单位根/],
  ["geometry", { en: "Computational Geometry", "zh-CN": "计算几何", ja: "計算幾何" }, /几何|向量|叉积|点积|凸包|旋转卡壳|半平面交|扫描线|最近点对|圆$|极角|辛普森|闵可夫斯基|点定位|动态凸包/],
  ["problem-types", { en: "Problem Types & Techniques", "zh-CN": "题目类型与技巧", ja: "問題形式と技法" }, /.*/],
];

export const oiAlgorithmTagCategories = Object.freeze(tagCategoryDefinitions.map((definition, index) => ({
  id: definition[0],
  label: definition[1],
  tags: oiAlgorithmTags.filter((tag) => {
    const firstMatch = tagCategoryDefinitions.findIndex((definition) => definition[2].test(tag));
    return firstMatch === index;
  }),
})));

const allowedTagSet = new Set(oiAlgorithmTags);

export class OjValidationError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function text(value, maximum) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").trim().slice(0, maximum)
    : "";
}

export function validateOjProblem(value) {
  if (!value || typeof value !== "object") {
    throw new OjValidationError("INVALID_OJ_PROBLEM");
  }
  const title = text(value.title, 160);
  let statementDocument;
  try {
    statementDocument = validateEditorialContent(value.statement, value.statementFormat);
  } catch (error) {
    if (error instanceof EditorialContentError) throw new OjValidationError(error.code);
    throw error;
  }
  const statement = statementDocument.content;
  const statementFormat = statementDocument.contentFormat;
  const stdSource = typeof value.stdSource === "string"
    ? value.stdSource.replace(/\u0000/g, "").slice(0, 64 * 1024)
    : "";
  if (title.length < 3) throw new OjValidationError("OJ_TITLE_REQUIRED");
  if (statementDocument.textLength < 20) throw new OjValidationError("OJ_STATEMENT_REQUIRED");
  if (!stdSource.trim()) throw new OjValidationError("OJ_STD_REQUIRED");

  const timeLimitMs = Math.round(Number(value.timeLimitMs));
  const memoryLimitMb = Math.round(Number(value.memoryLimitMb));
  const difficulty = Math.round(Number(value.difficulty));
  if (!Number.isFinite(timeLimitMs) || timeLimitMs < 100 || timeLimitMs > 10000) {
    throw new OjValidationError("INVALID_OJ_TIME_LIMIT");
  }
  if (!Number.isFinite(memoryLimitMb) || memoryLimitMb < 16 || memoryLimitMb > 512) {
    throw new OjValidationError("INVALID_OJ_MEMORY_LIMIT");
  }
  if (!Number.isFinite(difficulty) || difficulty < 1 || difficulty > 10) {
    throw new OjValidationError("INVALID_OJ_DIFFICULTY");
  }

  const tags = Array.isArray(value.tags)
    ? [...new Set(value.tags.filter((tag) => typeof tag === "string"))]
    : [];
  if (!tags.length || tags.length > 12 || tags.some((tag) => !allowedTagSet.has(tag))) {
    throw new OjValidationError("INVALID_OJ_TAGS");
  }

  if (!Array.isArray(value.tests) || value.tests.length < 1 || value.tests.length > 50) {
    throw new OjValidationError("INVALID_OJ_TESTS");
  }
  const tests = value.tests.map((testCase, index) => {
    if (
      !testCase || typeof testCase.input !== "string" ||
      typeof testCase.expected !== "string" ||
      Buffer.byteLength(testCase.input, "utf8") > 64 * 1024 ||
      Buffer.byteLength(testCase.expected, "utf8") > 64 * 1024
    ) {
      throw new OjValidationError("INVALID_OJ_TEST_CASE");
    }
    return {
      id: String(index + 1).padStart(2, "0"),
      input: testCase.input,
      expected: testCase.expected,
      sample: testCase.sample === true,
    };
  });
  if (!tests.some((testCase) => testCase.sample)) {
    throw new OjValidationError("OJ_SAMPLE_REQUIRED");
  }

  return { title, statement, statementFormat, timeLimitMs, memoryLimitMb, difficulty, tags, tests, stdSource };
}

export function publicOjProblem(problem, { includeStatement = true } = {}) {
  return {
    publicId: problem.publicId,
    title: problem.title,
    ...(includeStatement ? { statement: problem.statement, statementFormat: problem.statementFormat ?? "plain" } : {}),
    timeLimitMs: problem.timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb,
    difficulty: problem.difficulty,
    tags: problem.tags,
    author: problem.author,
    submissionCount: problem.submissionCount ?? 0,
    acceptedCount: problem.acceptedCount ?? 0,
    samples: includeStatement
      ? problem.tests.filter((testCase) => testCase.sample).map(({ id, input, expected }, index) => ({ id: id ?? String(index + 1).padStart(2, "0"), input, output: expected }))
      : undefined,
    createdAt: problem.createdAt,
    publishedAt: problem.publishedAt,
  };
}

export function trustedOjQuest(problem) {
  return {
    language: "cpp14",
    timeLimitMs: problem.timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb,
    compileLimitMs: 15000,
    passScore: 100,
    tests: problem.tests.map(({ id, input, expected, sample }) => ({ id, input, expected, sample })),
  };
}
