import type { Quest, QuestProblem } from "@/lib/quests";

export type Locale = "en" | "zh-CN" | "ja";

export const localeOptions: Array<{ value: Locale; label: string }> = [
  { value: "en", label: "EN" },
  { value: "zh-CN", label: "中文" },
  { value: "ja", label: "日本語" },
];

const messages = {
  en: {
    welcome: "WELCOME",
    howItWorks: "HOW_IT_WORKS",
    worldMap: "WORLD_MAP",
    missions: "MISSIONS",
    codex: "CODEX",
    loginToBegin: "LOGIN TO BEGIN_",
    createPlayer: "CREATE PLAYER",
    syncSave: "SYNC_SAVE",
    continueQuest: "CONTINUE",
    replayQuest: "REPLAY",
    cloudSaveOnline: "CLOUD SAVE ONLINE",
    welcomeMode: "WELCOME MODE",
    accountRequired: "ACCOUNT REQUIRED // WELCOME MODE",
    emailRequired: "EMAIL VERIFICATION REQUIRED // WELCOME MODE",
    saveReady: "SAVE SYNCHRONIZED // SELECT A QUEST",
    saveOffline: "SAVE LINK OFFLINE // GAMEPLAY LOCKED",
    checkingSave: "CHECKING PLAYER DATABASE...",
    verifyToUnlock: "VERIFY YOUR EMAIL TO UNLOCK THE WORLD MAP.",
    loginToUnlock: "MISSIONS, EDITOR AND JUDGE UNLOCK AFTER LOGIN.",
    heroEyebrow: "COMPETITIVE PROGRAMMING // ADVENTURE MODE",
    heroTitleA: "LEARN THE SPELLS.",
    heroTitleB: "CONQUER THE ALGORITHMS.",
    heroDescription:
      "Your compiler is your blade. Your complexity is your armor. Travel from the first line of C++ to the deepest ruins of graph theory.",
    campaign: "CAMPAIGN_ROUTE // 01",
    pathTitle: "THE AWAKENING PATH",
    available: "AVAILABLE",
    locked: "LOCKED",
    secret: "SECRET",
    cleared: "CLEARED",
    playable: "PLAYABLE",
    enter: "ENTER",
    selectQuest: "Select a quest to update this briefing.",
    dragMap: "DRAG TO EXPLORE // CLICK A NODE TO SELECT",
    missionReady: "MISSION READY",
    missionBrief: "MISSION BRIEF",
    encrypted: "ENCRYPTED ENCOUNTER",
    difficulty: "DIFFICULTY",
    reward: "REWARD",
    skills: "SKILLS",
    enterMission: "ENTER MISSION_",
    clearQuest: "CLEAR QUEST",
    nextMission: "NEXT MISSION",
    replayable: "REPLAYABLE",
    clickEnter: "CLICK TO ENTER_",
    welcomeProtocol: "WELCOME_PROTOCOL // READ ONLY",
    adventureWorks: "HOW THE ADVENTURE WORKS",
    missionsLocked: "MISSIONS LOCKED",
    welcomeSteps: [
      [
        "CREATE A PLAYER",
        "Register and verify your email. Guests can read this introduction, but cannot open problems or call the judge.",
      ],
      [
        "LEARN THE INTERFACE",
        "Quest 01 walks through the map, mission brief, editor, sample run, hidden tests and cloud autosave.",
      ],
      [
        "NEVER LOSE A RUN",
        "Drafts, source snapshots and every evaluation stay on this device and in your player database.",
      ],
    ],
    chooseSave: "CHOOSE YOUR SAVE",
    saveConflict: "TWO SAVE SLOTS DISAGREE",
    useLocal: "USE LOCAL SAVE",
    useCloud: "USE CLOUD SAVE",
    localSave: "LOCAL SAVE",
    cloudSave: "CLOUD SAVE",
  },
  "zh-CN": {
    welcome: "欢迎",
    howItWorks: "玩法介绍",
    worldMap: "世界地图",
    missions: "关卡",
    codex: "知识库",
    loginToBegin: "登录并开始_",
    createPlayer: "注册玩家",
    syncSave: "同步存档",
    continueQuest: "继续",
    replayQuest: "重玩",
    cloudSaveOnline: "云存档在线",
    welcomeMode: "欢迎模式",
    accountRequired: "需要登录 // 欢迎模式",
    emailRequired: "需要验证邮箱 // 欢迎模式",
    saveReady: "存档已同步 // 请选择关卡",
    saveOffline: "存档连接离线 // 游戏暂时锁定",
    checkingSave: "正在连接玩家数据库……",
    verifyToUnlock: "验证邮箱后即可解锁世界地图。",
    loginToUnlock: "登录后解锁关卡、编辑器和评测机。",
    heroEyebrow: "信息竞赛 // 冒险模式",
    heroTitleA: "学习代码魔法。",
    heroTitleB: "征服算法世界。",
    heroDescription:
      "编译器是你的剑，复杂度是你的甲。从第一行 C++ 出发，探索图论深处的遗迹。",
    campaign: "冒险路线 // 01",
    pathTitle: "觉醒之路",
    available: "可进入",
    locked: "未解锁",
    secret: "隐藏",
    cleared: "已通关",
    playable: "可挑战",
    enter: "进入",
    selectQuest: "单击关卡以更新右侧信息。",
    dragMap: "按住拖动地图 // 单击选择关卡",
    missionReady: "关卡已就绪",
    missionBrief: "关卡信息",
    encrypted: "加密遭遇",
    difficulty: "难度",
    reward: "奖励",
    skills: "知识点",
    enterMission: "进入关卡_",
    clearQuest: "先通关",
    nextMission: "下一关",
    replayable: "可重玩",
    clickEnter: "单击进入_",
    welcomeProtocol: "欢迎协议 // 只读",
    adventureWorks: "冒险如何进行",
    missionsLocked: "关卡尚未解锁",
    welcomeSteps: [
      [
        "创建玩家",
        "注册并验证邮箱。游客可以阅读介绍，但不能打开题目或调用评测机。",
      ],
      [
        "熟悉网页",
        "第一关会依次引导你使用地图、关卡信息、编辑器、样例测试、隐藏测试与云端自动保存。",
      ],
      [
        "永不丢失记录",
        "草稿、每次提交的代码与评测结果会同时保存在当前设备和玩家数据库中。",
      ],
    ],
    chooseSave: "选择存档",
    saveConflict: "本地与云端存档不一致",
    useLocal: "使用本地存档",
    useCloud: "使用云端存档",
    localSave: "本地存档",
    cloudSave: "云端存档",
  },
  ja: {
    welcome: "ようこそ",
    howItWorks: "遊び方",
    worldMap: "ワールドマップ",
    missions: "クエスト",
    codex: "コーデックス",
    loginToBegin: "ログインして開始_",
    createPlayer: "プレイヤー登録",
    syncSave: "セーブ同期",
    continueQuest: "続ける",
    replayQuest: "再挑戦",
    cloudSaveOnline: "クラウドセーブ接続中",
    welcomeMode: "ウェルカムモード",
    accountRequired: "ログインが必要 // ウェルカムモード",
    emailRequired: "メール認証が必要 // ウェルカムモード",
    saveReady: "セーブ同期完了 // クエストを選択",
    saveOffline: "セーブ接続オフライン // プレイをロック",
    checkingSave: "プレイヤーデータベースを確認中…",
    verifyToUnlock: "メール認証後にワールドマップが解放されます。",
    loginToUnlock: "ログイン後にクエスト、エディタ、ジャッジが解放されます。",
    heroEyebrow: "競技プログラミング // アドベンチャーモード",
    heroTitleA: "コードの魔法を学べ。",
    heroTitleB: "アルゴリズムを征服せよ。",
    heroDescription:
      "コンパイラは剣、計算量は鎧。最初の C++ からグラフ理論の遺跡まで旅しよう。",
    campaign: "キャンペーンルート // 01",
    pathTitle: "目覚めの道",
    available: "挑戦可能",
    locked: "ロック中",
    secret: "シークレット",
    cleared: "クリア済み",
    playable: "プレイ可能",
    enter: "入る",
    selectQuest: "クエストをクリックすると右側の情報が変わります。",
    dragMap: "ドラッグでマップ移動 // クリックで選択",
    missionReady: "準備完了",
    missionBrief: "クエスト情報",
    encrypted: "暗号化エンカウンター",
    difficulty: "難易度",
    reward: "報酬",
    skills: "スキル",
    enterMission: "クエスト開始_",
    clearQuest: "先にクリア",
    nextMission: "次のミッション",
    replayable: "再挑戦可能",
    clickEnter: "クリックして入る_",
    welcomeProtocol: "ウェルカムプロトコル // 読み取り専用",
    adventureWorks: "冒険の進め方",
    missionsLocked: "クエストはロック中",
    welcomeSteps: [
      [
        "プレイヤー作成",
        "登録してメールを認証します。ゲストは紹介のみ閲覧でき、問題やジャッジは利用できません。",
      ],
      [
        "画面を学ぶ",
        "クエスト01でマップ、説明、エディタ、サンプル、隠しテスト、クラウド保存を順に学べます。",
      ],
      [
        "履歴を失わない",
        "下書き、提出コード、すべての判定結果を端末とプレイヤーデータベースの両方に保存します。",
      ],
    ],
    chooseSave: "セーブを選択",
    saveConflict: "ローカルとクラウドのセーブが異なります",
    useLocal: "ローカルを使用",
    useCloud: "クラウドを使用",
    localSave: "ローカルセーブ",
    cloudSave: "クラウドセーブ",
  },
} as const;

