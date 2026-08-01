export type QuestStatus = "available" | "locked" | "secret";

export type QuestProblem = {
  story: string[];
  richStatement?: string;
  statementFormat?: "plain" | "tiptap-json-v1";
  guidance: string[];
  input: string;
  constraints: string;
  output: string;
  sampleInput: string;
  sampleOutput: string;
  samples?: Array<{ id?: string; input: string; output: string }>;
  hint: string;
  richHint?: string;
  hintFormat?: "plain" | "tiptap-json-v1";
  hintMarker: string;
  hintCode: string;
  starterCode: string;
  testCaseCount: number;
  passScore: number;
  timeLimitSeconds: number;
  memoryLimitMb: number;
};

export type Quest = {
  id: string;
  index: string;
  title: string;
  subtitle: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  xp: number;
  status: QuestStatus;
  prerequisites: string[];
  chapter: string;
  gridArea: string;
  mapPosition: { x: number; y: number };
  description: string;
  skills: string[];
  problem?: QuestProblem;
  sortOrder?: number;
  translations?: Partial<
    Record<
      "zh-CN" | "ja",
      Partial<
        Pick<
          Quest,
          "title" | "subtitle" | "chapter" | "description" | "skills"
        >
      > & {
        problem?: Partial<
          Pick<
            QuestProblem,
            | "story"
            | "guidance"
            | "input"
            | "constraints"
            | "output"
            | "hint"
          >
        >;
      }
    >
  >;
};

