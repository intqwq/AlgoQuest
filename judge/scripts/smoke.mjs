import { judgeCpp14 } from "../src/docker-runner.mjs";
import { quests } from "../src/quests.mjs";

const source = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);

    int a, b;
    cin >> a >> b;
    cout << a + b;

    return 0;
}`;

const result = await judgeCpp14(source, quests["signal-fire"]);

if (result.verdict !== "AC") {
  console.error("[judge smoke] expected AC, received:");
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  const wrong = await judgeCpp14(
    source.replace("a + b", "a - b"),
    quests["signal-fire"],
  );
  if (
    wrong.verdict !== "WA" ||
    wrong.cases.length !== quests["signal-fire"].tests.length ||
    wrong.cases.some(
      (item) => "expected" in item || "received" in item,
    )
  ) {
    console.error("[judge smoke] WA privacy/full-run contract failed:");
    console.error(JSON.stringify(wrong, null, 2));
    process.exitCode = 1;
  }
  const peakMemoryKb = Math.max(
    0,
    ...result.cases.map((item) => item.memoryKb),
  );
  console.log(
    `[judge smoke] AC + full WA (${result.cases.length} cases, ${result.containerStarts} container, ${peakMemoryKb} KiB calibrated)`,
  );
}
