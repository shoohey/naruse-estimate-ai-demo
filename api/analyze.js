const REFERENCE_DATA = require('../reference-data');

// Vercel Serverless Function config
module.exports.config = { maxDuration: 300 };

// ============================
// Claude API 呼び出し（SDKなし、fetchのみ）
// ============================
async function callClaude(apiKey, userContent, systemPrompt, model) {
  const body = {
    model: model || 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    messages: [{ role: 'user', content: userContent }]
  };
  if (systemPrompt) body.system = systemPrompt;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });

  const data = await resp.json();
  if (data.error) throw new Error(data.error.message);
  return data.content[0].text;
}

function parseJSON(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { raw: text };
  try { return JSON.parse(m[0]); } catch {
    try { return JSON.parse(m[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')); } catch { return { raw: text }; }
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
総額（税抜）: ${(r.project.totalCostExclTax/10000).toLocaleString()}万円 / m2単価: ${r.project.costPerM2.toLocaleString()}円
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
  return base + '\n【参照単価DB】' + (db[domain] || '');
}

// ============================
// 各エージェントのシステムプロンプト
// ============================
const AGENT_PROMPTS = [
  { name: '建築図面解析AI', system: `建築図面解析の専門AIです。PDF図面から建築工事情報を正確に抽出しJSON出力してください。\n${buildRef('architecture')}\n\n抽出項目: プロジェクト名,建物用途,構造,階数,各階面積,仕上表,建具一覧,外部仕上,解体範囲,特記事項\nJSON形式: {"agent":"建築図面解析AI","projectInfo":{...},"finishes":[...],"fixtures":[...],"estimatedArchCost":0}` },
  { name: '電気設備解析AI', system: `電気設備図面解析の専門AIです。PDF図面から電気設備工事情報を抽出しJSON出力してください。\n${buildRef('electrical')}\n\n抽出項目: 受変電設備,幹線,分電盤,照明器具,コンセント,弱電,放送,自火報,非常照明,誘導灯\nJSON形式: {"agent":"電気設備解析AI","powerSupply":{...},"lighting":[...],"fireAlarm":{...},"estimatedElecCost":0}` },
  { name: '機械設備解析AI', system: `機械設備図面解析の専門AIです。PDF図面から機械設備工事情報を抽出しJSON出力してください。\n${buildRef('mechanical')}\n\n抽出項目: 給水設備,排水設備,衛生器具,空調設備,換気設備,消火設備,厨房設備\nJSON形式: {"agent":"機械設備解析AI","hvac":{...},"ventilation":{...},"sanitary":[...],"estimatedMechCost":0}` },
  { name: '仕様・条件解析AI', system: `建設プロジェクト仕様解析の専門AIです。PDF図面から見積もり条件を抽出しJSON出力してください。\n${buildRef('conditions')}\n\n抽出項目: 建物用途,m2単価ベンチマーク,材料指定,施工条件,防火要件,防水仕様,試験検査,推奨費率\nJSON形式: {"agent":"仕様・条件解析AI","buildingType":"","benchmarkCostPerM2":{},"recommendedFeeRatios":{},"estimatedCostPerM2":0}` },
];

function getAgent5Prompt(r1, r2, r3, r4) {
  return `数量積算の専門AIです。4体の解析結果を統合し正確な概算見積もりをJSON出力してください。\n${buildRef('full')}\n\n【解析結果】建築:${JSON.stringify(r1)}\n電気:${JSON.stringify(r2)}\n機械:${JSON.stringify(r3)}\n条件:${JSON.stringify(r4)}\n\n全金額は整数(円)で出力。JSON形式: {"agent":"数量積算AI","categories":[{"id":"1","name":"共通仮設工事","amount":0,"items":[{"name":"","spec":"","quantity":0,"unit":"","unitPrice":0,"amount":0}]},...],"totalBeforeTax":0,"tax":0,"totalWithTax":0}`;
}

function getAgent6Prompt(r5, r4) {
  return `見積書作成の専門AIです。積算結果を整形しプロフェッショナルな御見積書をJSON出力してください。\n\n【積算結果】${JSON.stringify(r5)}\n【条件】${JSON.stringify(r4)}\n\n金額整合性を確認し修正。精度評価(A:±10%/B:±20%/C:±30%)を判定。JSON形式: {"agent":"見積書生成AI","estimate":{"title":"概算御見積書","summary":{"directCostTotal":0,"managementFee":0,"overhead":0,"discount":0,"legalWelfare":0,"totalBeforeTax":0,"tax":0,"totalWithTax":0},"categories":[...],"accuracy":{"grade":"","range":"","note":"","comparisonWithReference":""},"assumptions":[],"exclusions":[]}}`;
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

  const { pdfs, projectName, clientName } = req.body || {};
  if (!pdfs || !pdfs.length) { res.status(400).json({ error: 'PDFデータが必要です' }); return; }

  // SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (type, data) => {
    try { res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`); } catch {}
  };

  // PDF content blocks for Claude
  const pdfContents = pdfs.map(p => ({
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: p.base64 }
  }));

  const ctx = [projectName ? `工事名称: ${projectName}` : '', clientName ? `宛先: ${clientName}` : ''].filter(Boolean).join('\n');

  async function runAgent(num, name, systemPrompt, userContent, model) {
    const t0 = Date.now();
    send('agent_start', { agent: num, name });
    try {
      const text = await callClaude(apiKey, userContent, systemPrompt, model);
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      send('agent_complete', { agent: num, name, elapsed });
      return parseJSON(text);
    } catch (err) {
      send('agent_error', { agent: num, name, error: err.message, elapsed: ((Date.now() - t0) / 1000).toFixed(1) });
      return { error: err.message };
    }
  }

  try {
    // Phase 1: 4体並列
    send('phase', { phase: 1, message: 'Phase 1: 4体のAIが並列で図面を解析中...' });

    const phase1 = await Promise.all(AGENT_PROMPTS.map((a, i) =>
      runAgent(i + 1, a.name, a.system, [
        ...pdfContents,
        { type: 'text', text: `この建設プロジェクトのPDF図面を解析してください。\n${ctx}` }
      ])
    ));
    const [r1, r2, r3, r4] = phase1;

    // Phase 2: 数量積算
    send('phase', { phase: 2, message: 'Phase 2: 数量積算AIが全データを統合中...' });
    const r5 = await runAgent(5, '数量積算AI', getAgent5Prompt(r1, r2, r3, r4),
      [{ type: 'text', text: '上記の指示に従い、概算見積もりを作成してください。' }]);

    // Phase 3: 見積書生成
    send('phase', { phase: 3, message: 'Phase 3: 見積書生成AIが最終見積書を作成中...' });
    const r6 = await runAgent(6, '見積書生成AI', getAgent6Prompt(r5, r4),
      [{ type: 'text', text: '上記の指示に従い、御見積書を完成させてください。' }]);

    send('complete', {
      phases: { architecture: r1, electrical: r2, mechanical: r3, conditions: r4, quantitySurvey: r5, estimate: r6 }
    });
  } catch (err) {
    send('error', { message: err.message || 'エラーが発生しました' });
  }

  res.end();
};