export function text(locale: Locale) {
  return messages[locale];
}

type QuestTranslation = Partial<
  Pick<Quest, "title" | "subtitle" | "chapter" | "description" | "skills">
> & {
  problem?: Partial<
    Pick<
      QuestProblem,
      "story" | "guidance" | "input" | "constraints" | "output" | "hint"
    >
  >;
};

const questTranslations: Record<
  Exclude<Locale, "en">,
  Record<string, QuestTranslation>
> = {
  "zh-CN": {
    "signal-fire": {
      title: "点亮信号",
      subtitle: "输入、输出与算术",
      chapter: "第 01 章 / 觉醒",
      description: "读取两个能量值并输出它们的和，唤醒沉睡的中继站。",
      skills: ["cin / cout", "变量", "算术"],
      problem: {
        story: [
          "前哨站的中继器已经沉睡了 4,096 个周期。两个能量单元分别储存 a 和 b 单位能量。",
          "读取它们并输出总和，点亮信号。第一关也会带你熟悉整个做题页面。",
        ],
        guidance: [
          "先阅读题目，并找到输入、输出和样例区域。",
          "在 main.cpp 中找到 TODO；编辑器会自动保存代码。",
          "用 cout 完成代码，然后点击“运行样例”。",
          "样例通过后点击“提交答案”，系统会评测全部隐藏测试点。",
          "看到 AC 恭喜卡片后返回地图，下一关会自动解锁。",
        ],
        input: "一行两个整数 a 和 b。",
        constraints: "-10⁹ ≤ a, b ≤ 10⁹",
        output: "输出一个整数：两份能量之和。",
        hint: "中继器通过 cout 接收信号。输出 a + b 即可。",
      },
    },
    "forked-path": {
      title: "分岔之路",
      subtitle: "条件判断",
      chapter: "第 01 章 / 觉醒",
      description: "比较两条隧道的危险值，选择更安全的一条。",
      skills: ["if / else", "比较"],
      problem: {
        story: [
          "山腹中的道路分成左右两条隧道，它们各自报告一个危险值。",
          "输出危险值更小的方向；如果相同，则原地等待。",
        ],
        guidance: [
          "列出左边更小、右边更小、两者相等三种情况。",
          "使用 if / else if / else，确保只输出一个答案。",
          "先运行样例，再提交并检查所有边界情况。",
        ],
        input: "一行两个整数 left 和 right。",
        constraints: "-10⁹ ≤ left, right ≤ 10⁹",
        output: '左边更安全输出 "LEFT"，右边输出 "RIGHT"，相同输出 "EQUAL"。',
        hint: "使用 if 和 else if 比较两个数，别忘记相等的情况。",
      },
    },
    "echo-loop": {
      title: "回声循环",
      subtitle: "循环",
      chapter: "第 01 章 / 觉醒",
      description: "重复发送古老信号，直到大门回应。",
      skills: ["for", "while"],
      problem: {
        story: [
          "封闭的大门只接受从 1 开始递增的脉冲序列。",
          "在一行中发送 1 到 n 的所有整数，用空格分隔。",
        ],
        guidance: [
          "确定循环的起点、终点和每次变化。",
          "使用 for 或 while，并避免输出多余文字。",
          "先运行样例，再提交测试所有隐藏的 n。",
        ],
        input: "一个整数 n。",
        constraints: "1 ≤ n ≤ 1,000",
        output: "一行输出 1, 2, …, n，数字之间用一个空格分隔。",
        hint: "for 循环可以遍历 1 到 n；只在第一个数字之后输出前置空格。",
      },
    },
    "array-vault": {
      title: "数组宝库",
      subtitle: "线性容器",
      chapter: "第 02 章 / 初识数据",
      description: "在一串记忆单元中重建隐藏的密钥。",
      skills: ["数组", "遍历"],
    },
    "sorting-ruins": {
      title: "排序遗迹",
      subtitle: "排序",
      chapter: "第 02 章 / 初识数据",
      description: "将每枚符文放回正确位置，修复破碎的档案。",
      skills: ["sort", "复杂度"],
    },
    "binary-gate": {
      title: "二分之门",
      subtitle: "折半查找",
      chapter: "第 02 章 / 初识数据",
      description: "在大门关闭前，从百万频率中找到目标。",
      skills: ["二分查找", "不变量"],
    },
    "nameless-room": {
      title: "无名之室",
      subtitle: "隐藏遭遇",
      chapter: "隐藏 / 未知",
      description: "墙壁后传来空洞的回声，似乎有什么正在等待。",
      skills: ["???"],
    },
  },
  ja: {
    "signal-fire": {
      title: "信号の火",
      subtitle: "入出力と算術",
      chapter: "第01章 / 目覚め",
      description: "二つのエネルギー値を読み、その合計で中継器を起動します。",
      skills: ["cin / cout", "変数", "算術"],
      problem: {
        story: [
          "前哨基地の中継器は 4,096 サイクル眠っています。二つのセルには a と b のエネルギーがあります。",
          "両方を読み、合計を出力して信号を点火しましょう。この最初のクエストでは画面の使い方も学びます。",
        ],
        guidance: [
          "問題文を読み、入力・出力・サンプル欄を見つけます。",
          "main.cpp の TODO を探します。コードは自動保存されます。",
          "cout で完成させ、「サンプル実行」を押します。",
          "成功したら「解答を提出」で全隠しテストを実行します。",
          "AC のお祝いカードを閉じてマップへ戻ると次が解放されます。",
        ],
        input: "一行に整数 a と b。",
        constraints: "-10⁹ ≤ a, b ≤ 10⁹",
        output: "二つのエネルギーの合計を一つの整数で出力します。",
        hint: "cout で a + b を送信します。",
      },
    },
    "forked-path": {
      title: "分かれ道",
      subtitle: "条件分岐",
      chapter: "第01章 / 目覚め",
      description: "二つの危険度を比較し、安全なトンネルを選びます。",
      skills: ["if / else", "比較"],
      problem: {
        story: [
          "山の中で道が左右に分かれ、それぞれ危険度を報告しています。",
          "小さい側を選び、同じ場合はその場で待機します。",
        ],
        guidance: [
          "左が小さい、右が小さい、等しい、の三通りを整理します。",
          "if / else if / else で答えを一つだけ出力します。",
          "サンプル後に提出して全境界ケースを確認します。",
        ],
        input: "一行に整数 left と right。",
        constraints: "-10⁹ ≤ left, right ≤ 10⁹",
        output: '左なら "LEFT"、右なら "RIGHT"、同じなら "EQUAL"。',
        hint: "if と else if で比較し、等しい場合も忘れないでください。",
      },
    },
    "echo-loop": {
      title: "反響ループ",
      subtitle: "繰り返し",
      chapter: "第01章 / 目覚め",
      description: "門が応えるまで古い信号を繰り返します。",
      skills: ["for", "while"],
      problem: {
        story: [
          "閉ざされた門は 1 から始まる上昇パルスを受け付けます。",
          "1 から n までを一行に空白区切りで送信します。",
        ],
        guidance: [
          "開始値、終了値、毎回の変化を確認します。",
          "for または while を使い、余計な文字を出力しないようにします。",
          "サンプル後に全隠しテストへ提出します。",
        ],
        input: "整数 n。",
        constraints: "1 ≤ n ≤ 1,000",
        output: "1, 2, …, n を一つの空白で区切って一行に出力します。",
        hint: "for で 1 から n を巡回し、二番目以降の前だけ空白を出します。",
      },
    },
    "array-vault": {
      title: "配列の宝庫",
      subtitle: "線形コンテナ",
      chapter: "第02章 / 最初のデータ",
      description: "メモリセルに隠れた鍵を復元します。",
      skills: ["配列", "走査"],
    },
    "sorting-ruins": {
      title: "ソート遺跡",
      subtitle: "整列",
      chapter: "第02章 / 最初のデータ",
      description: "砕けた記録のルーンを正しい順序へ戻します。",
      skills: ["sort", "計算量"],
    },
    "binary-gate": {
      title: "二分の門",
      subtitle: "探索を分割",
      chapter: "第02章 / 最初のデータ",
      description: "門が閉じる前に百万の周波数から一つを探します。",
      skills: ["二分探索", "不変条件"],
    },
    "nameless-room": {
      title: "名もなき部屋",
      subtitle: "隠しエンカウンター",
      chapter: "シークレット / 不明",
      description: "壁の向こうに空洞の音。何かが待っています。",
      skills: ["???"],
    },
  },
};

export function localizeQuest(quest: Quest, locale: Locale): Quest {
  if (locale === "en") return quest;
  const translation = questTranslations[locale][quest.id];
  if (!translation) return quest;
  return {
    ...quest,
    ...translation,
    problem:
      quest.problem && translation.problem
        ? { ...quest.problem, ...translation.problem }
        : quest.problem,
  };
}
