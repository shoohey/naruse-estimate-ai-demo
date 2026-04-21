const REFERENCE_DATA = require('../reference-data');

// Vercel Serverless Function config
module.exports.config = { maxDuration: 300 };

// ============================
// 設定
// ============================
const MODEL_FAST     = 'claude-haiku-4-5';   // Haiku 4.5 — 図面解析(Agent 1-4): 最速・低コスト・レート制限緩い
const MODEL_PRIMARY  = 'claude-sonnet-4-6';  // Sonnet 4.6 — 見積書整形(Agent 6): バランス型
const MODEL_REASONING = 'claude-opus-4-7';   // Opus 4.7 — 数量積算・検証(Agent 5/7): 深い推論
const MAX_TOKENS_DEFAULT = 16000;
const MAX_TOKENS_REASONING = 24000;
// Opus 4.7 は adaptive thinking のみ。budget_tokens/temperature/top_p/top_k は 400 になる。
const THINKING_EFFORT = 'high'; // low | medium | high | xhigh | max

// ============================
// ユーティリティ
// ============================
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ============================
// JSONパース（堅牢化）
// ============================
function parseJSONRobust(text) {
  if (text == null) return { raw: '' };
  if (typeof text === 'object') return text;

  // 1) コードフェンス除去
  let s = String(text)
    .replace(/```json\s*/gi, '')
    .replace(/```\s*$/g, '')
    .replace(/^```/g, '')
    .trim();

  // 2) 直接パース試行
  try { return JSON.parse(s); } catch {}

  // 3) 最初の { から最後の } までを切り出してリトライ
  const firstBrace = s.indexOf('{');
  const lastBrace  = s.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    let candidate = s.slice(firstBrace, lastBrace + 1);
    try { return JSON.parse(candidate); } catch {}

    // 4) よくある問題を修復
    let repaired = candidate
      .replace(/,\s*}/g, '}')                   // 末尾カンマ
      .replace(/,\s*]/g, ']')                   // 配列末尾カンマ
      .replace(/[\u0000-\u001F]+/g, ' ')        // 制御文字
      .replace(/[""]/g, '"')                     // 全角引用符
      .replace(/['']/g, "'")                     // 全角アポストロフィ
      .replace(/(\w)\s*:\s*(?=[a-zA-Z_])/g, '$1: ')
      .replace(/\bNaN\b/g, '0')
      .replace(/\bInfinity\b/g, '0')
      .replace(/\bundefined\b/g, 'null');

    try { return JSON.parse(repaired); } catch {}

    // 5) 最終手段: 中括弧バランスを取って切り詰め
    let depth = 0, end = -1;
    for (let i = 0; i < repaired.length; i++) {
      if (repaired[i] === '{') depth++;
      else if (repaired[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end > 0) {
      try { return JSON.parse(repaired.slice(0, end + 1)); } catch {}
    }
  }

  return { raw: text, _parseError: true };
}

// ============================
// Claude API 呼び出し（Extended Thinking & リトライ付き）
// ============================
async function callClaude(apiKey, userContent, systemPrompt, opts = {}) {
  const {
    model = MODEL_PRIMARY,
    maxTokens = MAX_TOKENS_DEFAULT,
    thinking = false,
    temperature = 0.2,
  } = opts;

  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: userContent }],
  };
  if (systemPrompt) body.system = systemPrompt;
  // Opus 4.7 の Extended Thinking は adaptive 形式のみ。
  // budget_tokens/temperature/top_p/top_k を送ると 400 になるので厳格に分岐。
  if (thinking) {
    body.thinking = { type: 'adaptive' };
    body.output_config = { effort: THINKING_EFFORT };
    // ↑ 旧形式 { type: 'enabled', budget_tokens: N } は Opus 4.7 では禁止
  } else {
    // thinking 無効時のみ temperature を送る(Opus 4.7 で thinking:false にはしない運用)
    body.temperature = temperature;
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    let errMsg = `API error (${resp.status})`;
    let isRateLimit = resp.status === 429;
    let isOverloaded = resp.status === 529;
    let errType = null;
    try {
      const errData = await resp.json();
      if (errData.error) {
        errMsg = errData.error.message || errMsg;
        errType = errData.error.type;
        if (errType === 'rate_limit_error') isRateLimit = true;
        if (errType === 'overloaded_error') isOverloaded = true;
      }
    } catch {}
    // Opus 4.7 の thinking/sampling パラメータ誤りは 400 で返る。明確な原因メッセージに変換。
    if (resp.status === 400) {
      if (/thinking\.type\.(enabled|adaptive)/i.test(errMsg) || /output_config\.effort/i.test(errMsg)) {
        errMsg = `[Opus4.7 フォーマット不一致] ${errMsg} — thinking.type: 'adaptive' と output_config.effort を使用してください(budget_tokensは禁止)`;
      } else if (/temperature|top_p|top_k/i.test(errMsg)) {
        errMsg = `[Opus4.7 パラメータ禁止] ${errMsg} — Opus 4.7 では thinking 有効時に temperature/top_p/top_k を送れません`;
      }
    }
    const e = new Error(errMsg);
    e.isRateLimit = isRateLimit;
    e.isOverloaded = isOverloaded;
    e.status = resp.status;
    e.apiErrorType = errType;
    throw e;
  }

  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  if (!data.content || !data.content.length) throw new Error('Empty response from API');

  // thinking が有効なときは text ブロックを集める
  const textBlocks = data.content.filter(c => c.type === 'text');
  if (!textBlocks.length) throw new Error('No text in response');
  return textBlocks.map(c => c.text).join('\n');
}

async function callClaudeWithRetry(apiKey, userContent, systemPrompt, opts, send, agentNum, agentName) {
  const maxRetries = (opts && opts.maxRetries != null) ? opts.maxRetries : 4;
  const baseWait = (opts && opts.baseWaitSec != null) ? opts.baseWaitSec : 30;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await callClaude(apiKey, userContent, systemPrompt, opts);
    } catch (err) {
      const recoverable = err.isRateLimit || err.isOverloaded || err.status === 503 || err.status === 504;
      if (recoverable && attempt < maxRetries) {
        const waitSec = Math.min(60, (attempt + 1) * (err.isRateLimit ? baseWait : Math.max(5, baseWait / 3)));
        if (send) send('agent_retry', { agent: agentNum, name: agentName, attempt: attempt + 1, waitSec, reason: err.isRateLimit ? 'rate_limit' : 'overloaded' });
        await delay(waitSec * 1000);
        continue;
      }
      throw err;
    }
  }
}

// ============================
// 参照データ → プロンプト生成
// ============================
function buildRef(domain) {
  const r = REFERENCE_DATA;
  const base = `
【参照プロジェクト: ${r.project.name}】
用途: ${r.project.type} / 構造: ${r.project.structure} ${r.project.floors}階 / 延床: ${r.project.totalFloorArea}m2
総額(税抜): ${(r.project.totalCostExclTax/10000).toLocaleString()}万円 / m2単価: ${r.project.costPerM2.toLocaleString()}円
【工事比率】${Object.entries(r.categories).map(([k,v])=>`${k}: ${(v.ratio*100).toFixed(1)}%`).join(' / ')}`;

  const db = {
    architecture: JSON.stringify(r.unitPrices, null, 1),
    electrical: JSON.stringify(r.electricalPrices, null, 1),
    mechanical: JSON.stringify(r.mechanicalPrices, null, 1),
    conditions: JSON.stringify(r.feeRatios, null, 1) + '\n' + JSON.stringify(r.benchmarkCostPerM2, null, 1),
  };
  if (domain === 'full') {
    return base + '\n【建築単価】' + db.architecture + '\n【電気単価】' + db.electrical + '\n【機械単価】' + db.mechanical + '\n【費率】' + db.conditions;
  }
  if (domain === 'summary') {
    return base + '\n【費率・ベンチマーク】' + db.conditions;
  }
  return base + '\n【参照単価DB】' + (db[domain] || '');
}

// ============================
// 各エージェントのシステムプロンプト
// ============================
const COMMON_RULES = `
【共通遵守事項】
- 出力は必ず単一の有効なJSONオブジェクトのみ。前後の説明文・コードフェンス・コメントは禁止。
- すべての金額は整数(円単位)。負の値や小数は使用しない(値引きは正の絶対値で別フィールドに)。
- PDFから読み取れない値は推定根拠を "basis" に明記し、参照プロジェクトの比率/単価に基づいて推定する。
- 数量×単価=金額 が必ず一致するよう自己検算する。
- 単位は m2/m/m3/個/台/箇所/式 など標準SI/慣用単位を使う。
`;

const AGENT_PROMPTS = [
  {
    name: '建築図面解析AI',
    system: `あなたは建築図面解析の専門AIです。PDF図面から建築工事情報を漏れなく抽出してください。
${buildRef('architecture')}
${COMMON_RULES}

【抽出項目】
- プロジェクト名/建物名/用途/構造/階数/建物高さ
- 敷地面積/建築面積/延床面積/各階面積と用途
- 内部仕上(各室の床/壁/天井 と面積)
- 外部仕上(屋根/外壁/外構)
- 建具一覧(種別/サイズ/数量/材質)
- 解体・撤去工事範囲(対象/数量)
- 防水/耐火/特殊条件等の特記
- 概算金額(参照単価DBで推定し basis を記載)

【出力JSONフォーマット】
{
  "agent": "建築図面解析AI",
  "projectInfo": {
    "name": "", "use": "", "structure": "", "floors": 0,
    "siteArea": 0, "buildingArea": 0, "totalFloorArea": 0,
    "floorDetails": [{"floor": "", "area": 0, "use": ""}]
  },
  "finishes": {
    "interior": [{"room": "", "floor": "", "wall": "", "ceiling": "", "area": 0}],
    "exterior": {"roof": "", "wall": "", "entrance": ""}
  },
  "fixtures": [{"type": "", "size": "", "quantity": 0, "material": "", "estimatedPrice": 0, "basis": ""}],
  "demolition": [{"item": "", "quantity": 0, "unit": "", "estimatedPrice": 0, "basis": ""}],
  "specialNotes": [],
  "estimatedArchCost": 0,
  "confidence": "high|medium|low",
  "missingInfo": []
}`
  },
  {
    name: '電気設備解析AI',
    system: `あなたは電気設備図面解析の専門AIです。PDF図面から電気設備情報を漏れなく抽出してください。
${buildRef('electrical')}
${COMMON_RULES}

【抽出項目】
- 受変電(キュービクル/変圧器容量/受電方式)
- 幹線(ケーブル種別/サイズ/長さ)
- 分電盤(名称/容量/回路数)
- 照明器具(種別/型番/数量/階別)
- コンセント設備
- 弱電(LAN/電話/TV共聴)/放送
- 自火報(受信機/感知器種別/数量)
- 非常照明・誘導灯
- EMS・省エネ設備

【出力JSONフォーマット】
{
  "agent": "電気設備解析AI",
  "powerSupply": {"type": "", "capacity": "", "voltage": ""},
  "mainLines": [{"name": "", "cableType": "", "size": "", "length": 0, "estimatedPrice": 0, "basis": ""}],
  "panels": [{"name": "", "capacity": "", "circuits": 0, "estimatedPrice": 0}],
  "lighting": [{"type": "", "model": "", "quantity": 0, "floor": "", "estimatedPrice": 0}],
  "outlets": [{"type": "", "quantity": 0, "floor": ""}],
  "weakCurrent": [{"type": "", "quantity": 0}],
  "fireAlarm": {"receiver": "", "detectors": [{"type": "", "quantity": 0}]},
  "emergencyLighting": [{"type": "", "quantity": 0, "estimatedPrice": 0}],
  "estimatedElecCost": 0,
  "confidence": "high|medium|low",
  "missingInfo": []
}`
  },
  {
    name: '機械設備解析AI',
    system: `あなたは機械設備図面解析の専門AIです。PDF図面から機械設備情報を漏れなく抽出してください。
${buildRef('mechanical')}
${COMMON_RULES}

【抽出項目】
- 給水(配管系統/管種/口径/長さ/ポンプ/受水槽)
- 排水(配管/管種/口径/桝/グリストラップ)
- 衛生器具(便器/洗面器/手洗器の種別/型番/数量)
- 空調(室内機/室外機の種別/容量/台数)
- 換気(ファン種別/台数/ダクト)
- 消火(SP/消火栓/消火器/フード消火)
- 厨房設備/ガス設備

【出力JSONフォーマット】
{
  "agent": "機械設備解析AI",
  "waterSupply": {"pipes": [{"type": "", "diameter": "", "length": 0}], "equipment": []},
  "drainage": {"pipes": [{"type": "", "diameter": "", "length": 0}], "traps": [], "manholes": 0},
  "sanitary": [{"name": "", "model": "", "quantity": 0, "estimatedPrice": 0}],
  "hvac": {"indoorUnits": [{"name": "", "capacity": "", "quantity": 0}], "outdoorUnits": [], "estimatedCost": 0},
  "ventilation": {"fans": [{"name": "", "model": "", "quantity": 0}], "ducts": [], "estimatedCost": 0},
  "fireProtection": [{"type": "", "quantity": 0, "estimatedPrice": 0}],
  "estimatedMechCost": 0,
  "confidence": "high|medium|low",
  "missingInfo": []
}`
  },
  {
    name: '仕様・条件解析AI',
    system: `あなたは建設プロジェクト仕様・条件解析の専門AIです。
${buildRef('conditions')}
${COMMON_RULES}

【抽出項目】
- 建物用途とベンチマーク単価の選定
- 適用基準/規格(JIS/公共建築工事標準仕様書等)
- 材料・メーカー指定
- 特殊な施工条件(夜間/営業中/騒音制限)
- 防水仕様/保証年数
- 耐火・防火区画
- 試験・検査要求
- 工期影響条件
- 推奨費率(現場管理費/諸経費/法定福利費/値引)

【出力JSONフォーマット】
{
  "agent": "仕様・条件解析AI",
  "buildingType": "",
  "benchmarkCostPerM2": {"min": 0, "typical": 0, "max": 0},
  "applicableStandards": [],
  "materialSpecs": [{"category": "", "spec": "", "impact": ""}],
  "constructionConditions": [{"condition": "", "costImpact": ""}],
  "fireResistance": {"type": "", "requirements": []},
  "waterproofing": {"spec": "", "guaranteeYears": 0},
  "inspections": [],
  "recommendedFeeRatios": {
    "managementFee": 0, "overhead": 0, "legalWelfare": 0, "discount": 0
  },
  "estimatedCostPerM2": 0,
  "riskFactors": [],
  "confidence": "high|medium|low",
  "missingInfo": []
}`
  },
];

function getAgent5Prompt(r1, r2, r3, r4) {
  return `あなたは建設プロジェクトの数量積算AI(チーフ・エスティメーター)です。
4体の解析結果を統合し、参照単価DBに基づく正確な概算見積もりをJSON出力してください。

${buildRef('summary')}
${COMMON_RULES}

【解析結果】
建築: ${JSON.stringify(r1)}
電気: ${JSON.stringify(r2)}
機械: ${JSON.stringify(r3)}
条件: ${JSON.stringify(r4)}

【手順】
1. 延床面積×ベンチマーク単価で総額のレンジを算定(検算用)
2. 各カテゴリの直接工事費を積み上げる
3. 不明項目は参照プロジェクトの比率(共通仮設3.4% / 建築40% / 電気11% / 機械41%)で按分
4. 諸経費・現場管理費・法定福利費・値引を費率テンプレートで算定
5. 直接工事費 → 工事価格 → 税抜合計 → 税込合計 を順に計算

【出力JSONフォーマット】
{
  "agent": "数量積算AI",
  "projectSummary": {
    "name": "", "use": "", "structure": "", "floors": 0, "totalFloorArea": 0,
    "referenceM2Cost": 0, "estimatedM2Cost": 0
  },
  "categories": [
    {"id": "1", "name": "共通仮設工事", "amount": 0, "items": [{"name": "", "spec": "", "quantity": 0, "unit": "", "unitPrice": 0, "amount": 0, "basis": ""}]},
    {"id": "2", "name": "建築工事", "amount": 0, "subcategories": [{"name": "", "amount": 0, "items": []}]},
    {"id": "3", "name": "電気設備工事", "amount": 0, "subcategories": []},
    {"id": "4", "name": "機械設備工事", "amount": 0, "subcategories": []}
  ],
  "directCostTotal": 0,
  "feeBreakdown": {"managementFee": 0, "designFee": 0, "overhead": 0, "legalWelfare": 0},
  "discount": 0,
  "totalBeforeTax": 0,
  "tax": 0,
  "totalWithTax": 0,
  "selfCheck": {
    "categorySumMatchesDirectCost": true,
    "m2CostInBenchmarkRange": true,
    "calculationNotes": ""
  }
}`;
}

function getAgent6Prompt(r5, r4) {
  return `あなたは見積書整形の専門AIです。積算結果を整形しプロフェッショナルな御見積書をJSON出力してください。

【積算結果】${JSON.stringify(r5)}
【条件】${JSON.stringify(r4)}
${COMMON_RULES}

【指示】
1. 数量×単価=金額 を必ず再検算し、誤りがあれば修正
2. カテゴリ合計と直接工事費合計の整合
3. 直接工事費 → 諸経費等 → 工事価格 → 法定福利費 → 税抜合計 → 税込合計 を再計算
4. 精度評価グレードを判定: A=±10% / B=±20% / C=±30%
5. 参照プロジェクトのm2単価との差異を comparisonWithReference に記載
6. 前提条件と除外事項を最低3件ずつ列挙

【出力JSONフォーマット】
{
  "agent": "見積書生成AI",
  "estimate": {
    "title": "概算御見積書",
    "subtitle": "AI自動生成(参照: 西友座間林間店 新店工事)",
    "date": "${new Date().toLocaleDateString('ja-JP')}",
    "projectName": "",
    "clientName": "",
    "location": "",
    "buildingInfo": "",
    "summary": {
      "directCostTotal": 0,
      "managementFee": 0,
      "designFee": 0,
      "overhead": 0,
      "subtotalBeforeDiscount": 0,
      "discount": 0,
      "constructionPrice": 0,
      "legalWelfare": 0,
      "totalBeforeTax": 0,
      "tax": 0,
      "totalWithTax": 0
    },
    "categories": [
      {"id": "1", "name": "共通仮設工事", "amount": 0, "items": [{"name": "", "spec": "", "quantity": 0, "unit": "", "unitPrice": 0, "amount": 0, "note": ""}]}
    ],
    "accuracy": {"grade": "A|B|C", "range": "", "note": "", "comparisonWithReference": ""},
    "assumptions": [],
    "exclusions": []
  }
}`;
}

function getAgent7Prompt(r6, r5) {
  return `あなたは建設見積書の精度検証AIです。Agent6が生成した御見積書の整合性・妥当性を厳密にチェックし、必要なら修正してください。

【Agent6: 見積書】
${JSON.stringify(r6)}

【Agent5: 積算根拠】
${JSON.stringify(r5)}

【参照プロジェクト】
- 名称: ${REFERENCE_DATA.project.name}
- 用途: ${REFERENCE_DATA.project.type}
- 構造: ${REFERENCE_DATA.project.structure} ${REFERENCE_DATA.project.floors}階
- 延床: ${REFERENCE_DATA.project.totalFloorArea}m2
- 税抜総額: ${REFERENCE_DATA.project.totalCostExclTax.toLocaleString()}円
- m2単価: ${REFERENCE_DATA.project.costPerM2.toLocaleString()}円/m2

【建物用途別 m2単価ベンチマーク】
${JSON.stringify(REFERENCE_DATA.benchmarkCostPerM2, null, 1)}

${COMMON_RULES}

【検証項目】
1. 計算整合性
   - 各 item: quantity × unitPrice == amount か
   - 各 subcategory: items合計 == subcategory.amount か
   - 各 category: subcategories/items合計 == category.amount か
   - directCostTotal == categoriesの合計か
   - totalBeforeTax == directCost + 諸経費等 - 値引 + 法定福利費 か
   - tax == round(totalBeforeTax * 0.10) か
   - totalWithTax == totalBeforeTax + tax か
2. 妥当性
   - m2単価 が建物用途のベンチマーク範囲内か
   - 工種比率が参照(建築40%/電気11%/機械41%)と大きく乖離していないか
   - 異常に高い/安い項目がないか
3. 完全性
   - 必須項目(直接工事費・諸経費・法定福利費・税)がすべて埋まっているか
   - assumptions/exclusions が3件以上あるか

【出力JSONフォーマット】
{
  "agent": "精度検証AI",
  "validationReport": {
    "overallStatus": "passed|warnings|errors_fixed",
    "calculationCheck": {
      "passed": true,
      "issues": [{"location": "", "expected": 0, "actual": 0, "fixed": true}]
    },
    "validityCheck": {
      "m2CostJudgement": "in_range|above_range|below_range",
      "categoryRatioJudgement": "normal|outlier",
      "outlierItems": []
    },
    "completenessCheck": {
      "missingFields": [],
      "addedFields": []
    }
  },
  "estimate": { /* Agent6 と同じスキーマ。修正済みの確定版 */ }
}`;
}

// ============================
// モジュールレベル runAgent
// ============================
async function runAgentFn(apiKey, num, name, systemPrompt, userContent, opts, send) {
  const t0 = Date.now();
  send('agent_start', { agent: num, name });
  try {
    const text = await callClaudeWithRetry(apiKey, userContent, systemPrompt, opts || {}, send, num, name);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const parsed = parseJSONRobust(text);
    send('agent_complete', { agent: num, name, elapsed, hasParseError: !!parsed._parseError });
    return parsed;
  } catch (err) {
    send('agent_error', { agent: num, name, error: err.message, elapsed: ((Date.now() - t0) / 1000).toFixed(1) });
    return { error: err.message };
  }
}

// ============================
// SSE ヘルパー
// ============================
function setupSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  return (type, data) => {
    try { res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`); } catch {}
  };
}

