import type { Quest } from "@/lib/quests";

type AdvancedQuest = Omit<Quest, "status" | "gridArea">;

function advancedQuest(quest: AdvancedQuest): Quest {
  return {
    ...quest,
    status: "locked",
    gridArea: `advanced-${quest.index}`,
  };
}

export const advancedQuests: Quest[] = [
  advancedQuest({
    id: "recursive-mirror",
    index: "13",
    title: "Recursive Mirror",
    subtitle: "Fast exponentiation",
    difficulty: 3,
    xp: 680,
    prerequisites: ["topological-crown"],
    chapter: "CH.06 / DEEP PATTERNS",
    mapPosition: { x: 82, y: 34 },
    description: "Fold an enormous exponent through a logarithmic recursive mirror.",
    skills: ["recursion", "binary exponentiation", "modulo"],
    sortOrder: 13,
    problem: {
      story: [
        "A mirror engine must multiply a by itself b times, but b is far too large for a linear ritual.",
        "Split the exponent in half, reuse the reflected answer, and return a^b modulo 1,000,000,007.",
      ],
      guidance: [
        "Use f(a, 0) = 1 as the base case.",
        "Compute half = f(a, b / 2) only once, then square it.",
        "If b is odd, multiply by a one more time. Keep every product modulo MOD.",
      ],
      input: "Two integers a and b.",
      constraints: "0 ≤ a ≤ 10^18; 0 ≤ b ≤ 10^18",
      output: "Print a^b modulo 1,000,000,007.",
      sampleInput: "2 10",
      sampleOutput: "1024",
      hint: "The recursion depth is only O(log b). Use __int128 or reduce a before multiplication.",
      hintMarker: "    // TODO: reflect the exponent",
      hintCode: "    cout << modPow(a % MOD, b) << '\\n';",
      starterCode: `#include <bits/stdc++.h>
using namespace std;
const long long MOD = 1000000007LL;

long long modPow(long long a, unsigned long long b) {
    // TODO: implement logarithmic recursion
    return 0;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    unsigned long long a, b;
    cin >> a >> b;
    // TODO: reflect the exponent
    return 0;
}`,
      testCaseCount: 6,
      passScore: 100,
      timeLimitSeconds: 1,
      memoryLimitMb: 64,
    },
    translations: {
      "zh-CN": {
        title: "递归魔镜", subtitle: "快速幂", chapter: "第 06 章 / 深层规律",
        description: "用对数级递归折叠巨大的指数。", skills: ["递归", "二进制快速幂", "取模"],
        problem: {
          story: ["魔镜引擎要把 a 连乘 b 次，但线性咒式根本来不及。", "把指数折半、复用镜像答案，并输出 a^b 对 1,000,000,007 取模。"],
          guidance: ["递归边界是 f(a, 0) = 1。", "只计算一次 f(a, b / 2)，再平方。", "若 b 为奇数，再乘一次 a；每步都取模。"],
          input: "两个整数 a 和 b。", constraints: "0 ≤ a ≤ 10^18；0 ≤ b ≤ 10^18", output: "输出 a^b mod 1,000,000,007。", hint: "递归深度只有 O(log b)，乘法前先取模。",
        },
      },
      ja: {
        title: "再帰の鏡", subtitle: "高速べき乗", chapter: "第06章 / 深層パターン",
        description: "巨大な指数を対数再帰で折り畳みます。", skills: ["再帰", "二分累乗", "剰余"],
        problem: {
          story: ["鏡の機関は a を b 回掛けたいのですが、線形処理では間に合いません。", "指数を半分にして答えを再利用し、a^b mod 1,000,000,007 を求めます。"],
          guidance: ["基底は f(a, 0) = 1 です。", "f(a, b / 2) は一度だけ計算して二乗します。", "b が奇数なら a をもう一度掛け、毎回剰余を取ります。"],
          input: "整数 a, b。", constraints: "0 ≤ a ≤ 10^18、0 ≤ b ≤ 10^18", output: "a^b mod 1,000,000,007 を出力。", hint: "再帰深度は O(log b) です。",
        },
      },
    },
  }),
  advancedQuest({
    id: "greedy-caravan",
    index: "14",
    title: "Greedy Caravan",
    subtitle: "Interval scheduling",
    difficulty: 3,
    xp: 720,
    prerequisites: ["recursive-mirror"],
    chapter: "CH.06 / DEEP PATTERNS",
    mapPosition: { x: 66, y: 46 },
    description: "Choose the largest set of non-overlapping caravan routes.",
    skills: ["greedy", "sorting", "exchange argument"],
    sortOrder: 14,
    problem: {
      story: ["Each caravan requests a half-open gate interval [l, r). Only one may occupy the gate at a time.", "Accept as many caravans as possible before the sandstorm arrives."],
      guidance: ["Sort intervals by increasing end time.", "Take an interval when its start is at least the end of the last chosen one.", "The earliest finishing choice leaves the most room for every later interval."],
      input: "n, followed by n lines l r describing [l, r).",
      constraints: "1 ≤ n ≤ 200,000; -10^9 ≤ l < r ≤ 10^9",
      output: "Print the maximum number of non-overlapping intervals.",
      sampleInput: "5\n1 3\n2 5\n3 4\n4 7\n6 8",
      sampleOutput: "3",
      hint: "This greedy proof depends on the finishing time, not the starting time or interval length.",
      hintMarker: "    // TODO: schedule the caravan",
      hintCode: "    sort(intervals.begin(), intervals.end(), [](auto a, auto b) { return tie(a.second, a.first) < tie(b.second, b.first); });",
      starterCode: `#include <bits/stdc++.h>
using namespace std;
int main() {
    ios::sync_with_stdio(false); cin.tie(nullptr);
    int n; cin >> n;
    vector<pair<long long,long long>> intervals(n);
    for (auto &[l, r] : intervals) cin >> l >> r;
    // TODO: schedule the caravan
    return 0;
}`,
      testCaseCount: 5, passScore: 100, timeLimitSeconds: 2, memoryLimitMb: 96,
    },
    translations: {
      "zh-CN": { title: "贪心商队", subtitle: "区间调度", chapter: "第 06 章 / 深层规律", description: "选择最多的不重叠商队路线。", skills: ["贪心", "排序", "交换论证"], problem: { story: ["每支商队申请一个半开通行区间 [l, r)，同一时刻大门只能容纳一队。", "在沙暴到来前接纳尽可能多的商队。"], guidance: ["按结束时间从小到大排序。", "当新区间起点不小于上个区间终点时选择它。", "最早结束会为后续留下最多空间。"], input: "n，随后 n 行区间 l r。", constraints: "1 ≤ n ≤ 200,000；-10^9 ≤ l < r ≤ 10^9", output: "输出最多可选区间数。", hint: "关键是结束时间，而不是开始时间或区间长度。" } },
      ja: { title: "貪欲の隊商", subtitle: "区間スケジューリング", chapter: "第06章 / 深層パターン", description: "重ならない隊商ルートを最大数選びます。", skills: ["貪欲法", "ソート", "交換論法"], problem: { story: ["各隊商は半開区間 [l, r) を要求し、門は同時に一隊しか通せません。", "砂嵐までに最大数の隊商を通します。"], guidance: ["終了時刻の昇順に並べます。", "開始時刻が最後の終了時刻以上なら選びます。", "最も早く終わる選択が後続の余地を最大化します。"], input: "n と n 個の区間 l r。", constraints: "1 ≤ n ≤ 200,000、-10^9 ≤ l < r ≤ 10^9", output: "選べる区間の最大数。", hint: "開始時刻ではなく終了時刻で選びます。" } },
    },
  }),
  advancedQuest({
    id: "knapsack-forge", index: "15", title: "Knapsack Forge", subtitle: "0/1 dynamic programming", difficulty: 4, xp: 820,
    prerequisites: ["greedy-caravan"], chapter: "CH.07 / STATE MACHINES", mapPosition: { x: 48, y: 58 },
    description: "Forge the most valuable load without exceeding the reactor capacity.", skills: ["dynamic programming", "0/1 knapsack", "state compression"], sortOrder: 15,
    problem: {
      story: ["The forge offers n artifacts. Artifact i weighs wi and stores vi energy; each exists only once.", "Choose a load of total weight at most W with maximum energy."],
      guidance: ["Let dp[c] be the best value using capacity c.", "For every item, iterate c from W down to wi so the item cannot be reused.", "The answer is the largest dp[c] for 0 ≤ c ≤ W."],
      input: "n and W, followed by n lines wi vi.", constraints: "1 ≤ n ≤ 2,000; 1 ≤ W ≤ 20,000; 1 ≤ wi ≤ W; 0 ≤ vi ≤ 10^9", output: "Print the maximum total value.", sampleInput: "4 7\n6 13\n4 8\n3 6\n5 12", sampleOutput: "14",
      hint: "Descending capacity is the tiny detail separating 0/1 knapsack from unbounded knapsack.", hintMarker: "    // TODO: ignite the forge", hintCode: "    for (auto [w, v] : items) for (int c = W; c >= w; --c) dp[c] = max(dp[c], dp[c-w] + v);",
      starterCode: `#include <bits/stdc++.h>
using namespace std;
int main(){
    ios::sync_with_stdio(false); cin.tie(nullptr);
    int n, W; cin >> n >> W;
    vector<pair<int,long long>> items(n);
    for(auto &[w,v]:items) cin >> w >> v;
    vector<long long> dp(W+1);
    // TODO: ignite the forge
    return 0;
}`,
      testCaseCount: 6, passScore: 100, timeLimitSeconds: 2, memoryLimitMb: 128,
    },
    translations: {
      "zh-CN": { title: "背包锻炉", subtitle: "0/1 动态规划", chapter: "第 07 章 / 状态机器", description: "不超过反应炉容量，锻造价值最高的装载方案。", skills: ["动态规划", "0/1 背包", "状态压缩"], problem: { story: ["锻炉前有 n 件遗物，第 i 件重量 wi、能量 vi，且只有一件。", "在总重量不超过 W 的条件下最大化能量。"], guidance: ["令 dp[c] 表示容量 c 的最大价值。", "每件物品将容量从 W 倒序枚举到 wi，避免重复使用。", "答案是所有 dp[c] 的最大值。"], input: "n、W，随后 n 行 wi vi。", constraints: "1 ≤ n ≤ 2,000；1 ≤ W ≤ 20,000", output: "输出最大总价值。", hint: "容量倒序是 0/1 背包与完全背包的关键区别。" } },
      ja: { title: "ナップサック炉", subtitle: "0/1 動的計画法", chapter: "第07章 / 状態機械", description: "容量を超えず価値最大の積荷を作ります。", skills: ["動的計画法", "0/1 ナップサック", "状態圧縮"], problem: { story: ["n 個の遺物は重さ wi、価値 vi で、それぞれ一度だけ使えます。", "総重量 W 以下で価値を最大化します。"], guidance: ["dp[c] を容量 c の最大価値とします。", "各品物で c を W から wi へ逆順に更新します。", "全 dp[c] の最大値が答えです。"], input: "n, W と n 行の wi vi。", constraints: "1 ≤ n ≤ 2,000、1 ≤ W ≤ 20,000", output: "最大価値を出力。", hint: "容量の逆順更新が 0/1 ナップサックの核心です。" } },
    },
  }),
  advancedQuest({
    id: "lis-observatory", index: "16", title: "LIS Observatory", subtitle: "Longest increasing subsequence", difficulty: 4, xp: 860,
    prerequisites: ["knapsack-forge"], chapter: "CH.07 / STATE MACHINES", mapPosition: { x: 30, y: 70 },
    description: "Track the longest strictly rising signal in O(n log n).", skills: ["LIS", "binary search", "invariants"], sortOrder: 16,
    problem: {
      story: ["The observatory records n signal heights. Noise may be discarded, but the remaining order cannot change.", "Find the longest strictly increasing subsequence."],
      guidance: ["Maintain tails[len]: the smallest possible final value of a subsequence of each length.", "For every x, lower_bound finds the first tail at least x.", "Replace that tail or append x; the vector length is the answer."],
      input: "n followed by n integers.", constraints: "1 ≤ n ≤ 500,000; |ai| ≤ 10^9", output: "Print the LIS length.", sampleInput: "8\n10 9 2 5 3 7 101 18", sampleOutput: "4", hint: "Strictly increasing uses lower_bound; non-decreasing would use upper_bound.", hintMarker: "    // TODO: align the telescope", hintCode: "    for (long long x : a) { auto it = lower_bound(tails.begin(), tails.end(), x); if (it == tails.end()) tails.push_back(x); else *it = x; }",
      starterCode: `#include <bits/stdc++.h>
using namespace std;
int main(){
    ios::sync_with_stdio(false); cin.tie(nullptr);
    int n; cin >> n; vector<long long> a(n), tails;
    for(auto &x:a) cin >> x;
    // TODO: align the telescope
    return 0;
}`,
      testCaseCount: 6, passScore: 100, timeLimitSeconds: 2, memoryLimitMb: 128,
    },
    translations: {
      "zh-CN": { title: "LIS 观测站", subtitle: "最长上升子序列", chapter: "第 07 章 / 状态机器", description: "在 O(n log n) 内追踪最长严格上升信号。", skills: ["LIS", "二分", "不变量"], problem: { story: ["观测站记录 n 个信号高度，可以丢弃噪声，但不能改变剩余顺序。", "求最长严格上升子序列长度。"], guidance: ["维护 tails[len]：对应长度子序列的最小结尾。", "对每个 x 用 lower_bound 找到首个 ≥ x 的结尾。", "替换或追加 x，tails 长度即答案。"], input: "n 和 n 个整数。", constraints: "1 ≤ n ≤ 500,000；|ai| ≤ 10^9", output: "输出 LIS 长度。", hint: "严格上升使用 lower_bound；不降序才使用 upper_bound。" } },
      ja: { title: "LIS 観測所", subtitle: "最長増加部分列", chapter: "第07章 / 状態機械", description: "O(n log n) で最長の増加信号を追跡します。", skills: ["LIS", "二分探索", "不変条件"], problem: { story: ["n 個の信号から雑音を捨てられますが、順序は変えられません。", "最長狭義増加部分列の長さを求めます。"], guidance: ["tails[len] に各長さの最小末尾を保持します。", "各 x に lower_bound を使います。", "置換または追加し、tails の長さを答えます。"], input: "n と n 個の整数。", constraints: "1 ≤ n ≤ 500,000、|ai| ≤ 10^9", output: "LIS の長さ。", hint: "狭義増加には lower_bound を使います。" } },
    },
  }),
  advancedQuest({
    id: "mst-skybridge", index: "17", title: "Skybridge Protocol", subtitle: "Minimum spanning tree", difficulty: 4, xp: 940,
    prerequisites: ["lis-observatory"], chapter: "CH.08 / GREAT NETWORKS", mapPosition: { x: 16, y: 82 },
    description: "Connect every floating island for the minimum total cost.", skills: ["Kruskal", "minimum spanning tree", "DSU"], sortOrder: 17,
    problem: {
      story: ["n floating islands can be linked by m candidate bridges, each with a construction cost.", "Connect all islands as cheaply as possible, or report that the sky cannot be united."],
      guidance: ["Sort edges by increasing weight.", "Use DSU to accept an edge only when it joins two different components.", "A connected MST uses exactly n - 1 edges."],
      input: "n m followed by m undirected weighted edges u v w.", constraints: "1 ≤ n ≤ 200,000; 0 ≤ m ≤ 400,000; |w| ≤ 10^9", output: "Minimum spanning-tree cost, or -1 if disconnected.", sampleInput: "4 5\n1 2 3\n2 3 1\n3 4 4\n1 4 10\n1 3 2", sampleOutput: "7", hint: "Kruskal remains valid with negative edge weights.", hintMarker: "    // TODO: raise the skybridge", hintCode: "    sort(edges.begin(), edges.end()); // weight first",
      starterCode: `#include <bits/stdc++.h>
using namespace std;
struct DSU{ vector<int> p,s; DSU(int n):p(n+1),s(n+1,1){iota(p.begin(),p.end(),0);} int find(int x){return p[x]==x?x:p[x]=find(p[x]);} bool unite(int a,int b){a=find(a);b=find(b);if(a==b)return false;if(s[a]<s[b])swap(a,b);p[b]=a;s[a]+=s[b];return true;} };
int main(){
    ios::sync_with_stdio(false); cin.tie(nullptr);
    int n,m; cin>>n>>m; vector<tuple<long long,int,int>> edges(m);
    for(auto &[w,u,v]:edges) cin>>u>>v>>w;
    // TODO: raise the skybridge
    return 0;
}`,
      testCaseCount: 5, passScore: 100, timeLimitSeconds: 2, memoryLimitMb: 160,
    },
    translations: {
      "zh-CN": { title: "天桥协议", subtitle: "最小生成树", chapter: "第 08 章 / 巨型网络", description: "以最小总代价连接所有浮空岛。", skills: ["Kruskal", "最小生成树", "并查集"], problem: { story: ["n 座浮空岛之间有 m 条候选桥梁，每条都有造价。", "以最低费用连接全部岛屿；若无法连通则报告失败。"], guidance: ["按边权从小到大排序。", "用并查集只选择连接不同连通块的边。", "连通的生成树恰有 n-1 条边。"], input: "n m，随后 m 条无向带权边 u v w。", constraints: "1 ≤ n ≤ 200,000；0 ≤ m ≤ 400,000", output: "输出 MST 总权值，不连通输出 -1。", hint: "Kruskal 同样适用于负边权。" } },
      ja: { title: "天空橋プロトコル", subtitle: "最小全域木", chapter: "第08章 / 巨大ネットワーク", description: "浮島を最小コストで接続します。", skills: ["Kruskal", "最小全域木", "DSU"], problem: { story: ["n 個の浮島と m 本の候補橋があり、各橋に建設費があります。", "全島を最小費用で結び、不可能なら失敗を報告します。"], guidance: ["辺を重みの昇順に並べます。", "DSU で異なる成分を結ぶ辺だけ採用します。", "連結な MST は n-1 辺です。"], input: "n m と m 本の無向重み付き辺。", constraints: "1 ≤ n ≤ 200,000、0 ≤ m ≤ 400,000", output: "MST コスト。不連結なら -1。", hint: "Kruskal は負の辺にも使えます。" } },
    },
  }),
  advancedQuest({
    id: "fenwick-pulse", index: "18", title: "Fenwick Pulse", subtitle: "Dynamic prefix sums", difficulty: 4, xp: 980,
    prerequisites: ["mst-skybridge"], chapter: "CH.09 / DATA ENGINES", mapPosition: { x: 28, y: 91 },
    description: "Maintain changing signal sums with a binary indexed tree.", skills: ["Fenwick tree", "point update", "range sum"], sortOrder: 18,
    problem: {
      story: ["A pulse line contains n mutable cells. Updates add energy to one cell; scans ask for a range total.", "Answer every scan online without rebuilding the entire prefix array."],
      guidance: ["Fenwick add walks i += i & -i.", "Prefix sum walks i -= i & -i.", "A range sum is prefix(r) - prefix(l - 1)."],
      input: "n q, initial array, then U i delta or Q l r.", constraints: "1 ≤ n,q ≤ 200,000; values and deltas fit signed 64-bit totals", output: "For each Q, print the range sum.", sampleInput: "5 4\n1 2 3 4 5\nQ 2 4\nU 3 10\nQ 1 3\nQ 3 5", sampleOutput: "9\n16\n22", hint: "Use long long for the tree even if each input value fits int.", hintMarker: "    // TODO: route the pulse", hintCode: "    auto sum = [&](int i){ long long s=0; for(;i;i-=i&-i)s+=bit[i]; return s; };",
      starterCode: `#include <bits/stdc++.h>
using namespace std;
int main(){
    ios::sync_with_stdio(false); cin.tie(nullptr);
    int n,q; cin>>n>>q; vector<long long> bit(n+1);
    auto add=[&](int i,long long x){ for(;i<=n;i+=i&-i) bit[i]+=x; };
    for(int i=1;i<=n;++i){long long x;cin>>x;add(i,x);}
    // TODO: route the pulse
    return 0;
}`,
      testCaseCount: 5, passScore: 100, timeLimitSeconds: 2, memoryLimitMb: 128,
    },
    translations: {
      "zh-CN": { title: "树状脉冲", subtitle: "动态前缀和", chapter: "第 09 章 / 数据引擎", description: "用树状数组维护不断变化的区间和。", skills: ["树状数组", "单点修改", "区间和"], problem: { story: ["脉冲线有 n 个可变单元，更新为一个位置增加能量，扫描询问区间总和。", "在线回答所有扫描，不能每次重建前缀和。"], guidance: ["add 沿 i += i & -i 向上。", "前缀查询沿 i -= i & -i 向下。", "区间和是 sum(r)-sum(l-1)。"], input: "n q、初始数组，随后 U i delta 或 Q l r。", constraints: "1 ≤ n,q ≤ 200,000", output: "每个 Q 输出区间和。", hint: "树状数组使用 long long。" } },
      ja: { title: "Fenwick パルス", subtitle: "動的累積和", chapter: "第09章 / データエンジン", description: "BIT で変化する区間和を管理します。", skills: ["Fenwick 木", "一点更新", "区間和"], problem: { story: ["n 個のセルへの加算更新と区間合計の問い合わせを処理します。", "累積和を作り直さずオンラインで答えます。"], guidance: ["add は i += i & -i で進みます。", "prefix は i -= i & -i で進みます。", "区間和は sum(r)-sum(l-1) です。"], input: "n q、初期配列、U i delta または Q l r。", constraints: "1 ≤ n,q ≤ 200,000", output: "各 Q の区間和。", hint: "木には long long を使います。" } },
    },
  }),
  advancedQuest({
    id: "segment-bastion", index: "19", title: "Segment Bastion", subtitle: "Range minimum engine", difficulty: 5, xp: 1080,
    prerequisites: ["fenwick-pulse"], chapter: "CH.09 / DATA ENGINES", mapPosition: { x: 48, y: 84 },
    description: "Defend mutable ranges with a segment tree.", skills: ["segment tree", "range query", "point assignment"], sortOrder: 19,
    problem: {
      story: ["The bastion monitors n wall strengths. A repair sets one wall; an alarm asks for the weakest wall in [l, r].", "Process repairs and alarms online."],
      guidance: ["Store the minimum of each segment at its node.", "A point assignment updates one root-to-leaf path.", "A query combines only nodes fully covered by [l, r]."],
      input: "n q, array, then S i x or Q l r.", constraints: "1 ≤ n,q ≤ 200,000; |ai|,|x| ≤ 10^9", output: "For each Q, print the minimum.", sampleInput: "5 4\n8 6 7 5 3\nQ 2 4\nS 5 9\nQ 3 5\nQ 1 1", sampleOutput: "5\n5\n8", hint: "For an iterative tree, place leaves at indices [size, size+n).", hintMarker: "    // TODO: arm the bastion", hintCode: "    // merge covered nodes with min(leftAnswer, rightAnswer)",
      starterCode: `#include <bits/stdc++.h>
using namespace std;
int main(){
    ios::sync_with_stdio(false); cin.tie(nullptr);
    int n,q; cin>>n>>q; int size=1; while(size<n) size*=2;
    const long long INF=4e18; vector<long long> tree(2*size,INF);
    for(int i=0;i<n;++i) cin>>tree[size+i];
    for(int i=size-1;i;--i) tree[i]=min(tree[2*i],tree[2*i+1]);
    // TODO: arm the bastion
    return 0;
}`,
      testCaseCount: 5, passScore: 100, timeLimitSeconds: 2, memoryLimitMb: 192,
    },
    translations: {
      "zh-CN": { title: "线段堡垒", subtitle: "区间最小值引擎", chapter: "第 09 章 / 数据引擎", description: "用线段树守卫可修改区间。", skills: ["线段树", "区间查询", "单点赋值"], problem: { story: ["堡垒监控 n 段城墙，修复会设置一个位置，警报询问 [l,r] 中最弱处。", "在线处理所有修复与警报。"], guidance: ["每个节点存对应区间最小值。", "单点赋值只更新一条根到叶路径。", "查询只合并被完整覆盖的节点。"], input: "n q、数组，随后 S i x 或 Q l r。", constraints: "1 ≤ n,q ≤ 200,000", output: "每个 Q 输出最小值。", hint: "迭代线段树可把叶子放在 [size,size+n)。" } },
      ja: { title: "セグメント要塞", subtitle: "区間最小エンジン", chapter: "第09章 / データエンジン", description: "セグメント木で可変区間を守ります。", skills: ["セグメント木", "区間クエリ", "一点代入"], problem: { story: ["n 個の壁の更新と [l,r] の最小値問い合わせを処理します。", "修復と警報へオンラインで答えます。"], guidance: ["各ノードに区間最小値を保存します。", "一点更新は根から葉への一本だけ更新します。", "完全に含まれるノードだけ結合します。"], input: "n q、配列、S i x または Q l r。", constraints: "1 ≤ n,q ≤ 200,000", output: "各 Q の最小値。", hint: "反復木では葉を [size,size+n) に置けます。" } },
    },
  }),
  advancedQuest({
    id: "lca-oracle", index: "20", title: "LCA Oracle", subtitle: "Binary lifting on trees", difficulty: 5, xp: 1160,
    prerequisites: ["segment-bastion"], chapter: "CH.10 / ANCIENT TREES", mapPosition: { x: 66, y: 72 },
    description: "Ask the rooted tree for the nearest shared ancestor.", skills: ["LCA", "binary lifting", "tree depth"], sortOrder: 20,
    problem: {
      story: ["An oracle stores a tree rooted at vertex 1. Each question names two descendants.", "Reveal their lowest common ancestor."],
      guidance: ["DFS or BFS computes depth and the 2^0 parent.", "Build up[k][v], the 2^k-th ancestor.", "Lift the deeper vertex, then lift both from the largest power downward."],
      input: "n q, n-1 tree edges, then q queries u v.", constraints: "1 ≤ n,q ≤ 200,000", output: "For each query print LCA(u,v).", sampleInput: "7 3\n1 2\n1 3\n2 4\n2 5\n3 6\n3 7\n4 5\n4 6\n3 7", sampleOutput: "2\n1\n3", hint: "LOG = 20 is not enough for every 200,000-node case; compute it or use about 19 bits plus zero carefully.", hintMarker: "    // TODO: consult the oracle", hintCode: "    // build up[k][v] = up[k-1][ up[k-1][v] ]",
      starterCode: `#include <bits/stdc++.h>
using namespace std;
int main(){
    ios::sync_with_stdio(false); cin.tie(nullptr);
    int n,q; cin>>n>>q; vector<vector<int>> g(n+1);
    for(int i=1,u,v;i<n;++i){cin>>u>>v;g[u].push_back(v);g[v].push_back(u);}
    // TODO: consult the oracle
    return 0;
}`,
      testCaseCount: 5, passScore: 100, timeLimitSeconds: 2, memoryLimitMb: 192,
    },
    translations: {
      "zh-CN": { title: "LCA 神谕", subtitle: "树上倍增", chapter: "第 10 章 / 远古之树", description: "查询有根树中最近的公共祖先。", skills: ["LCA", "倍增", "树深度"], problem: { story: ["神谕保存一棵以 1 为根的树，每次询问给出两个后代。", "找出它们最近的公共祖先。"], guidance: ["DFS/BFS 求深度和直接父亲。", "建立 up[k][v] 表示第 2^k 个祖先。", "先抬平深度，再从大到小同时跳跃。"], input: "n q、n-1 条树边、q 个询问 u v。", constraints: "1 ≤ n,q ≤ 200,000", output: "每次输出 LCA(u,v)。", hint: "根据 n 计算足够大的 LOG。" } },
      ja: { title: "LCA の神託", subtitle: "木のダブリング", chapter: "第10章 / 古代樹", description: "根付き木で最も近い共通祖先を求めます。", skills: ["LCA", "ダブリング", "深さ"], problem: { story: ["根1の木について二頂点の問い合わせが届きます。", "最小共通祖先を答えます。"], guidance: ["DFS/BFS で深さと親を求めます。", "up[k][v] を 2^k 個上の祖先として構築します。", "深さを揃え、大きい k から同時に上げます。"], input: "n q、n-1 辺、q 個の u v。", constraints: "1 ≤ n,q ≤ 200,000", output: "各 LCA(u,v)。", hint: "n に十分な LOG を計算します。" } },
    },
  }),
  advancedQuest({
    id: "scc-nexus", index: "21", title: "SCC Nexus", subtitle: "Strongly connected components", difficulty: 5, xp: 1260,
    prerequisites: ["lca-oracle"], chapter: "CH.11 / GRAPH CORE", mapPosition: { x: 82, y: 60 },
    description: "Compress cycles into a clean directed acyclic core.", skills: ["SCC", "Kosaraju", "graph condensation"], sortOrder: 21,
    problem: {
      story: ["A directed portal network may contain cycles where every chamber can reach every other.", "Count its strongly connected components."],
      guidance: ["First DFS records vertices by finishing time.", "Run DFS on the reversed graph in reverse finishing order.", "Each second-pass DFS discovers exactly one SCC."],
      input: "n m followed by m directed edges u v.", constraints: "1 ≤ n ≤ 200,000; 0 ≤ m ≤ 400,000", output: "Print the number of SCCs.", sampleInput: "5 6\n1 2\n2 1\n2 3\n3 4\n4 3\n4 5", sampleOutput: "3", hint: "For deep graphs, iterative DFS avoids overflowing the C++ call stack.", hintMarker: "    // TODO: stabilize the nexus", hintCode: "    // second pass on reversed graph, following reverse finish order",
      starterCode: `#include <bits/stdc++.h>
using namespace std;
int main(){
    ios::sync_with_stdio(false); cin.tie(nullptr);
    int n,m; cin>>n>>m; vector<vector<int>> g(n+1),rg(n+1);
    while(m--){int u,v;cin>>u>>v;g[u].push_back(v);rg[v].push_back(u);}
    // TODO: stabilize the nexus
    return 0;
}`,
      testCaseCount: 5, passScore: 100, timeLimitSeconds: 3, memoryLimitMb: 256,
    },
    translations: {
      "zh-CN": { title: "强连通枢纽", subtitle: "强连通分量", chapter: "第 11 章 / 图之核心", description: "把环压缩成清晰的有向无环核心。", skills: ["强连通分量", "Kosaraju", "缩点"], problem: { story: ["有向传送网络中可能出现互相可达的循环区域。", "统计强连通分量数量。"], guidance: ["第一次 DFS 按完成时间记录顶点。", "在反图上按完成时间逆序 DFS。", "第二遍每次 DFS 恰好得到一个 SCC。"], input: "n m 和 m 条有向边 u v。", constraints: "1 ≤ n ≤ 200,000；0 ≤ m ≤ 400,000", output: "输出 SCC 数量。", hint: "深图最好使用迭代 DFS，避免调用栈溢出。" } },
      ja: { title: "SCC ネクサス", subtitle: "強連結成分", chapter: "第11章 / グラフ中枢", description: "閉路を圧縮して DAG の核心を作ります。", skills: ["SCC", "Kosaraju", "縮約"], problem: { story: ["有向ポータルには互いに到達できる循環領域があります。", "強連結成分の数を求めます。"], guidance: ["最初の DFS で終了順を記録します。", "逆グラフを終了順の逆から DFS します。", "二回目の各 DFS が一つの SCC です。"], input: "n m と m 本の有向辺。", constraints: "1 ≤ n ≤ 200,000、0 ≤ m ≤ 400,000", output: "SCC 数を出力。", hint: "深いグラフでは反復 DFS が安全です。" } },
    },
  }),
  advancedQuest({
    id: "maxflow-reactor", index: "22", title: "Max-Flow Reactor", subtitle: "Dinic's algorithm", difficulty: 5, xp: 1500,
    prerequisites: ["scc-nexus"], chapter: "CH.12 / FINAL CIRCUIT", mapPosition: { x: 88, y: 84 },
    description: "Push the maximum possible energy from source 1 to sink n.", skills: ["maximum flow", "Dinic", "residual graph"], sortOrder: 22,
    problem: {
      story: ["The final reactor is a directed network. Each conduit has a maximum capacity.", "Route the greatest possible energy from source 1 to sink n."],
      guidance: ["Every edge needs a reverse residual edge.", "BFS builds a level graph using only positive residual capacity.", "DFS sends blocking flow along edges that advance exactly one level."],
      input: "n m followed by m directed edges u v capacity.", constraints: "2 ≤ n ≤ 500; 0 ≤ m ≤ 20,000; 0 ≤ capacity ≤ 10^12", output: "Print the maximum flow from 1 to n.", sampleInput: "4 5\n1 2 3\n1 3 2\n2 3 1\n2 4 2\n3 4 4", sampleOutput: "5", hint: "Use long long capacities and keep a current-edge pointer during each blocking-flow phase.", hintMarker: "    // TODO: start the reactor", hintCode: "    // repeat: BFS levels, then DFS blocking flows until none remain",
      starterCode: `#include <bits/stdc++.h>
using namespace std;
struct Edge{int to, rev; long long cap;};
int main(){
    ios::sync_with_stdio(false); cin.tie(nullptr);
    int n,m; cin>>n>>m; vector<vector<Edge>> g(n+1);
    auto addEdge=[&](int u,int v,long long c){g[u].push_back({v,(int)g[v].size(),c});g[v].push_back({u,(int)g[u].size()-1,0});};
    while(m--){int u,v;long long c;cin>>u>>v>>c;addEdge(u,v,c);}
    // TODO: start the reactor
    return 0;
}`,
      testCaseCount: 6, passScore: 100, timeLimitSeconds: 3, memoryLimitMb: 256,
    },
    translations: {
      "zh-CN": { title: "最大流反应炉", subtitle: "Dinic 算法", chapter: "第 12 章 / 最终回路", description: "把最多能量从源点 1 输送到汇点 n。", skills: ["最大流", "Dinic", "残量网络"], problem: { story: ["最终反应炉是一张有向网络，每条管道都有容量上限。", "把尽可能多的能量从 1 号源点送到 n 号汇点。"], guidance: ["每条边都需要一条反向残量边。", "BFS 只通过正残量边建立分层图。", "DFS 只沿层数恰好增加 1 的边发送阻塞流。"], input: "n m，随后 m 条有向容量边 u v c。", constraints: "2 ≤ n ≤ 500；0 ≤ m ≤ 20,000；0 ≤ c ≤ 10^12", output: "输出从 1 到 n 的最大流。", hint: "容量使用 long long，并维护当前弧指针。" } },
      ja: { title: "最大流リアクター", subtitle: "Dinic 法", chapter: "第12章 / 最終回路", description: "源点1から終点nへ最大のエネルギーを送ります。", skills: ["最大流", "Dinic", "残余グラフ"], problem: { story: ["最終リアクターは容量付き有向ネットワークです。", "頂点1から n へ送れる最大エネルギーを求めます。"], guidance: ["各辺に逆向きの残余辺を作ります。", "BFS で正容量辺のレベルグラフを作ります。", "DFS はレベルが1増える辺だけに流します。"], input: "n m と m 本の有向容量辺。", constraints: "2 ≤ n ≤ 500、0 ≤ m ≤ 20,000、0 ≤ c ≤ 10^12", output: "1 から n の最大流。", hint: "容量は long long、各フェーズで現在辺ポインタを使います。" } },
    },
  }),
];
