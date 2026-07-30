import type { Locale } from "@/lib/i18n";

export type CodexCategory =
  | "fundamentals"
  | "algorithms"
  | "data-structures"
  | "graphs";

export type LocalizedText = Record<Locale, string>;

export type CodexEntry = {
  id: string;
  category: CodexCategory;
  questId: string;
  marker: string;
  title: LocalizedText;
  summary: LocalizedText;
  explanation: LocalizedText;
  checkpoints: LocalizedText[];
  timeComplexity: string;
  spaceComplexity: string;
  tags: string[];
  code: string;
};

export const codexCategories: Array<{
  id: CodexCategory;
  label: LocalizedText;
}> = [
  {
    id: "fundamentals",
    label: { en: "FOUNDATIONS", "zh-CN": "基础语法", ja: "基礎" },
  },
  {
    id: "algorithms",
    label: { en: "ALGORITHMS", "zh-CN": "基础算法", ja: "アルゴリズム" },
  },
  {
    id: "data-structures",
    label: { en: "DATA STRUCTURES", "zh-CN": "数据结构", ja: "データ構造" },
  },
  {
    id: "graphs",
    label: { en: "GRAPH SYSTEMS", "zh-CN": "图论系统", ja: "グラフ" },
  },
];

export function localizeCodex(value: LocalizedText, locale: Locale) {
  return value[locale] ?? value.en;
}