export const quests: Quest[] = [
  {
    id: "signal-fire",
    index: "01",
    title: "Signal Fire",
    subtitle: "Input, output & arithmetic",
    difficulty: 1,
    xp: 120,
    status: "available",
    prerequisites: [],
    chapter: "CH.01 / AWAKENING",
    gridArea: "q1",
    mapPosition: { x: 10, y: 18 },
    description:
      "Wake the dormant relay by reading two energy values and printing their sum.",
    skills: ["cin / cout", "variables", "arithmetic"],
    problem: {
      story: [
        "The outpost relay has slept for 4,096 cycles. Two energy cells remain, carrying a and b units.",
        "Read both values and output their sum to ignite the signal fire.",
      ],
      guidance: [
        "Read the mission story and locate the INPUT, OUTPUT and SAMPLE panels.",
        "Find the TODO marker in main.cpp. The editor autosaves every change.",
        "Replace the TODO with a cout statement, then use RUN SAMPLE.",
        "When the sample passes, use SUBMIT SOLUTION to run every hidden case.",
        "After AC, close the congratulations card and return to the map.",
      ],
      input: "One line containing two integers a and b.",
      constraints: "-10⁹ ≤ a, b ≤ 10⁹",
      output: "Print one integer: the combined energy.",
      sampleInput: "7 35",
      sampleOutput: "42",
      hint: "The relay listens through cout. Send it the value of a + b.",
      hintMarker: "    // TODO: transmit the combined energy",
      hintCode: "    cout << a + b << '\\n';",
      starterCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    long long a, b;
    cin >> a >> b;

    // TODO: transmit the combined energy

    return 0;
}`,
      testCaseCount: 4,
      passScore: 100,
      timeLimitSeconds: 1,
      memoryLimitMb: 64,
    },
  },
  {
    id: "forked-path",
    index: "02",
    title: "Forked Path",
    subtitle: "Conditionals",
    difficulty: 1,
    xp: 140,
    status: "locked",
    prerequisites: ["signal-fire"],
    chapter: "CH.01 / AWAKENING",
    gridArea: "q2",
    mapPosition: { x: 30, y: 18 },
    description:
      "Choose the safer tunnel by comparing two danger readings.",
    skills: ["if / else", "comparison"],
    problem: {
      story: [
        "The road divides beneath the mountain. The left and right tunnels report separate danger readings.",
        "Choose the tunnel with the smaller reading. If both readings match, hold position.",
      ],
      guidance: [
        "List the three possible relationships: left is smaller, right is smaller, or equal.",
        "Use if / else if / else so exactly one answer is printed.",
        "Run the sample first, then submit to check all edge cases.",
      ],
      input: "One line containing two integers left and right.",
      constraints: "-10⁹ ≤ left, right ≤ 10⁹",
      output:
        'Print "LEFT" if left is safer, "RIGHT" if right is safer, or "EQUAL" if they match.',
      sampleInput: "17 29",
      sampleOutput: "LEFT",
      hint:
        "Compare the readings with if and else if. Remember the equality case.",
      hintMarker: "    // TODO: choose the safer tunnel",
      hintCode: `    if (left < right) cout << "LEFT\\n";
    else if (right < left) cout << "RIGHT\\n";
    else cout << "EQUAL\\n";`,
      starterCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    long long left, right;
    cin >> left >> right;

    // TODO: choose the safer tunnel

    return 0;
}`,
      testCaseCount: 5,
      passScore: 100,
      timeLimitSeconds: 1,
      memoryLimitMb: 64,
    },
  },
  {
    id: "echo-loop",
    index: "03",
    title: "Echo Loop",
    subtitle: "Iteration",
    difficulty: 1,
    xp: 160,
    status: "locked",
    prerequisites: ["forked-path"],
    chapter: "CH.01 / AWAKENING",
    gridArea: "q3",
    mapPosition: { x: 50, y: 18 },
    description: "Repeat the ancient signal until the gate responds.",
    skills: ["for", "while"],
    problem: {
      story: [
        "A sealed gate accepts a rising sequence of pulses, beginning at one.",
        "Transmit every pulse from 1 through n on one line, separated by spaces.",
      ],
      guidance: [
        "Identify the first value, last value and repeated step.",
        "Use a for or while loop and handle spaces without adding unwanted text.",
        "Run the sample, then submit to evaluate every hidden value of n.",
      ],
      input: "One integer n.",
      constraints: "1 ≤ n ≤ 1,000",
      output: "Print 1, 2, …, n on one line, separated by one space.",
      sampleInput: "5",
      sampleOutput: "1 2 3 4 5",
      hint:
        "A for loop can visit every value from 1 through n. Print a space only before values after the first.",
      hintMarker: "    // TODO: repeat the pulse",
      hintCode: `    for (int i = 1; i <= n; ++i) {
        if (i > 1) cout << ' ';
        cout << i;
    }
    cout << '\\n';`,
      starterCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;

    // TODO: repeat the pulse

    return 0;
}`,
      testCaseCount: 5,
      passScore: 100,
      timeLimitSeconds: 1,
      memoryLimitMb: 64,
    },
  },
  {
    id: "array-vault",
    index: "04",
    title: "Array Vault",
    subtitle: "Linear containers",
    difficulty: 2,
    xp: 220,
    status: "locked",
    prerequisites: ["echo-loop"],
    chapter: "CH.02 / FIRST DATA",
    gridArea: "q4",
    mapPosition: { x: 20, y: 48 },
    description: "Scan a sequence of memory cells and recover its strongest signal.",
    skills: ["arrays", "traversal"],
    problem: {
      story: [
        "The vault key is scattered across n signed memory cells.",
        "Read every cell and report the largest value before the archive resets.",
      ],
      guidance: [
        "Store n values in a vector or process them as they are read.",
        "Initialize the answer from real input instead of assuming values are positive.",
        "Update the maximum once per element, then print it.",
      ],
      input: "The first line contains n. The second line contains n integers.",
      constraints: "1 ≤ n ≤ 200,000; each value fits in a signed 32-bit integer.",
      output: "Print the largest value.",
      sampleInput: "6\n-9 14 3 14 -2 8",
      sampleOutput: "14",
      hint: "Read the first value into best, then use best = max(best, value).",
      hintMarker: "    // TODO: recover the strongest cell",
      hintCode: `    long long best = a[0];
    for (long long value : a) best = max(best, value);
    cout << best << '\\n';`,
      starterCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    vector<long long> a(n);
    for (long long &value : a) cin >> value;

    // TODO: recover the strongest cell

    return 0;
}`,
      testCaseCount: 5,
      passScore: 100,
      timeLimitSeconds: 1,
      memoryLimitMb: 64,
    },
  },
  {
    id: "sorting-ruins",
    index: "05",
    title: "Sorting Ruins",
    subtitle: "Ordering",
    difficulty: 2,
    xp: 260,
    status: "locked",
    prerequisites: ["array-vault"],
    chapter: "CH.02 / FIRST DATA",
    gridArea: "q5",
    mapPosition: { x: 40, y: 48 },
    description: "Restore a shattered archive by returning every rune to ascending order.",
    skills: ["sort", "complexity"],
    problem: {
      story: [
        "The archive runes were scattered during the collapse.",
        "Sort all n integers in nondecreasing order so the record can be decoded.",
      ],
      guidance: [
        "Read the values into a vector.",
        "Use std::sort on the half-open range from begin() to end().",
        "Print exactly one space between adjacent values.",
      ],
      input: "The first line contains n. The second line contains n integers.",
      constraints: "1 ≤ n ≤ 200,000; |aᵢ| ≤ 10⁹.",
      output: "Print the values in nondecreasing order.",
      sampleInput: "5\n8 -1 8 3 0",
      sampleOutput: "-1 0 3 8 8",
      hint: "sort(a.begin(), a.end()) orders the entire vector.",
      hintMarker: "    // TODO: restore rune order",
      hintCode: `    sort(a.begin(), a.end());
    for (int i = 0; i < n; ++i) {
        if (i) cout << ' ';
        cout << a[i];
    }
    cout << '\\n';`,
      starterCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    cin >> n;
    vector<long long> a(n);
    for (long long &value : a) cin >> value;

    // TODO: restore rune order

    return 0;
}`,
      testCaseCount: 5,
      passScore: 100,
      timeLimitSeconds: 1,
      memoryLimitMb: 64,
    },
  },
  {
    id: "binary-gate",
    index: "06",
    title: "Binary Gate",
    subtitle: "Divide the search",
    difficulty: 2,
    xp: 300,
    status: "locked",
    prerequisites: ["sorting-ruins"],
    chapter: "CH.02 / FIRST DATA",
    gridArea: "q6",
    mapPosition: { x: 60, y: 48 },
    description: "Find one frequency among millions before the gate closes.",
    skills: ["binary search", "invariants"],
    problem: {
      story: [
        "A sorted frequency table controls the gate.",
        "Find the first position containing target, or report -1 when it is absent.",
      ],
      guidance: [
        "The input is already sorted; do not scan every value.",
        "Use lower_bound to find the first value that is not smaller than target.",
        "Verify the iterator is valid and equal to target before printing its 1-based position.",
      ],
      input: "The first line contains n and target. The second line contains n sorted integers.",
      constraints: "1 ≤ n ≤ 500,000; |aᵢ|, |target| ≤ 10⁹.",
      output: "Print the first 1-based position of target, or -1.",
      sampleInput: "7 4\n1 2 4 4 4 9 12",
      sampleOutput: "3",
      hint: "lower_bound returns an iterator; subtract a.begin() and add one.",
      hintMarker: "    // TODO: locate the first matching frequency",
      hintCode: `    auto it = lower_bound(a.begin(), a.end(), target);
    if (it == a.end() || *it != target) cout << -1 << '\\n';
    else cout << (it - a.begin()) + 1 << '\\n';`,
      starterCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n;
    long long target;
    cin >> n >> target;
    vector<long long> a(n);
    for (long long &value : a) cin >> value;

    // TODO: locate the first matching frequency

    return 0;
}`,
      testCaseCount: 6,
      passScore: 100,
      timeLimitSeconds: 1,
      memoryLimitMb: 64,
    },
  },
  {
    id: "prefix-beacon",
    index: "07",
    title: "Prefix Beacon",
    subtitle: "Range sums",
    difficulty: 2,
    xp: 340,
    status: "locked",
    prerequisites: ["binary-gate"],
    chapter: "CH.03 / SIGNAL STRUCTURES",
    gridArea: "q7",
    mapPosition: { x: 10, y: 80 },
    description: "Answer many energy-range queries without rescanning the array.",
    skills: ["prefix sums", "queries"],
    problem: {
      story: [
        "Thousands of beacon logs ask for the energy inside different intervals.",
        "Build one prefix table, then answer every inclusive range [l, r].",
      ],
      guidance: [
        "Let prefix[i] store the sum of the first i values.",
        "Use prefix[r] - prefix[l - 1] for an inclusive 1-based query.",
        "Use long long because many values can accumulate.",
      ],
      input: "The first line contains n and q, followed by n values and q lines l r.",
      constraints: "1 ≤ n, q ≤ 200,000; |aᵢ| ≤ 10⁹.",
      output: "For each query, print the range sum on its own line.",
      sampleInput: "5 3\n2 -1 4 7 3\n1 3\n2 5\n4 4",
      sampleOutput: "5\n13\n7",
      hint: "Build prefix with prefix[i] = prefix[i - 1] + a[i].",
      hintMarker: "    // TODO: answer every beacon query",
      hintCode: `    while (q--) {
        int l, r;
        cin >> l >> r;
        cout << prefix[r] - prefix[l - 1] << '\\n';
    }`,
      starterCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, q;
    cin >> n >> q;
    vector<long long> prefix(n + 1);
    for (int i = 1; i <= n; ++i) {
        long long value;
        cin >> value;
        prefix[i] = prefix[i - 1] + value;
    }

    // TODO: answer every beacon query

    return 0;
}`,
      testCaseCount: 5,
      passScore: 100,
      timeLimitSeconds: 1,
      memoryLimitMb: 96,
    },
  },
  {
    id: "stack-sentinel",
    index: "08",
    title: "Stack Sentinel",
    subtitle: "Balanced brackets",
    difficulty: 2,
    xp: 360,
    status: "locked",
    prerequisites: ["binary-gate"],
    chapter: "CH.03 / SIGNAL STRUCTURES",
    gridArea: "q8",
    mapPosition: { x: 30, y: 80 },
    description: "Use a stack to verify the sentinel's bracket sequence.",
    skills: ["stack", "matching"],
    problem: {
      story: [
        "The sentinel accepts only properly nested (), [] and {} seals.",
        "Determine whether the complete sequence is valid.",
      ],
      guidance: [
        "Push opening brackets onto a stack.",
        "For a closing bracket, the top must contain its matching opener.",
        "The stack must be empty after the final character.",
      ],
      input: "One non-empty string containing only ()[]{}.",
      constraints: "1 ≤ length ≤ 500,000.",
      output: 'Print "YES" when balanced, otherwise "NO".',
      sampleInput: "{[()()]}",
      sampleOutput: "YES",
      hint: "Reject immediately when a closing bracket has no matching top.",
      hintMarker: "    // TODO: verify the seal",
      hintCode: `    vector<char> st;
    bool ok = true;
    for (char ch : s) {
        if (ch == '(' || ch == '[' || ch == '{') st.push_back(ch);
        else {
            char need = ch == ')' ? '(' : (ch == ']' ? '[' : '{');
            if (st.empty() || st.back() != need) { ok = false; break; }
            st.pop_back();
        }
    }
    cout << (ok && st.empty() ? "YES\\n" : "NO\\n");`,
      starterCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    string s;
    cin >> s;

    // TODO: verify the seal

    return 0;
}`,
      testCaseCount: 6,
      passScore: 100,
      timeLimitSeconds: 1,
      memoryLimitMb: 64,
    },
  },
  {
    id: "grid-rescue",
    index: "09",
    title: "Grid Rescue",
    subtitle: "Breadth-first search",
    difficulty: 3,
    xp: 420,
    status: "locked",
    prerequisites: ["prefix-beacon", "stack-sentinel"],
    chapter: "CH.04 / EXPLORATION",
    gridArea: "q9",
    mapPosition: { x: 50, y: 80 },
    description: "Find the shortest safe path through a ruined grid.",
    skills: ["BFS", "grid graph"],
    problem: {
      story: [
        "The rescue grid contains open cells '.', walls '#', a start S and a target T.",
        "Move in four directions and report the minimum number of steps.",
      ],
      guidance: [
        "BFS explores unweighted paths in increasing distance.",
        "Mark a cell visited when it enters the queue, not when it leaves.",
        "Return -1 if the target is never reached.",
      ],
      input: "The first line contains h and w, followed by h grid rows.",
      constraints: "1 ≤ h, w ≤ 1,000; h·w ≤ 500,000.",
      output: "Print the shortest path length from S to T, or -1.",
      sampleInput: "4 5\nS...#\n##..#\n...#.\n...T.",
      sampleOutput: "6",
      hint: "Store row, column and distance in the queue, or keep a distance grid.",
      hintMarker: "    // TODO: run the rescue search",
      hintCode: `    queue<pair<int,int>> q;
    q.push(start);
    dist[start.first][start.second] = 0;
    const int dr[4] = {1, -1, 0, 0};
    const int dc[4] = {0, 0, 1, -1};
    while (!q.empty()) {
        auto cur = q.front(); q.pop();
        for (int k = 0; k < 4; ++k) {
            int nr = cur.first + dr[k], nc = cur.second + dc[k];
            if (nr < 0 || nr >= h || nc < 0 || nc >= w) continue;
            if (grid[nr][nc] == '#' || dist[nr][nc] != -1) continue;
            dist[nr][nc] = dist[cur.first][cur.second] + 1;
            q.push({nr, nc});
        }
    }
    cout << dist[target.first][target.second] << '\\n';`,
      starterCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int h, w;
    cin >> h >> w;
    vector<string> grid(h);
    pair<int,int> start, target;
    for (int r = 0; r < h; ++r) {
        cin >> grid[r];
        for (int c = 0; c < w; ++c) {
            if (grid[r][c] == 'S') start = {r, c};
            if (grid[r][c] == 'T') target = {r, c};
        }
    }
    vector<vector<int>> dist(h, vector<int>(w, -1));

    // TODO: run the rescue search

    return 0;
}`,
      testCaseCount: 5,
      passScore: 100,
      timeLimitSeconds: 2,
      memoryLimitMb: 128,
    },
  },
  {
    id: "dijkstra-citadel",
    index: "10",
    title: "Dijkstra Citadel",
    subtitle: "Weighted shortest path",
    difficulty: 3,
    xp: 480,
    status: "locked",
    prerequisites: ["grid-rescue"],
    chapter: "CH.04 / EXPLORATION",
    gridArea: "q10",
    mapPosition: { x: 70, y: 80 },
    description: "Cross a weighted road network with the least possible cost.",
    skills: ["Dijkstra", "priority queue"],
    problem: {
      story: [
        "Every citadel road has a nonnegative travel cost.",
        "Find the minimum cost from vertex 1 to vertex n in an undirected graph.",
      ],
      guidance: [
        "Store each edge in both adjacency lists.",
        "Use a min-priority queue ordered by current distance.",
        "Skip stale queue entries whose distance no longer matches dist[u].",
      ],
      input: "The first line contains n and m, followed by m lines u v w.",
      constraints: "2 ≤ n ≤ 200,000; 1 ≤ m ≤ 400,000; 0 ≤ w ≤ 10⁹.",
      output: "Print the minimum cost from 1 to n, or -1 when unreachable.",
      sampleInput: "5 6\n1 2 4\n1 3 2\n3 2 1\n2 5 7\n3 4 5\n4 5 1",
      sampleOutput: "8",
      hint: "priority_queue with greater<pair<long long,int>> behaves as a min-heap.",
      hintMarker: "    // TODO: find the cheapest route",
      hintCode: `    const long long INF = (1LL << 62);
    vector<long long> dist(n + 1, INF);
    priority_queue<pair<long long,int>, vector<pair<long long,int>>, greater<pair<long long,int>>> pq;
    dist[1] = 0; pq.push({0, 1});
    while (!pq.empty()) {
        auto cur = pq.top(); pq.pop();
        long long d = cur.first; int u = cur.second;
        if (d != dist[u]) continue;
        for (auto edge : graph[u]) {
            int v = edge.first; long long w = edge.second;
            if (dist[v] > d + w) {
                dist[v] = d + w;
                pq.push({dist[v], v});
            }
        }
    }
    cout << (dist[n] == INF ? -1 : dist[n]) << '\\n';`,
      starterCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, m;
    cin >> n >> m;
    vector<vector<pair<int,long long>>> graph(n + 1);
    while (m--) {
        int u, v;
        long long w;
        cin >> u >> v >> w;
        graph[u].push_back({v, w});
        graph[v].push_back({u, w});
    }

    // TODO: find the cheapest route

    return 0;
}`,
      testCaseCount: 5,
      passScore: 100,
      timeLimitSeconds: 2,
      memoryLimitMb: 192,
    },
  },
  {
    id: "union-forge",
    index: "11",
    title: "Union Forge",
    subtitle: "Disjoint sets",
    difficulty: 3,
    xp: 520,
    status: "locked",
    prerequisites: ["dijkstra-citadel"],
    chapter: "CH.05 / NETWORKS",
    gridArea: "q11",
    mapPosition: { x: 84, y: 50 },
    description: "Maintain changing alliances with a disjoint-set union.",
    skills: ["DSU", "path compression"],
    problem: {
      story: [
        "The forge joins isolated terminals into alliances.",
        "Process union commands and answer whether two terminals are connected.",
      ],
      guidance: [
        "Start each terminal as its own parent.",
        "Compress paths in find and merge roots by size or rank.",
        "Print one answer for every query command.",
      ],
      input: "The first line contains n and q. Each command is U a b or Q a b.",
      constraints: "1 ≤ n, q ≤ 300,000.",
      output: 'For each Q command, print "YES" or "NO".',
      sampleInput: "5 6\nU 1 2\nQ 1 3\nU 2 3\nQ 1 3\nQ 4 5\nQ 2 2",
      sampleOutput: "NO\nYES\nNO\nYES",
      hint: "Two terminals are connected exactly when find(a) == find(b).",
      hintMarker: "    // TODO: process forge commands",
      hintCode: `    while (q--) {
        char type; int a, b;
        cin >> type >> a >> b;
        if (type == 'U') dsu.unite(a, b);
        else cout << (dsu.find(a) == dsu.find(b) ? "YES\\n" : "NO\\n");
    }`,
      starterCode: `#include <bits/stdc++.h>
using namespace std;

struct DSU {
    vector<int> parent, size;
    DSU(int n) : parent(n + 1), size(n + 1, 1) {
        iota(parent.begin(), parent.end(), 0);
    }
    int find(int x) {
        return parent[x] == x ? x : parent[x] = find(parent[x]);
    }
    void unite(int a, int b) {
        a = find(a); b = find(b);
        if (a == b) return;
        if (size[a] < size[b]) swap(a, b);
        parent[b] = a;
        size[a] += size[b];
    }
};

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, q;
    cin >> n >> q;
    DSU dsu(n);

    // TODO: process forge commands

    return 0;
}`,
      testCaseCount: 5,
      passScore: 100,
      timeLimitSeconds: 2,
      memoryLimitMb: 128,
    },
  },
  {
    id: "topological-crown",
    index: "12",
    title: "Topological Crown",
    subtitle: "Dependency ordering",
    difficulty: 4,
    xp: 620,
    status: "locked",
    prerequisites: ["union-forge"],
    chapter: "CH.05 / NETWORKS",
    gridArea: "q12",
    mapPosition: { x: 70, y: 20 },
    description: "Produce the smallest valid order for a dependency graph.",
    skills: ["topological sort", "DAG"],
    problem: {
      story: [
        "The crown's n modules form a directed acyclic dependency graph.",
        "Print the lexicographically smallest topological order.",
      ],
      guidance: [
        "Count the indegree of every vertex.",
        "Put all zero-indegree vertices in a min-priority queue.",
        "After removing a vertex, decrement its outgoing neighbors and enqueue newly free modules.",
      ],
      input: "The first line contains n and m, followed by m directed edges u v.",
      constraints: "1 ≤ n ≤ 200,000; 0 ≤ m ≤ 400,000; the graph is a DAG.",
      output: "Print the lexicographically smallest topological order.",
      sampleInput: "5 4\n1 3\n2 3\n3 4\n2 5",
      sampleOutput: "1 2 3 4 5",
      hint: "Use priority_queue<int, vector<int>, greater<int>> for the next smallest free vertex.",
      hintMarker: "    // TODO: assemble the crown",
      hintCode: `    priority_queue<int, vector<int>, greater<int>> ready;
    for (int i = 1; i <= n; ++i) if (indegree[i] == 0) ready.push(i);
    vector<int> order;
    while (!ready.empty()) {
        int u = ready.top(); ready.pop();
        order.push_back(u);
        for (int v : graph[u]) if (--indegree[v] == 0) ready.push(v);
    }
    for (int i = 0; i < n; ++i) {
        if (i) cout << ' ';
        cout << order[i];
    }
    cout << '\\n';`,
      starterCode: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int n, m;
    cin >> n >> m;
    vector<vector<int>> graph(n + 1);
    vector<int> indegree(n + 1);
    while (m--) {
        int u, v;
        cin >> u >> v;
        graph[u].push_back(v);
        ++indegree[v];
    }

    // TODO: assemble the crown

    return 0;
}`,
      testCaseCount: 5,
      passScore: 100,
      timeLimitSeconds: 2,
      memoryLimitMb: 160,
    },
  },
  ...advancedQuests,
  {
    id: "nameless-room",
    index: "??",
    title: "Nameless Room",
    subtitle: "Hidden encounter",
    difficulty: 3,
    xp: 500,
    status: "secret",
    prerequisites: [],
    chapter: "SECRET / UNKNOWN",
    gridArea: "secret",
    mapPosition: { x: 90, y: 18 },
    description: "The wall sounds hollow here. Something waits behind it.",
    skills: ["???"],
  },
];

export function isQuestUnlocked(
  quest: Quest,
  cleared: Set<string>,
  recommendedQuestId?: string,
) {
  return (
    quest.status !== "secret" &&
    quest.problem !== undefined &&
    (quest.id === recommendedQuestId ||
      quest.prerequisites.every((questId) => cleared.has(questId)))
  );
}
import { advancedQuests } from "@/lib/advanced-quests";