// ============================
// Group モード: エージェント1-4のみ実行
// ============================
async function handleGroupMode(req, res, apiKey, pdfs, projectName, clientName, groupInfo) {
  const send = setupSSE(res);

  // PDF文書 or 画像(フォールバック時)のコンテンツブロックを構築
  let contentBlocks;
  if (req.body.images && req.body.images.length) {
    // 画像フォールバック: 巨大ページをJPEGに変換して送信されたケース
    contentBlocks = req.body.images.map(img => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.base64 }
    }));
  } else {
    contentBlocks = pdfs.map(p => ({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: p.base64 }
    }));
  }
  const pdfContents = contentBlocks;

  const ctx = [
    projectName ? `工事名称: ${projectName}` : '',
    clientName ? `宛先: ${clientName}` : '',
    groupInfo ? `ページ範囲: ${groupInfo.pages} (グループ${groupInfo.groupIndex + 1}/${groupInfo.totalGroups})` : ''
  ].filter(Boolean).join('\n');

  try {
    // Phase 1: 4エージェントを2並列x2バッチで実行
    // Haikuは速度・レート制限共に有利なので並列度高めでも安定
    const results = [];
    for (let i = 0; i < AGENT_PROMPTS.length; i += 2) {
      const batch = AGENT_PROMPTS.slice(i, i + 2);
      const batchResults = await Promise.all(batch.map((a, j) =>
        runAgentFn(apiKey, i + j + 1, a.name, a.system, [
          ...pdfContents,
          { type: 'text', text: `この建設プロジェクトのPDF図面を解析してください。\n${ctx}` }
        ], { model: MODEL_FAST, maxTokens: MAX_TOKENS_DEFAULT, temperature: 0.2, maxRetries: 3, baseWaitSec: 20 }, send)
      ));
      results.push(...batchResults);
      if (i + 2 < AGENT_PROMPTS.length) await delay(3000);
    }

    const [r1, r2, r3, r4] = results;

    // エラー率を計算(クライアント側でリトライ判定に利用)
    const errorCount = [r1, r2, r3, r4].filter(r => r && r.error).length;

    send('group_complete', {
      group: groupInfo?.groupIndex ?? 0,
      errorCount,
      results: { architecture: r1, electrical: r2, mechanical: r3, conditions: r4 }
    });
  } catch (err) {
    send('error', { message: err.message });
  }

  res.end();
}