export const codexEntries: CodexEntry[] = [
  {
    id: "io-arithmetic",
    category: "fundamentals",
    questId: "signal-fire",
    marker: "01",
    title: { en: "Input, output and arithmetic", "zh-CN": "输入、输出与算术", ja: "入出力と算術" },
    summary: {
      en: "Read values with cin, calculate with the correct type, and report the exact requested output.",
      "zh-CN": "使用 cin 读取数据，选择正确的数据类型进行计算，并严格输出题目要求的结果。",
      ja: "cin で値を読み、適切な型で計算し、指定された形式で正確に出力する。",
    },
    explanation: {
      en: "Most competitive-programming solutions are a pipeline: parse input, transform data, then print only the answer. Fast I/O setup is useful for large inputs, while long long protects arithmetic that can exceed 32-bit int.",
      "zh-CN": "大多数竞赛程序都可以看作一条流水线：读取输入、处理数据、只输出答案。数据量较大时应启用快速 I/O；计算可能超过 32 位整数范围时，应使用 long long。",
      ja: "競技プログラミングの解答は、入力を読み、データを処理し、答えだけを出力する流れです。大きな入力には高速 I/O、32 ビットを超える計算には long long を使います。",
    },
    checkpoints: [
      { en: "Match each input variable to its constraint.", "zh-CN": "根据约束为每个变量选择数据类型。", ja: "制約に合わせて変数の型を選ぶ。" },
      { en: "Do not print prompts, labels or debug text.", "zh-CN": "不要输出提示语、标签或调试信息。", ja: "プロンプトやデバッグ文字列を出力しない。" },
      { en: "Use '\\n' for predictable line endings.", "zh-CN": "使用 '\\n' 输出稳定的换行。", ja: "改行には '\\n' を使う。" },
    ],
    timeComplexity: "O(1)",
    spaceComplexity: "O(1)",
    tags: ["cin", "cout", "long long", "arithmetic"],
    code: `long long a, b;
cin >> a >> b;
cout << a + b << '\\n';`,
  },
  {
    id: "branching",
    category: "fundamentals",
    questId: "forked-path",
    marker: "02",
    title: { en: "Branching with invariants", "zh-CN": "条件分支与情况覆盖", ja: "条件分岐" },
    summary: {
      en: "Use if, else if and else so every possible case is handled exactly once.",
      "zh-CN": "使用 if、else if 和 else，让所有可能情况都被覆盖且只执行一个分支。",
      ja: "if、else if、else を使い、すべてのケースを一度だけ処理する。",
    },
    explanation: {
      en: "A reliable branch starts by partitioning the input space into mutually exclusive cases. Order conditions from specific to general, and keep equality and boundary values visible instead of treating them as afterthoughts.",
      "zh-CN": "可靠的条件分支应先把输入空间划分成互不重叠的情况。条件通常从具体到一般排列，并明确处理相等与边界值。",
      ja: "入力全体を重ならない場合に分割してから条件を書くと安全です。具体的な条件から一般的な条件へ並べ、等号や境界値を明示します。",
    },
    checkpoints: [
      { en: "List the cases before coding.", "zh-CN": "编码前先列出所有情况。", ja: "実装前にケースを列挙する。" },
      { en: "Check <, > and == boundaries.", "zh-CN": "检查 <、> 与 == 的边界。", ja: "<、>、== の境界を確認する。" },
      { en: "Prefer one output path per case.", "zh-CN": "每种情况只保留一条输出路径。", ja: "各ケースの出力経路を一つにする。" },
    ],
    timeComplexity: "O(1)",
    spaceComplexity: "O(1)",
    tags: ["if", "else", "comparison", "boundary"],
    code: `if (left < right) cout << "LEFT\\n";
else if (right < left) cout << "RIGHT\\n";
else cout << "EQUAL\\n";`,
  },
  {
    id: "iteration",
    category: "fundamentals",
    questId: "echo-loop",
    marker: "03",
    title: { en: "Loops and iteration", "zh-CN": "循环与迭代", ja: "ループと反復" },
    summary: {
      en: "Describe repeated work with a start state, continuation condition and update step.",
      "zh-CN": "用初始状态、继续条件和更新步骤描述重复执行的过程。",
      ja: "初期状態、継続条件、更新処理で繰り返しを表現する。",
    },
    explanation: {
      en: "Use a for loop when the number of iterations is naturally counted, and a while loop when progress depends on a changing condition. Off-by-one errors usually come from confusing the first valid index, the last valid index and the stopping condition.",
      "zh-CN": "迭代次数明确时适合使用 for；循环是否继续取决于状态时适合使用 while。越界一位错误通常来自混淆第一个下标、最后一个下标和终止条件。",
      ja: "回数が明確なら for、状態によって継続が決まるなら while が適します。オフバイワンは最初の添字、最後の添字、停止条件の混同から起こります。",
    },
    checkpoints: [
      { en: "Confirm the first and last visited values.", "zh-CN": "确认循环访问的首值与末值。", ja: "最初と最後に訪れる値を確認する。" },
      { en: "Make sure every loop makes progress.", "zh-CN": "确保每轮循环都会推进状态。", ja: "各反復で必ず状態が進むようにする。" },
      { en: "Keep formatting logic outside core computation when possible.", "zh-CN": "尽量把输出格式处理与核心计算分开。", ja: "可能なら出力整形と計算を分ける。" },
    ],
    timeComplexity: "O(n)",
    spaceComplexity: "O(1)",
    tags: ["for", "while", "iteration", "off-by-one"],
    code: `for (int i = 1; i <= n; ++i) {
    if (i > 1) cout << ' ';
    cout << i;
}
cout << '\\n';`,
  },
  {
    id: "arrays-traversal",
    category: "fundamentals",
    questId: "array-vault",
    marker: "04",
    title: { en: "Arrays, vectors and traversal", "zh-CN": "数组、vector 与遍历", ja: "配列・vector・走査" },
    summary: {
      en: "Store a sequence contiguously and process each element with a clear running state.",
      "zh-CN": "连续存储一组数据，并用清晰的状态逐个处理元素。",
      ja: "連続した列を保存し、明確な状態を保ちながら各要素を処理する。",
    },
    explanation: {
      en: "vector gives dynamic size and safe iteration utilities. A linear scan should usually maintain only the information needed so far, such as a maximum, count or running sum. Initialize from real data when values may be negative.",
      "zh-CN": "vector 提供动态长度和便利的遍历方式。线性扫描通常只维护已经读到的数据所需的信息，例如最大值、计数或累计和。当数据可能为负数时，应从真实输入初始化答案。",
      ja: "vector は動的な長さと便利な走査を提供します。線形走査では最大値、個数、累積和など必要な状態だけを保持します。負数があり得る場合は実データから初期化します。",
    },
    checkpoints: [
      { en: "Use 0 <= i < n for zero-based vectors.", "zh-CN": "零下标 vector 使用 0 <= i < n。", ja: "0 始まりの vector は 0 <= i < n。" },
      { en: "Initialize extrema from the first element or numeric limits.", "zh-CN": "极值应从首元素或 numeric_limits 初始化。", ja: "最大・最小値は先頭要素か numeric_limits で初期化する。" },
      { en: "Use references when reading directly into a vector.", "zh-CN": "直接读入 vector 时可使用引用。", ja: "vector へ直接入力するときは参照を使う。" },
    ],
    timeComplexity: "O(n)",
    spaceComplexity: "O(n)",
    tags: ["vector", "array", "traversal", "maximum"],
    code: `vector<long long> a(n);
for (long long &value : a) cin >> value;
long long best = a[0];
for (long long value : a) best = max(best, value);`,
  },
  {
    id: "sorting",
    category: "algorithms",
    questId: "sorting-ruins",
    marker: "05",
    title: { en: "Sorting and order", "zh-CN": "排序与有序性", ja: "ソートと順序" },
    summary: {
      en: "Sorting converts an unordered collection into a form where many later operations become simpler.",
      "zh-CN": "排序把无序集合变为有序序列，使许多后续操作更简单。",
      ja: "ソートは無秩序な集合を整列し、その後の処理を簡単にする。",
    },
    explanation: {
      en: "std::sort uses a comparison-based O(n log n) algorithm and works on half-open ranges [first, last). Sorting is often a preprocessing step before binary search, two pointers, duplicate removal or greedy selection.",
      "zh-CN": "std::sort 对半开区间 [first, last) 进行基于比较的 O(n log n) 排序。排序常作为二分查找、双指针、去重或贪心选择的预处理。",
      ja: "std::sort は半開区間 [first, last) を O(n log n) で並べます。二分探索、二点法、重複除去、貪欲法の前処理としてよく使われます。",
    },
    checkpoints: [
      { en: "Know whether ascending or descending order is required.", "zh-CN": "确认需要升序还是降序。", ja: "昇順か降順かを確認する。" },
      { en: "Use a strict comparator.", "zh-CN": "自定义比较器必须满足严格弱序。", ja: "比較関数は厳密な順序を満たす。" },
      { en: "Budget O(n log n) time before choosing sort.", "zh-CN": "使用排序前确认 O(n log n) 能通过限制。", ja: "O(n log n) が制約内か確認する。" },
    ],
    timeComplexity: "O(n log n)",
    spaceComplexity: "O(log n)",
    tags: ["sort", "ordering", "comparator", "preprocessing"],
    code: `sort(a.begin(), a.end());
// descending:
sort(a.begin(), a.end(), greater<long long>());`,
  },
  {
    id: "binary-search",
    category: "algorithms",
    questId: "binary-gate",
    marker: "06",
    title: { en: "Binary search and invariants", "zh-CN": "二分查找与不变量", ja: "二分探索と不変条件" },
    summary: {
      en: "Repeatedly discard half of a monotonic search space while preserving the answer inside an invariant interval.",
      "zh-CN": "在单调搜索空间中不断排除一半范围，并用不变量保证答案始终留在区间内。",
      ja: "単調な探索空間を半分ずつ捨て、不変条件で答えを区間内に保つ。",
    },
    explanation: {
      en: "Binary search is not only for finding a value in a sorted array. It finds the first true position of a monotonic predicate. lower_bound returns the first element not smaller than target, while upper_bound returns the first element greater than target.",
      "zh-CN": "二分查找不仅用于在有序数组中找值，也可以寻找单调判定中第一个为真的位置。lower_bound 返回第一个不小于目标值的位置，upper_bound 返回第一个大于目标值的位置。",
      ja: "二分探索は整列配列だけでなく、単調な判定で最初に真となる位置も探せます。lower_bound は target 以上の最初、upper_bound は target より大きい最初を返します。",
    },
    checkpoints: [
      { en: "State the invariant before writing the loop.", "zh-CN": "写循环前先明确区间不变量。", ja: "ループを書く前に不変条件を決める。" },
      { en: "Avoid overflow with mid = left + (right-left)/2.", "zh-CN": "使用 left + (right-left)/2 避免中点溢出。", ja: "mid = left + (right-left)/2 でオーバーフローを避ける。" },
      { en: "Verify the returned position before dereferencing.", "zh-CN": "解引用迭代器前检查是否到达 end。", ja: "イテレータを参照する前に end を確認する。" },
    ],
    timeComplexity: "O(log n)",
    spaceComplexity: "O(1)",
    tags: ["binary search", "lower_bound", "monotonic", "invariant"],
    code: `auto it = lower_bound(a.begin(), a.end(), target);
if (it != a.end() && *it == target) {
    int firstIndex = int(it - a.begin());
}`,
  },
  {
    id: "prefix-sums",
    category: "algorithms",
    questId: "prefix-beacon",
    marker: "07",
    title: { en: "Prefix sums and range queries", "zh-CN": "前缀和与区间查询", ja: "累積和と区間クエリ" },
    summary: {
      en: "Spend O(n) preprocessing once so every static range sum can be answered in O(1).",
      "zh-CN": "先用 O(n) 预处理一次，让每个静态区间和查询都能 O(1) 回答。",
      ja: "O(n) の前処理で、静的な区間和を各 O(1) で答える。",
    },
    explanation: {
      en: "Define prefix[i] as the sum of the first i values. With 1-based query endpoints, the inclusive sum [l, r] is prefix[r] - prefix[l-1]. The extra zero element removes special handling for ranges that begin at one.",
      "zh-CN": "定义 prefix[i] 为前 i 个元素之和。对于 1 下标闭区间 [l,r]，答案为 prefix[r]-prefix[l-1]。额外的 prefix[0]=0 可以消除从 1 开始区间的特殊判断。",
      ja: "prefix[i] を先頭 i 個の和とします。1 始まりの閉区間 [l,r] は prefix[r]-prefix[l-1]。prefix[0]=0 により左端が 1 の特別処理が不要です。",
    },
    checkpoints: [
      { en: "Write down whether endpoints are inclusive.", "zh-CN": "明确区间端点是否包含。", ja: "端点を含むか明記する。" },
      { en: "Use long long for accumulated sums.", "zh-CN": "累计和通常使用 long long。", ja: "累積和には long long を使う。" },
      { en: "Prefix sums require updates to be absent or handled separately.", "zh-CN": "普通前缀和适用于无修改或修改另行处理的场景。", ja: "通常の累積和は更新がない場合に適する。" },
    ],
    timeComplexity: "O(n + q)",
    spaceComplexity: "O(n)",
    tags: ["prefix sums", "range query", "preprocessing", "1-indexed"],
    code: `vector<long long> prefix(n + 1);
for (int i = 1; i <= n; ++i) {
    prefix[i] = prefix[i - 1] + a[i];
}
long long rangeSum = prefix[r] - prefix[l - 1];`,
  },
  {
    id: "stack",
    category: "data-structures",
    questId: "stack-sentinel",
    marker: "08",
    title: { en: "Stacks and matching", "zh-CN": "栈与括号匹配", ja: "スタックと対応付け" },
    summary: {
      en: "A stack remembers unfinished work in last-in, first-out order.",
      "zh-CN": "栈按照后进先出顺序保存尚未完成的任务。",
      ja: "スタックは未完了の処理を後入れ先出しで記憶する。",
    },
    explanation: {
      en: "Push opening symbols, and when a closing symbol arrives, compare it with the most recent unmatched opener. The same pattern appears in expression parsing, DFS simulation, undo systems and monotonic-stack problems.",
      "zh-CN": "遇到左括号时入栈；遇到右括号时，与最近一个尚未匹配的左括号比较。相同模式也用于表达式解析、模拟 DFS、撤销操作和单调栈。",
      ja: "開始記号を push し、終了記号が来たら直近の未対応の開始記号と比較します。同じ考え方は式解析、DFS の反復実装、undo、単調スタックにも使われます。",
    },
    checkpoints: [
      { en: "Check empty before reading the top.", "zh-CN": "读取栈顶前先判断是否为空。", ja: "top を読む前に空か確認する。" },
      { en: "Pop only after a successful match.", "zh-CN": "只有匹配成功后才弹出栈顶。", ja: "一致した後にだけ pop する。" },
      { en: "The stack must be empty after all input is processed.", "zh-CN": "处理完整个输入后栈必须为空。", ja: "入力処理後にスタックが空であることを確認する。" },
    ],
    timeComplexity: "O(n)",
    spaceComplexity: "O(n)",
    tags: ["stack", "LIFO", "brackets", "parsing"],
    code: `stack<char> st;
for (char ch : s) {
    if (ch == '(') st.push(ch);
    else {
        if (st.empty()) return false;
        st.pop();
    }
}
return st.empty();`,
  },
  {
    id: "bfs",
    category: "graphs",
    questId: "grid-rescue",
    marker: "09",
    title: { en: "Breadth-first search", "zh-CN": "广度优先搜索 BFS", ja: "幅優先探索 BFS" },
    summary: {
      en: "BFS explores an unweighted graph in increasing distance from the source.",
      "zh-CN": "BFS 按照距离起点从小到大的顺序探索无权图。",
      ja: "BFS は始点からの距離が小さい順に重みなしグラフを探索する。",
    },
    explanation: {
      en: "The queue stores the frontier. Mark a node visited when it enters the queue so it is never enqueued twice. In a grid, each passable cell is a vertex and four-direction moves are edges with equal cost.",
      "zh-CN": "队列保存搜索前沿。节点入队时就应标记访问，避免重复入队。在网格中，每个可通行格子是一个节点，四方向移动是等权边。",
      ja: "キューが探索の前線を保持します。二重に追加しないよう、キューへ入れた時点で訪問済みにします。グリッドでは通行可能セルが頂点、四方向移動が同じ重みの辺です。",
    },
    checkpoints: [
      { en: "Use BFS only when every edge has equal cost.", "zh-CN": "只有边权相等时才可直接用 BFS 求最短路。", ja: "全ての辺コストが同じ場合に BFS を使う。" },
      { en: "Mark visited on enqueue.", "zh-CN": "入队时标记访问。", ja: "enqueue 時に訪問済みにする。" },
      { en: "Validate boundaries before indexing grid cells.", "zh-CN": "访问网格前先检查边界。", ja: "グリッドを参照する前に境界を確認する。" },
    ],
    timeComplexity: "O(V + E)",
    spaceComplexity: "O(V)",
    tags: ["BFS", "queue", "shortest path", "grid graph"],
    code: `queue<int> q;
q.push(source);
dist[source] = 0;
while (!q.empty()) {
    int u = q.front(); q.pop();
    for (int v : graph[u]) if (dist[v] == -1) {
        dist[v] = dist[u] + 1;
        q.push(v);
    }
}`,
  },
  {
    id: "dijkstra",
    category: "graphs",
    questId: "dijkstra-citadel",
    marker: "10",
    title: { en: "Dijkstra shortest paths", "zh-CN": "Dijkstra 最短路", ja: "ダイクストラ法" },
    summary: {
      en: "Find minimum distances in a graph with nonnegative edge weights using a min-priority queue.",
      "zh-CN": "使用小根优先队列求解非负边权图中的最短距离。",
      ja: "最小優先度付きキューで非負辺グラフの最短距離を求める。",
    },
    explanation: {
      en: "The priority queue always exposes the currently smallest tentative distance. Relax an edge when going through u improves dist[v]. Because old queue entries remain after improvements, skip an entry whose stored distance differs from dist[u].",
      "zh-CN": "优先队列始终取出当前最小的暂定距离。若经过 u 能让 dist[v] 变小，就进行松弛。距离更新后旧队列项仍会存在，因此需要跳过与 dist[u] 不一致的过期项。",
      ja: "優先度付きキューから最小の暫定距離を取り出し、u 経由で dist[v] が改善するなら緩和します。古い要素が残るため、保存距離と dist[u] が違う要素は無視します。",
    },
    checkpoints: [
      { en: "Edge weights must be nonnegative.", "zh-CN": "所有边权必须非负。", ja: "辺重みは非負である必要がある。" },
      { en: "Use long long for path distances.", "zh-CN": "路径距离使用 long long。", ja: "距離には long long を使う。" },
      { en: "Skip stale priority-queue entries.", "zh-CN": "跳过优先队列中的过期状态。", ja: "古いキュー要素をスキップする。" },
    ],
    timeComplexity: "O((V + E) log V)",
    spaceComplexity: "O(V + E)",
    tags: ["Dijkstra", "priority_queue", "relaxation", "weighted graph"],
    code: `priority_queue<State, vector<State>, greater<State>> pq;
dist[source] = 0;
pq.push({0, source});
while (!pq.empty()) {
    pair<long long, int> current = pq.top(); pq.pop();
    long long d = current.first;
    int u = current.second;
    if (d != dist[u]) continue;
    for (auto edge : graph[u]) {
        int v = edge.first;
        long long w = edge.second;
        if (dist[v] > d + w) {
            dist[v] = d + w;
            pq.push({dist[v], v});
        }
    }
}`,
  },
  {
    id: "dsu",
    category: "data-structures",
    questId: "union-forge",
    marker: "11",
    title: { en: "Disjoint-set union", "zh-CN": "并查集 DSU", ja: "素集合データ構造 DSU" },
    summary: {
      en: "Maintain connected components under merge operations with nearly constant amortized time.",
      "zh-CN": "在不断合并集合的过程中维护连通分量，均摊复杂度接近常数。",
      ja: "集合の併合を行いながら、ほぼ定数の償却時間で連結成分を管理する。",
    },
    explanation: {
      en: "Each set is represented by a root. Path compression flattens trees during find, while union by size attaches the smaller tree below the larger root. DSU is ideal for connectivity queries, Kruskal's MST and offline merging problems.",
      "zh-CN": "每个集合由一个根节点代表。路径压缩在 find 时压平树结构，按大小合并则把较小的树接到较大的根下。并查集常用于连通性查询、Kruskal 最小生成树和离线合并问题。",
      ja: "各集合は根で表します。経路圧縮は find 時に木を平らにし、サイズ併合は小さい木を大きい根へ接続します。連結判定、Kruskal 法、オフライン併合に適します。",
    },
    checkpoints: [
      { en: "Always merge roots, not arbitrary vertices.", "zh-CN": "合并时必须合并根节点。", ja: "任意の頂点ではなく根同士を併合する。" },
      { en: "Use path compression in find.", "zh-CN": "find 中使用路径压缩。", ja: "find で経路圧縮を行う。" },
      { en: "Track size or rank for balanced unions.", "zh-CN": "记录 size 或 rank 以保持树平衡。", ja: "size または rank で木を平衡化する。" },
    ],
    timeComplexity: "O(alpha(n)) amortized",
    spaceComplexity: "O(n)",
    tags: ["DSU", "union-find", "path compression", "connectivity"],
    code: `int find(int x) {
    return parent[x] == x ? x : parent[x] = find(parent[x]);
}
void unite(int a, int b) {
    a = find(a); b = find(b);
    if (a == b) return;
    if (size[a] < size[b]) swap(a, b);
    parent[b] = a;
    size[a] += size[b];
}`,
  },
  {
    id: "topological-sort",
    category: "graphs",
    questId: "topological-crown",
    marker: "12",
    title: { en: "Topological ordering", "zh-CN": "拓扑排序", ja: "トポロジカルソート" },
    summary: {
      en: "Order a directed acyclic graph so every prerequisite appears before the task that depends on it.",
      "zh-CN": "对有向无环图排序，使每个前置任务都出现在依赖它的任务之前。",
      ja: "有向非巡回グラフを、各前提が依存先より前になるよう並べる。",
    },
    explanation: {
      en: "Kahn's algorithm repeatedly removes a zero-indegree vertex and decreases the indegree of its outgoing neighbors. A normal queue gives any valid order; a min-heap gives the lexicographically smallest available order. Processing fewer than n vertices reveals a cycle.",
      "zh-CN": "Kahn 算法反复取出入度为 0 的节点，并减少其出边终点的入度。普通队列得到任意合法序列，小根堆得到字典序最小序列。如果最终处理的节点少于 n，说明图中存在环。",
      ja: "Kahn 法は入次数 0 の頂点を取り出し、出辺先の入次数を減らします。通常のキューで任意の順序、最小ヒープで辞書順最小を得ます。処理数が n 未満なら閉路があります。",
    },
    checkpoints: [
      { en: "Topological order exists only for DAGs.", "zh-CN": "只有 DAG 才存在拓扑序。", ja: "トポロジカル順序は DAG にのみ存在する。" },
      { en: "Initialize every zero-indegree vertex.", "zh-CN": "初始化时加入所有入度为 0 的节点。", ja: "入次数 0 の全頂点を初期化時に追加する。" },
      { en: "Count processed vertices to detect cycles.", "zh-CN": "统计处理节点数以检测环。", ja: "処理頂点数で閉路を検出する。" },
    ],
    timeComplexity: "O(V + E)",
    spaceComplexity: "O(V + E)",
    tags: ["topological sort", "DAG", "indegree", "dependencies"],
    code: `queue<int> ready;
for (int u = 1; u <= n; ++u)
    if (indegree[u] == 0) ready.push(u);
while (!ready.empty()) {
    int u = ready.front(); ready.pop();
    order.push_back(u);
    for (int v : graph[u])
        if (--indegree[v] == 0) ready.push(v);
}`,
  },
];
