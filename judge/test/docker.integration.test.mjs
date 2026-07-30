import test from "node:test";
import assert from "node:assert/strict";
import { judgeCpp14 } from "../src/docker-runner.mjs";
import { quests } from "../src/quests.mjs";

const enabled = process.env.JUDGE_DOCKER_TEST === "1";
const quest = quests["signal-fire"];

test("correct C++14 solution is accepted", { skip: !enabled }, async () => {
  const result = await judgeCpp14(
    `#include <bits/stdc++.h>
using namespace std;
int main(){ long long a,b; cin>>a>>b; cout<<a+b<<'\\n'; }`,
    quest,
  );
  assert.equal(result.verdict, "AC");
  assert.equal(result.containerStarts, 1);
  assert.equal(result.cases.length, quest.tests.length);
});

test("missing semicolon is a compile error", { skip: !enabled }, async () => {
  const result = await judgeCpp14(
    `#include <bits/stdc++.h>
using namespace std;
int main(){ long long a,b; cin>>a>>b; cout<<a+b return 0; }`,
    quest,
  );
  assert.equal(result.verdict, "CE");
});

test("incorrect output is rejected", { skip: !enabled }, async () => {
  const result = await judgeCpp14(
    `#include <bits/stdc++.h>
using namespace std;
int main(){ long long a,b; cin>>a>>b; cout<<a-b<<'\\n'; }`,
    quest,
  );
  assert.equal(result.verdict, "WA");
  assert.equal(result.cases.length, quest.tests.length);
  assert.ok(result.cases.every((item) => !("expected" in item)));
  assert.ok(result.cases.every((item) => !("received" in item)));
});

test("infinite loop reaches the wall-clock limit", { skip: !enabled }, async () => {
  const result = await judgeCpp14(
    `int main(){ for(;;){} }`,
    quest,
  );
  assert.equal(result.verdict, "TLE");
});
