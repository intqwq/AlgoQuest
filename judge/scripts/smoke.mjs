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
  console.log(
    `[judge smoke] AC (${result.cases.length} cases, ${result.containerStarts} container)`,
  );
}
