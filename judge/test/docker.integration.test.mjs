import test from "node:test";
import assert from "node:assert/strict";
import { judgeCpp14 } from "../src/docker-runner.mjs";
import { quests } from "../src/quests.mjs";

const enabled = process.env.JUDGE_DOCKER_TEST === "1";
const quest = quests["signal-fire"];
const singleCaseQuest = { ...quest, tests: quest.tests.slice(0, 1) };

async function expectVerdict(name, source, expected, selectedQuest = singleCaseQuest) {
  await test(name, { skip: !enabled }, async () => {
    const result = await judgeCpp14(source, selectedQuest);
    assert.equal(result.verdict, expected, JSON.stringify(result));
    assert.equal(result.containerStarts, 1);
  });
}

await expectVerdict(
  "AC: correct C++14 solution is accepted",
  `#include <bits/stdc++.h>
using namespace std;
int main(){ long long a,b; cin>>a>>b; cout<<a+b<<'\\n'; }`,
  "AC",
  quest,
);

await expectVerdict(
  "CE: invalid C++14 is rejected during compilation",
  `#include <bits/stdc++.h>
using namespace std;
int main(){ long long a,b; cin>>a>>b; cout<<a+b return 0; }`,
  "CE",
);

await test("WA: incorrect output is rejected without exposing answers", { skip: !enabled }, async () => {
  const result = await judgeCpp14(
    `#include <bits/stdc++.h>
using namespace std;
int main(){ long long a,b; cin>>a>>b; cout<<a-b<<'\\n'; }`,
    singleCaseQuest,
  );
  assert.equal(result.verdict, "WA", JSON.stringify(result));
  assert.equal(result.cases.length, 1);
  assert.ok(result.cases.every((item) => !("expected" in item)));
  assert.ok(result.cases.every((item) => !("received" in item)));
});

await expectVerdict(
  "TLE: an infinite loop reaches the wall-clock limit",
  `int main(){ for(;;){} }`,
  "TLE",
);

await expectVerdict(
  "RE: a crashing process is reported as a runtime error",
  `int main(){ volatile int *pointer = nullptr; *pointer = 7; }`,
  "RE",
);

await expectVerdict(
  "MLE: an allocation beyond the quest limit is rejected",
  `#include <bits/stdc++.h>
using namespace std;
int main(){
  const size_t bytes = 256ULL * 1024 * 1024;
  volatile char *memory = new char[bytes];
  for (size_t i = 0; i < bytes; i += 4096) memory[i] = 1;
  cout << memory[0] << '\\n';
}`,
  "MLE",
);

await expectVerdict(
  "OLE: output beyond the safety limit is rejected",
  `#include <cstdio>
int main(){
  for (int i = 0; i < 200000; ++i) {
    std::puts("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789");
  }
}`,
  "OLE",
);

await test("hidden tests are never persisted in the contestant-visible mount", { skip: !enabled }, async () => {
  const securityQuest = {
    language: "cpp14",
    timeLimitMs: 1000,
    memoryLimitMb: 64,
    compileLimitMs: 15000,
    passScore: 100,
    tests: [{ id: "01", input: "PRIVATE_INPUT_CANARY", expected: "SAFE" }],
  };
  const source = `#include <fstream>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>
using namespace std;

int main(){
  bool exposed = ifstream("/submission/manifest.json").good();
  exposed = exposed || ofstream("/submission/contestant-write-probe").good();
  ifstream commandLine("/proc/1/cmdline", ios::binary);
  string command((istreambuf_iterator<char>(commandLine)), istreambuf_iterator<char>());
  string current;
  for (char ch : command) {
    if (ch == '\\0') {
      if (current.find("/judge-data/jobs/") == 0 && ifstream(current + "/manifest.json").good()) exposed = true;
      current.clear();
    } else {
      current += ch;
    }
  }
  ifstream supervisorInput("/proc/1/fd/0", ios::binary);
  char byte = 0;
  if (supervisorInput.get(byte)) exposed = true;
  cout << (exposed ? "LEAK" : "SAFE") << '\\n';
}`;
  const result = await judgeCpp14(source, securityQuest);
  assert.equal(result.verdict, "AC", JSON.stringify(result));
});
