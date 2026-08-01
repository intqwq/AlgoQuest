export const oiAlgorithmTags = Object.freeze([
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
]);

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
  const statement = text(value.statement, 100 * 1024);
  const stdSource = typeof value.stdSource === "string"
    ? value.stdSource.replace(/\u0000/g, "").slice(0, 64 * 1024)
    : "";
  if (title.length < 3) throw new OjValidationError("OJ_TITLE_REQUIRED");
  if (statement.length < 20) throw new OjValidationError("OJ_STATEMENT_REQUIRED");
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

  return { title, statement, timeLimitMs, memoryLimitMb, difficulty, tags, tests, stdSource };
}

export function publicOjProblem(problem, { includeStatement = true } = {}) {
  return {
    publicId: problem.publicId,
    title: problem.title,
    ...(includeStatement ? { statement: problem.statement } : {}),
    timeLimitMs: problem.timeLimitMs,
    memoryLimitMb: problem.memoryLimitMb,
    difficulty: problem.difficulty,
    tags: problem.tags,
    author: problem.author,
    submissionCount: problem.submissionCount ?? 0,
    acceptedCount: problem.acceptedCount ?? 0,
    samples: includeStatement
      ? problem.tests.filter((testCase) => testCase.sample).map(({ input, expected }) => ({ input, output: expected }))
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
    tests: problem.tests.map(({ id, input, expected }) => ({ id, input, expected })),
  };
}
