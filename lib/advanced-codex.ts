import type { CodexCategory, CodexEntry, LocalizedText } from "@/lib/codex";

type Seed = {
  id: string;
  questId: string;
  marker: string;
  category: CodexCategory;
  title: LocalizedText;
  summary: LocalizedText;
  time: string;
  space: string;
  tags: string[];
  code: string;
};

const checkpointLabels = {
  en: ["State the invariant before coding.", "Test the smallest valid input.", "Check integer range and complexity."],
  "zh-CN": ["编码前先说清不变量。", "测试最小合法输入。", "检查整数范围和复杂度。"],
  ja: ["実装前に不変条件を言語化する。", "最小の有効入力を試す。", "整数範囲と計算量を確認する。"],
} as const;

function entry(seed: Seed): CodexEntry {
  return {
    ...seed,
    explanation: seed.summary,
    checkpoints: [0, 1, 2].map((index) => ({
      en: checkpointLabels.en[index],
      "zh-CN": checkpointLabels["zh-CN"][index],
      ja: checkpointLabels.ja[index],
    })),
    timeComplexity: seed.time,
    spaceComplexity: seed.space,
  };
}

export const advancedCodexEntries: CodexEntry[] = [
  entry({ id: "binary-exponentiation", questId: "recursive-mirror", marker: "13", category: "algorithms", title: { en: "Binary exponentiation", "zh-CN": "二进制快速幂", ja: "二分累乗" }, summary: { en: "Halve the exponent and reuse the squared half-result to compute powers in logarithmic time.", "zh-CN": "不断折半指数并复用平方结果，在对数时间内计算幂。", ja: "指数を半分にし、半分の答えの平方を再利用して対数時間でべき乗する。" }, time: "O(log b)", space: "O(log b) recursive / O(1) iterative", tags: ["recursion", "power", "modulo"], code: "long long half = modPow(a, b / 2);\nreturn half * half % MOD * (b & 1 ? a : 1) % MOD;" }),
  entry({ id: "interval-greedy", questId: "greedy-caravan", marker: "14", category: "algorithms", title: { en: "Interval scheduling", "zh-CN": "区间调度贪心", ja: "区間スケジューリング" }, summary: { en: "Choosing the interval that finishes first leaves at least as much room as any competing choice.", "zh-CN": "选择最早结束的区间，不会比任何其他选择给后续留下更少空间。", ja: "最も早く終わる区間を選ぶと、他の選択以上の余地が後続に残る。" }, time: "O(n log n)", space: "O(n)", tags: ["greedy", "intervals", "sorting"], code: "sort(intervals.begin(), intervals.end(), byEnd);\nfor (auto [l,r] : intervals) if (l >= last) ++answer, last = r;" }),
  entry({ id: "zero-one-knapsack", questId: "knapsack-forge", marker: "15", category: "algorithms", title: { en: "0/1 knapsack", "zh-CN": "0/1 背包", ja: "0/1 ナップサック" }, summary: { en: "One-dimensional DP with descending capacity ensures every item is used at most once.", "zh-CN": "容量倒序的一维 DP 保证每件物品最多使用一次。", ja: "容量を逆順に更新する一次元 DP で、各品物を一度だけ使う。" }, time: "O(nW)", space: "O(W)", tags: ["DP", "knapsack", "state compression"], code: "for (auto [w,v] : items)\n  for (int c=W; c>=w; --c) dp[c]=max(dp[c],dp[c-w]+v);" }),
  entry({ id: "lis", questId: "lis-observatory", marker: "16", category: "algorithms", title: { en: "Longest increasing subsequence", "zh-CN": "最长上升子序列", ja: "最長増加部分列" }, summary: { en: "Maintain the smallest possible tail for every length and place each value with lower_bound.", "zh-CN": "维护每种长度的最小结尾，并用 lower_bound 放置每个数。", ja: "各長さの最小末尾を保ち、lower_bound で各値を配置する。" }, time: "O(n log n)", space: "O(n)", tags: ["LIS", "binary search", "tails"], code: "auto it=lower_bound(tails.begin(),tails.end(),x);\nif(it==tails.end()) tails.push_back(x); else *it=x;" }),
  entry({ id: "minimum-spanning-tree", questId: "mst-skybridge", marker: "17", category: "graphs", title: { en: "Kruskal minimum spanning tree", "zh-CN": "Kruskal 最小生成树", ja: "Kruskal 最小全域木" }, summary: { en: "Scan edges from lightest to heaviest and use DSU to reject cycles.", "zh-CN": "从小到大扫描边，用并查集拒绝产生环的边。", ja: "軽い辺から走査し、DSU で閉路になる辺を拒否する。" }, time: "O(E log E)", space: "O(V + E)", tags: ["MST", "Kruskal", "DSU"], code: "sort(edges.begin(), edges.end());\nfor(auto [w,u,v]:edges) if(dsu.unite(u,v)) cost+=w;" }),
  entry({ id: "fenwick-tree", questId: "fenwick-pulse", marker: "18", category: "data-structures", title: { en: "Fenwick tree", "zh-CN": "树状数组", ja: "Fenwick 木" }, summary: { en: "The lowest set bit partitions prefixes so point updates and prefix queries both take logarithmic time.", "zh-CN": "最低位 1 将前缀划分，使单点修改和前缀查询都只需对数时间。", ja: "最下位ビットで接頭辞を分割し、一点更新と接頭辞和を対数時間で行う。" }, time: "O(log n) per operation", space: "O(n)", tags: ["BIT", "prefix sum", "updates"], code: "for(;i<=n;i+=i&-i) bit[i]+=delta;\nfor(;i;i-=i&-i) sum+=bit[i];" }),
  entry({ id: "segment-tree", questId: "segment-bastion", marker: "19", category: "data-structures", title: { en: "Segment tree", "zh-CN": "线段树", ja: "セグメント木" }, summary: { en: "Store an associative aggregate for every segment and visit only logarithmically many boundary nodes.", "zh-CN": "为每个区间保存可结合的信息，查询时只访问对数级边界节点。", ja: "各区間に結合可能な集約値を持ち、境界の対数個ノードだけを訪れる。" }, time: "O(log n) per operation", space: "O(n)", tags: ["segment tree", "RMQ", "updates"], code: "tree[p]=value;\nfor(p>>=1;p;p>>=1) tree[p]=min(tree[p<<1],tree[p<<1|1]);" }),
  entry({ id: "binary-lifting-lca", questId: "lca-oracle", marker: "20", category: "graphs", title: { en: "LCA with binary lifting", "zh-CN": "倍增求 LCA", ja: "ダブリング LCA" }, summary: { en: "Precompute power-of-two ancestors, equalize depth, then lift both vertices together.", "zh-CN": "预处理 2 的幂次祖先，先抬平深度，再同步向上跳。", ja: "2 の冪個上の祖先を前計算し、深さを揃えて二頂点を同時に上げる。" }, time: "O((n+q) log n)", space: "O(n log n)", tags: ["tree", "LCA", "binary lifting"], code: "for(int k=LOG-1;k>=0;--k)\n  if(up[k][u]!=up[k][v]) u=up[k][u],v=up[k][v];" }),
  entry({ id: "strongly-connected-components", questId: "scc-nexus", marker: "21", category: "graphs", title: { en: "Strongly connected components", "zh-CN": "强连通分量", ja: "強連結成分" }, summary: { en: "Kosaraju uses finish order and a reversed graph to isolate every maximal mutually reachable component.", "zh-CN": "Kosaraju 利用完成顺序与反图，分离每个极大互相可达分量。", ja: "Kosaraju は終了順と逆グラフで、相互到達可能な極大成分を分離する。" }, time: "O(V + E)", space: "O(V + E)", tags: ["SCC", "Kosaraju", "condensation"], code: "dfs1(u); // finish order\nreverse(order.begin(),order.end());\nfor(int u:order) if(!component[u]) dfs2(u);" }),
  entry({ id: "dinic-max-flow", questId: "maxflow-reactor", marker: "22", category: "graphs", title: { en: "Dinic maximum flow", "zh-CN": "Dinic 最大流", ja: "Dinic 最大流" }, summary: { en: "Repeated level graphs and blocking flows push many augmenting paths in each phase.", "zh-CN": "反复建立分层图并发送阻塞流，在每阶段同时推进多条增广路。", ja: "レベルグラフとブロッキングフローを反復し、各段階で多数の増加路を流す。" }, time: "O(V²E) general", space: "O(V + E)", tags: ["max flow", "Dinic", "residual graph"], code: "while(bfsLevels()) { fill(ptr.begin(),ptr.end(),0); while(long long pushed=dfs(s,INF)) flow+=pushed; }" }),
];