// ============================
// Final モード: エージェント5-7を実行
// ============================
async function handleFinalMode(req, res, apiKey, mergedResults, projectName, clientName) {
  const send = setupSSE(res);

  try {
    const mergeGroupResults = (results) => {
      if (!results || results.length === 0) return {};
      if (results.length === 1) return results[0];
      return { mergedFromGroups: results.length, groups: results };
    };

    const r1 = mergeGroupResults(mergedResults.architecture);
    const r2 = mergeGroupResults(mergedResults.electrical);
    const r3 = mergeGroupResults(mergedResults.mechanical);
    const r4 = mergeGroupResults(mergedResults.conditions);

    // Phase 2: 数量積算 (Opus + Extended Thinking)
    send('phase', { phase: 2, message: 'Phase 2: 数量積算AI(深い推論)が全データを統合中...' });
    const groupCount = mergedResults.architecture?.length || 1;
    const mergeNote = (groupCount > 1)
      ? `\n\n重要: 上記の解析結果は${groupCount}グループに分割されたPDFの統合結果です。重複を排除し、全グループの情報を漏れなく統合してください。`
      : '';

    const r5 = await runAgentFn(apiKey, 5, '数量積算AI',
      getAgent5Prompt(r1, r2, r3, r4) + mergeNote,
      [{ type: 'text', text: '上記の指示に従い、概算見積もりを正確に作成してください。' }],
      { model: MODEL_REASONING, maxTokens: MAX_TOKENS_REASONING, thinking: true },
      send);

    // Phase 3: 見積書整形 (Sonnet)
    send('phase', { phase: 3, message: 'Phase 3: 見積書生成AIが最終見積書を整形中...' });
    const r6 = await runAgentFn(apiKey, 6, '見積書生成AI',
      getAgent6Prompt(r5, r4),
      [{ type: 'text', text: '上記の指示に従い、御見積書を完成させてください。' }],
      { model: MODEL_PRIMARY, maxTokens: MAX_TOKENS_REASONING, temperature: 0.1 },
      send);

    // Phase 4: 精度検証 (Opus + Extended Thinking)
    send('phase', { phase: 4, message: 'Phase 4: 精度検証AIが計算整合性を厳密チェック中...' });
    const r7 = await runAgentFn(apiKey, 7, '精度検証AI',
      getAgent7Prompt(r6, r5),
      [{ type: 'text', text: '上記の指示に従い、見積書を厳密に検証し確定版を出力してください。' }],
      { model: MODEL_REASONING, maxTokens: MAX_TOKENS_REASONING, thinking: true },
      send);

    // r7に修正済みestimateがあればそれを最終版とする
    const finalEstimate = (r7 && r7.estimate) ? { agent: '見積書生成AI(検証済み)', estimate: r7.estimate } : r6;

    send('complete', {
      phases: {
        architecture: r1, electrical: r2, mechanical: r3, conditions: r4,
        quantitySurvey: r5, estimate: finalEstimate, validation: r7
      }
    });
  } catch (err) {
    send('error', { message: err.message });
  }

  res.end();
}

// ============================
// Pre-merge モード: 大量グループの中間結果を要約
// ============================
async function handlePreMergeMode(req, res, apiKey) {
  const send = setupSSE(res);
  const { agentName, chunkResults, chunkIndex, totalChunks } = req.body;

  try {
    send('phase', { phase: 1.5, message: `Pre-merge: ${agentName} チャンク${(chunkIndex||0)+1}/${totalChunks||1}を統合中...` });

    const text = await callClaudeWithRetry(
      apiKey,
      [{ type: 'text', text: `以下の${chunkResults.length}グループの解析結果を1つに統合してください。重複項目は数量を合算し、情報を漏れなく含めてください。JSONのみ出力。\n\n${JSON.stringify(chunkResults)}` }],
      `建設図面の解析結果(${agentName})を統合する専門AIです。複数グループの結果を1つの包括的な結果に統合してください。重複排除・数量合算を行い、コンパクトなJSONで出力。`,
      { model: MODEL_FAST, maxTokens: MAX_TOKENS_DEFAULT, temperature: 0.1 },
      send, 0, `${agentName}マージ`
    );

    const merged = parseJSONRobust(text);
    send('pre_merge_complete', { result: merged });
  } catch (err) {
    send('error', { message: err.message });
  }

  res.end();
}

// ============================
// メインハンドラー
// ============================
module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { res.status(500).json({ error: 'APIキーが設定されていません' }); return; }

  const { pdfs, projectName, clientName, mode, mergedResults, groupInfo } = req.body || {};

  // Mode routing
  if (mode === 'group') {
    if (!pdfs?.length && !req.body.images?.length) { res.status(400).json({ error: 'PDFまたは画像データが必要です' }); return; }
    return handleGroupMode(req, res, apiKey, pdfs || [], projectName, clientName, groupInfo);
  }

  if (mode === 'final') {
    if (!mergedResults) { res.status(400).json({ error: 'mergedResultsが必要です' }); return; }
    return handleFinalMode(req, res, apiKey, mergedResults, projectName, clientName);
  }

  // Pre-merge mode: 大量グループの中間結果を要約マージ
  if (mode === 'pre-merge') {
    return handlePreMergeMode(req, res, apiKey);
  }

  // Default mode: 単一グループ向け一括処理
  if (!pdfs || !pdfs.length) { res.status(400).json({ error: 'PDFデータが必要です' }); return; }

  const send = setupSSE(res);

  let pdfContents;
  if (req.body.images && req.body.images.length) {
    pdfContents = req.body.images.map(img => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType || 'image/jpeg', data: img.base64 }
    }));
  } else {
    pdfContents = pdfs.map(p => ({
      type: 'document',
      source: { type: 'base64', media_type: 'application/pdf', data: p.base64 }
    }));
  }

  const ctx = [projectName ? `工事名称: ${projectName}` : '', clientName ? `宛先: ${clientName}` : ''].filter(Boolean).join('\n');

  try {
    // Phase 1: 4体並列(2並列x2バッチ)
    send('phase', { phase: 1, message: 'Phase 1: 4体のAIが並列で図面を解析中...' });

    const phase1 = [];
    for (let i = 0; i < AGENT_PROMPTS.length; i += 2) {
      const batch = AGENT_PROMPTS.slice(i, i + 2);
      const batchResults = await Promise.all(batch.map((a, j) =>
        runAgentFn(apiKey, i + j + 1, a.name, a.system, [
          ...pdfContents,
          { type: 'text', text: `この建設プロジェクトのPDF図面を解析してください。\n${ctx}` }
        ], { model: MODEL_FAST, maxTokens: MAX_TOKENS_DEFAULT, temperature: 0.2 }, send)
      ));
      phase1.push(...batchResults);
      if (i + 2 < AGENT_PROMPTS.length) await delay(3000);
    }
    const [r1, r2, r3, r4] = phase1;

    // レートリミット回避待機
    send('phase', { phase: 1.5, message: 'Phase 1完了。15秒待機後にPhase 2へ...' });
    await delay(15000);

    // Phase 2: 数量積算 (Opus + Extended Thinking)
    send('phase', { phase: 2, message: 'Phase 2: 数量積算AI(深い推論)が全データを統合中...' });
    const r5 = await runAgentFn(apiKey, 5, '数量積算AI', getAgent5Prompt(r1, r2, r3, r4),
      [{ type: 'text', text: '上記の指示に従い、概算見積もりを作成してください。' }],
      { model: MODEL_REASONING, maxTokens: MAX_TOKENS_REASONING, thinking: true }, send);

    // Phase 3: 見積書整形
    send('phase', { phase: 3, message: 'Phase 3: 見積書生成AIが最終見積書を整形中...' });
    const r6 = await runAgentFn(apiKey, 6, '見積書生成AI', getAgent6Prompt(r5, r4),
      [{ type: 'text', text: '上記の指示に従い、御見積書を完成させてください。' }],
      { model: MODEL_PRIMARY, maxTokens: MAX_TOKENS_REASONING, temperature: 0.1 }, send);

    // Phase 4: 検証
    send('phase', { phase: 4, message: 'Phase 4: 精度検証AIが整合性をチェック中...' });
    const r7 = await runAgentFn(apiKey, 7, '精度検証AI', getAgent7Prompt(r6, r5),
      [{ type: 'text', text: '上記の指示に従い、見積書を厳密に検証し確定版を出力してください。' }],
      { model: MODEL_REASONING, maxTokens: MAX_TOKENS_REASONING, thinking: true }, send);

    const finalEstimate = (r7 && r7.estimate) ? { agent: '見積書生成AI(検証済み)', estimate: r7.estimate } : r6;

    send('complete', {
      phases: {
        architecture: r1, electrical: r2, mechanical: r3, conditions: r4,
        quantitySurvey: r5, estimate: finalEstimate, validation: r7
      }
    });
  } catch (err) {
    send('error', { message: err.message || 'エラーが発生しました' });
  }

  res.end();
};
