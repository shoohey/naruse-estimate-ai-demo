require('dotenv').config();
const express = require('express');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk').default;
const fs = require('fs');
const path = require('path');
const REFERENCE_DATA = require('./reference-data');
const { PDFDocument } = require('pdf-lib');

const app = express();
const PORT = 3456;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('PDFファイルのみアップロード可能です'));
  }
});

app.use(express.json({ limit: '100mb' }));
app.use(express.static(path.join(__dirname)));

let anthropicClient = null;
if (process.env.ANTHROPIC_API_KEY) {
  anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  console.log('  Anthropic APIキー: .envから自動読み込み済み');
}

app.post('/api/set-key', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return res.status(400).json({ error: 'Invalid API key format' });
  }
  anthropicClient = new Anthropic({ apiKey });
  res.json({ success: true });
});

app.get('/api/status', (req, res) => {
  res.json({ hasKey: !!anthropicClient, mode: 'server', agents: 6 });
});

// ============================
// PDF分割ユーティリティ（大容量PDF対応）
// ============================
async function splitPdfBuffer(buffer, filename, maxPagesPerGroup = 20) {
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    const totalPages = pdfDoc.getPageCount();

    // Small PDF or few pages - no split needed
    if (buffer.length < 5 * 1024 * 1024 && totalPages <= 30) {
      return [{ buffer, name: filename, pages: `1-${totalPages}`, totalPages }];
    }

    console.log(`[split] ${filename}: ${totalPages}ページ, ${(buffer.length / 1024 / 1024).toFixed(1)}MB → 分割処理`);

    const groups = [];
    for (let start = 0; start < totalPages; start += maxPagesPerGroup) {
      const end = Math.min(start + maxPagesPerGroup, totalPages);
      const newDoc = await PDFDocument.create();
      const pageIndices = Array.from({ length: end - start }, (_, i) => start + i);
      const copiedPages = await newDoc.copyPages(pdfDoc, pageIndices);
      copiedPages.forEach(p => newDoc.addPage(p));
      const bytes = await newDoc.save();

      groups.push({
        buffer: Buffer.from(bytes),
        name: `${filename} (p${start + 1}-${end})`,
        pages: `${start + 1}-${end}`,
        totalPages
      });
    }

    console.log(`[split] ${filename}: ${groups.length}グループに分割完了`);
    return groups;
  } catch (err) {
    console.error(`[split] PDF分割エラー: ${err.message}. 分割なしで処理します`);
    return [{ buffer, name: filename, pages: 'all', totalPages: 0 }];
  }
}

// ============================
// 参照データのプロンプト生成
// ============================
function buildReferencePrompt(domain) {
  const ref = REFERENCE_DATA;
  const base = `
【参照プロジェクト: ${ref.project.name}】
- 建物用途: ${ref.project.type}
- 構造: ${ref.project.structure} ${ref.project.floors}階建
- 延床面積: ${ref.project.totalFloorArea} m2
- 総工事費（税抜）: ${(ref.project.totalCostExclTax / 10000).toLocaleString()}万円
- m2単価: ${ref.project.costPerM2.toLocaleString()}円/m2

【工事カテゴリ比率】
${Object.entries(ref.categories).map(([k,v]) => `- ${k}: ${(v.amount/10000).toLocaleString()}万円（${(v.ratio*100).toFixed(1)}%）`).join('\n')}
`;

  if (domain === 'architecture') {
    return base + `
【建築工事 参照単価データベース】
${JSON.stringify(ref.unitPrices, null, 2)}

【建築工事 中項目別金額】
${Object.entries(ref.architectureBreakdown).map(([k,v]) => `- ${k}: ${(v/10000).toLocaleString()}万円`).join('\n')}
`;
  }

  if (domain === 'electrical') {
    return base + `
【電気設備工事 参照単価データベース】
${JSON.stringify(ref.electricalPrices, null, 2)}

【電気設備工事 中項目別金額】
${Object.entries(ref.electricalBreakdown).map(([k,v]) => `- ${k}: ${(v/10000).toLocaleString()}万円`).join('\n')}
`;
  }

  if (domain === 'mechanical') {
    return base + `
【機械設備工事 参照単価データベース】
${JSON.stringify(ref.mechanicalPrices, null, 2)}

【機械設備工事 中項目別金額】
${Object.entries(ref.mechanicalBreakdown).map(([k,v]) => `- ${k}: ${(v/10000).toLocaleString()}万円`).join('\n')}
`;
  }

  if (domain === 'conditions') {
    return base + `
【特記事項・見積もり条件】
${ref.specialConditions.map(s => `- ${s}`).join('\n')}

【工事費率テンプレート】
${JSON.stringify(ref.feeRatios, null, 2)}

【労務単価】
${Object.entries(ref.laborRates).map(([k,v]) => `- ${k}: ${v.price.toLocaleString()}円/${v.unit}`).join('\n')}

【建物用途別 m2単価ベンチマーク】
${Object.entries(ref.benchmarkCostPerM2).map(([k,v]) => `- ${k}: ${v.min.toLocaleString()}〜${v.max.toLocaleString()}円/m2（標準: ${v.typical.toLocaleString()}円/m2）`).join('\n')}
`;
  }

  // full (for quantity surveying / final estimate)
  return base + `
【全参照単価データベース（建築）】
${JSON.stringify(ref.unitPrices, null, 2)}

【全参照単価データベース（電気設備）】
${JSON.stringify(ref.electricalPrices, null, 2)}

【全参照単価データベース（機械設備）】
${JSON.stringify(ref.mechanicalPrices, null, 2)}

【工事費率テンプレート】
${JSON.stringify(ref.feeRatios, null, 2)}

【m2単価ベンチマーク】
${JSON.stringify(ref.benchmarkCostPerM2, null, 2)}

【工事費構成】
${JSON.stringify(ref.costStructure, null, 2)}
`;
}

// ============================
// 6体AIエージェントのプロンプト
// ============================
function getAgent1Prompt() {
  return `あなたは建設プロジェクトの建築図面解析AIです。

以下のPDF図面を精査し、建築工事に関する情報を正確に抽出してJSON形式で返してください。

${buildReferencePrompt('architecture')}

【抽出する情報】
1. プロジェクト名・建物名
2. 建物用途（店舗/オフィス/住宅/工場/病院/学校等）
3. 構造（S造/RC造/SRC造/W造等）
4. 階数・建物高さ
5. 各階の面積（m2）と用途
6. 敷地面積・建築面積・延床面積
7. 内部仕上表の内容（各室の床・壁・天井仕上げ材料と面積）
8. 建具一覧（種類、サイズ、数量、材質）
9. 外部仕上（屋根、外壁、外構）
10. 特記事項（耐火構造、防水仕様、特殊条件等）
11. 解体・撤去工事の範囲
12. エレベーター等の特殊設備

上記の参照単価データベースを活用して、各項目の概算金額も推定してください。

JSONのみ出力してください:
{
  "agent": "建築図面解析AI",
  "projectInfo": {
    "name": "", "buildingName": "", "use": "", "structure": "",
    "floors": 0, "height": 0, "siteArea": 0, "buildingArea": 0,
    "totalFloorArea": 0, "floorDetails": [{"floor": "", "area": 0, "use": ""}]
  },
  "finishes": {
    "interior": [{"room": "", "floor": "", "wall": "", "ceiling": "", "area": 0}],
    "exterior": {"roof": "", "wall": "", "entrance": ""}
  },
  "fixtures": [{"type": "", "size": "", "quantity": 0, "material": "", "estimatedPrice": 0}],
  "demolition": [{"item": "", "quantity": 0, "unit": "", "estimatedPrice": 0}],
  "specialNotes": [],
  "estimatedArchCost": 0
}`;
}

function getAgent2Prompt() {
  return `あなたは建設プロジェクトの電気設備図面解析AIです。

以下のPDF図面を精査し、電気設備工事に関する情報を正確に抽出してJSON形式で返してください。

${buildReferencePrompt('electrical')}

【抽出する情報】
1. 受変電設備（キュービクル、変圧器容量、受電方式）
2. 幹線設備（ケーブル種類・サイズ・長さ）
3. 分電盤一覧（名称、容量、回路数）
4. 照明器具（種類、型番、数量、各階別）
5. コンセント設備（種類、数量）
6. 弱電設備（LAN、電話、TV共聴）
7. 放送設備（スピーカー数量、アンプ仕様）
8. 自動火災報知設備（受信機、感知器種類・数量）
9. 非常照明・誘導灯（種類・数量）
10. EMS・省エネ設備

上記の参照単価データベースを活用して各項目の概算金額も推定してください。

JSONのみ出力:
{
  "agent": "電気設備解析AI",
  "powerSupply": {"type": "", "capacity": "", "voltage": ""},
  "mainLines": [{"name": "", "cableType": "", "size": "", "length": 0, "estimatedPrice": 0}],
  "panels": [{"name": "", "capacity": "", "circuits": 0, "estimatedPrice": 0}],
  "lighting": [{"type": "", "model": "", "wattage": 0, "quantity": 0, "floor": "", "estimatedPrice": 0}],
  "outlets": [{"type": "", "quantity": 0, "floor": ""}],
  "weakCurrent": [{"type": "", "quantity": 0}],
  "fireAlarm": {"receiver": "", "detectors": [{"type": "", "quantity": 0}], "indicators": []},
  "emergencyLighting": [{"type": "", "quantity": 0, "estimatedPrice": 0}],
  "estimatedElecCost": 0
}`;
}

function getAgent3Prompt() {
  return `あなたは建設プロジェクトの機械設備図面解析AIです。

以下のPDF図面を精査し、機械設備工事に関する情報を正確に抽出してJSON形式で返してください。

${buildReferencePrompt('mechanical')}

【抽出する情報】
1. 給水設備（配管系統、管種・口径・長さ、ポンプ、受水槽）
2. 排水設備（配管系統、管種・口径、排水桝、グリストラップ）
3. 衛生器具（便器、洗面器、手洗器等の種類・型番・数量）
4. 空調設備（エアコン種類・容量・台数、室外機）
5. 換気設備（換気ファン種類・台数、ダクト面積・長さ）
6. 消火設備（スプリンクラー、消火栓、消火器、フード消火）
7. 厨房設備（フード、自動消火装置）
8. ガス設備
9. 各機器の型番・メーカー

上記の参照単価データベースを活用して各項目の概算金額も推定してください。

JSONのみ出力:
{
  "agent": "機械設備解析AI",
  "waterSupply": {"pipes": [{"type": "", "diameter": "", "length": 0}], "equipment": []},
  "drainage": {"pipes": [{"type": "", "diameter": "", "length": 0}], "traps": [], "manholes": 0},
  "sanitary": [{"name": "", "model": "", "quantity": 0, "estimatedPrice": 0}],
  "hvac": {"indoorUnits": [{"name": "", "capacity": "", "quantity": 0}], "outdoorUnits": [], "estimatedCost": 0},
  "ventilation": {"fans": [{"name": "", "model": "", "quantity": 0}], "ducts": [], "estimatedCost": 0},
  "fireProtection": [{"type": "", "quantity": 0, "estimatedPrice": 0}],
  "estimatedMechCost": 0
}`;
}

function getAgent4Prompt() {
  return `あなたは建設プロジェクトの仕様・条件解析AIです。

以下のPDF図面を精査し、見積もりに影響する仕様・条件を正確に抽出してJSON形式で返してください。

${buildReferencePrompt('conditions')}

【抽出する情報】
1. 建物用途と類似案件のベンチマーク単価の選定
2. 適用基準・規格（JIS、公共建築工事標準仕様書等）
3. 材料指定・メーカー指定
4. 特殊な施工条件（夜間工事、営業中施工、騒音制限等）
5. 防水仕様・保証年数
6. 耐火・防火区画の要件
7. 省エネ・環境関連の要件
8. 試験・検査の要求事項
9. 工期に影響する条件
10. 近隣対策の必要性
11. 建物用途に基づくm2単価の推定
12. 適用すべき工事費率の推定

JSONのみ出力:
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
  "riskFactors": []
}`;
}

function getAgent5Prompt(agent1Result, agent2Result, agent3Result, agent4Result) {
  return `あなたは建設プロジェクトの数量積算AIです。前段の4体の解析AIの結果を統合し、正確な数量積算と概算見積もりを作成してください。

${buildReferencePrompt('full')}

【Agent1: 建築図面解析結果】
${JSON.stringify(agent1Result, null, 2)}

【Agent2: 電気設備解析結果】
${JSON.stringify(agent2Result, null, 2)}

【Agent3: 機械設備解析結果】
${JSON.stringify(agent3Result, null, 2)}

【Agent4: 仕様・条件解析結果】
${JSON.stringify(agent4Result, null, 2)}

【重要な指示】
- 参照プロジェクト（西友座間林間店）の単価データベースを積極的に活用してください
- 面積が判明している場合は参照m2単価で照合してください
- 設備が判明している場合は参照設備単価を適用してください
- 不明な項目は参照プロジェクトの比率から推定してください
- すべての金額は整数（円単位）で出力してください

JSON形式で出力:
{
  "agent": "数量積算AI",
  "projectSummary": {
    "name": "", "use": "", "structure": "", "floors": 0, "totalFloorArea": 0,
    "referenceM2Cost": 0, "estimatedM2Cost": 0
  },
  "categories": [
    {
      "id": "1", "name": "共通仮設工事", "amount": 0,
      "items": [{"name": "", "spec": "", "quantity": 0, "unit": "", "unitPrice": 0, "amount": 0, "basis": ""}]
    },
    {
      "id": "2", "name": "建築工事", "amount": 0,
      "subcategories": [
        {"name": "直接仮設工事", "amount": 0, "items": [...]},
        {"name": "解体工事", "amount": 0, "items": [...]},
        {"name": "コンクリート工事", "amount": 0, "items": [...]},
        {"name": "金属・鉄骨工事", "amount": 0, "items": [...]},
        {"name": "防水工事", "amount": 0, "items": [...]},
        {"name": "左官工事", "amount": 0, "items": [...]},
        {"name": "塗装工事", "amount": 0, "items": [...]},
        {"name": "建具工事", "amount": 0, "items": [...]},
        {"name": "内装工事", "amount": 0, "items": [...]},
        {"name": "その他工事", "amount": 0, "items": [...]}
      ]
    },
    {
      "id": "3", "name": "電気設備工事", "amount": 0,
      "subcategories": [...]
    },
    {
      "id": "4", "name": "機械設備工事", "amount": 0,
      "subcategories": [...]
    }
  ],
  "directCostTotal": 0,
  "feeBreakdown": {
    "managementFee": 0, "designFee": 0, "overhead": 0, "legalWelfare": 0
  },
  "discount": 0,
  "totalBeforeTax": 0,
  "tax": 0,
  "totalWithTax": 0,
  "accuracy": "A/B/C",
  "accuracyNote": ""
}`;
}

function getAgent6Prompt(agent5Result, agent4Result) {
  return `あなたは建設プロジェクトの御見積書作成AIです。数量積算AIと条件解析AIの結果から、プロフェッショナルな御見積書を完成させてください。

【数量積算結果】
${JSON.stringify(agent5Result, null, 2)}

【条件解析結果】
${JSON.stringify(agent4Result, null, 2)}

【指示】
1. 数量積算結果のデータを整形し、見積書として完成させてください
2. 金額の整合性を確認してください（小計 → 合計の計算が合っているか）
3. 計算に誤りがあれば修正してください
4. 各項目の「basis」（積算根拠）を見積書の備考欄に記載してください
5. 精度評価（A: ±10%以内 / B: ±20%以内 / C: ±30%以上）を判定してください
6. 参照プロジェクトとの比較コメントを付けてください

JSON形式で出力:
{
  "agent": "見積書生成AI",
  "estimate": {
    "title": "概算御見積書",
    "subtitle": "AI自動生成（参照: 西友座間林間店 新店工事）",
    "date": "${new Date().toISOString().slice(0,10).replace(/-/g,'年').replace(/年/, '年') + '日'}",
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
      {
        "id": "1",
        "name": "共通仮設工事",
        "amount": 0,
        "items": [
          {
            "name": "", "spec": "", "quantity": 0, "unit": "",
            "unitPrice": 0, "amount": 0, "note": ""
          }
        ]
      }
    ],
    "accuracy": {
      "grade": "A/B/C",
      "range": "±X%",
      "note": "",
      "comparisonWithReference": ""
    },
    "assumptions": [],
    "exclusions": []
  }
}`;
}

// ============================
// メイン解析エンドポイント（6体AI並列処理）
// ============================
app.post('/api/analyze', upload.array('pdfs', 10), async (req, res) => {
  if (!anthropicClient) {
    return res.status(400).json({ error: 'APIキーが設定されていません' });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'PDFファイルが必要です' });
  }

  // SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  try { res.write(': open\n\n'); } catch {}

  // ハートビート: 10秒ごとにkeepaliveコメントを送出し、クライアントのアイドルウォッチドッグ誤作動と
  // プロキシのアイドル切断を防ぐ。レスポンス終了時に確実に停止する。
  const heartbeat = setInterval(() => {
    try { res.write(`: keepalive ${Date.now()}\n\n`); } catch {}
  }, 10000);
  res.on('close', () => clearInterval(heartbeat));
  res.on('finish', () => clearInterval(heartbeat));

  const send = (type, data) => {
    try { res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`); } catch {}
  };

  const pdfContents = req.files.map(f => ({
    type: 'document',
    source: { type: 'base64', media_type: 'application/pdf', data: f.buffer.toString('base64') }
  }));

  const projectName = req.body.projectName || '';
  const clientName = req.body.clientName || '';

  async function callAgent(agentNum, agentName, systemPrompt, userContent, model) {
    const startTime = Date.now();
    send('agent_start', { agent: agentNum, name: agentName });
    try {
      const response = await anthropicClient.messages.create({
        model: model || 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        messages: [{ role: 'user', content: userContent }],
        system: systemPrompt
      });
      const text = response.content[0].text;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      send('agent_complete', { agent: agentNum, name: agentName, elapsed });

      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          const cleaned = jsonMatch[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
          try { return JSON.parse(cleaned); } catch { return { raw: text }; }
        }
      }
      return { raw: text };
    } catch (err) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      send('agent_error', { agent: agentNum, name: agentName, error: err.message, elapsed });
      return { error: err.message };
    }
  }

  const contextNote = [
    projectName ? `工事名称: ${projectName}` : '',
    clientName ? `宛先: ${clientName}` : ''
  ].filter(Boolean).join('\n');

  try {
    // Split large PDFs into groups
    send('phase', { phase: 0, message: 'Phase 0: PDF解析準備中...' });

    const allGroups = [];
    for (const f of req.files) {
      const groups = await splitPdfBuffer(f.buffer, f.originalname);
      allGroups.push(...groups);
    }

    const needsSplitting = allGroups.length > 1 || (allGroups.length === 1 && allGroups[0].pages !== 'all' && allGroups[0].pages !== `1-${allGroups[0].totalPages}`);

    if (!needsSplitting && allGroups.length === 1) {
      // Small PDF - original flow (no splitting)
      const pdfContents = req.files.map(f => ({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: f.buffer.toString('base64') }
      }));

      send('phase', { phase: 1, message: 'Phase 1: 4体のAIが並列で図面を解析中...' });

      const [result1, result2, result3, result4] = await Promise.all([
        callAgent(1, '建築図面解析AI', getAgent1Prompt(), [
          ...pdfContents,
          { type: 'text', text: `この建設プロジェクトのPDF図面から建築工事の情報を抽出してください。\n${contextNote}` }
        ]),
        callAgent(2, '電気設備解析AI', getAgent2Prompt(), [
          ...pdfContents,
          { type: 'text', text: `この建設プロジェクトのPDF図面から電気設備工事の情報を抽出してください。\n${contextNote}` }
        ]),
        callAgent(3, '機械設備解析AI', getAgent3Prompt(), [
          ...pdfContents,
          { type: 'text', text: `この建設プロジェクトのPDF図面から機械設備工事の情報を抽出してください。\n${contextNote}` }
        ]),
        callAgent(4, '仕様・条件解析AI', getAgent4Prompt(), [
          ...pdfContents,
          { type: 'text', text: `この建設プロジェクトのPDF図面から仕様・条件情報を抽出してください。\n${contextNote}` }
        ])
      ]);

      send('phase1_results', { architecture: result1, electrical: result2, mechanical: result3, conditions: result4 });

      send('phase', { phase: 2, message: 'Phase 2: 数量積算AIが全データを統合中...' });
      const result5 = await callAgent(5, '数量積算AI',
        '以下のプロンプトに従い、正確な数量積算と概算見積もりを作成してください。',
        [{ type: 'text', text: getAgent5Prompt(result1, result2, result3, result4) }],
        'claude-sonnet-4-20250514'
      );
      send('phase2_results', { quantitySurvey: result5 });

      send('phase', { phase: 3, message: 'Phase 3: 見積書生成AIが最終見積書を作成中...' });
      const result6 = await callAgent(6, '見積書生成AI',
        '以下のプロンプトに従い、プロフェッショナルな御見積書を完成させてください。',
        [{ type: 'text', text: getAgent6Prompt(result5, result4) }],
        'claude-sonnet-4-20250514'
      );

      send('complete', { phases: { architecture: result1, electrical: result2, mechanical: result3, conditions: result4, quantitySurvey: result5, estimate: result6 } });

    } else {
      // Large PDF - group-based processing
      send('phase', { phase: 1, message: `Phase 1: ${allGroups.length}グループ × 4体AIで並列解析中...` });

      const allArchResults = [];
      const allElecResults = [];
      const allMechResults = [];
      const allCondResults = [];

      // Process groups in batches of 2 to manage rate limits
      for (let gi = 0; gi < allGroups.length; gi += 2) {
        const batch = allGroups.slice(gi, Math.min(gi + 2, allGroups.length));

        for (const group of batch) {
          send('phase', { phase: 1, message: `Phase 1: グループ ${group.pages} を解析中... (${allGroups.indexOf(group) + 1}/${allGroups.length})` });

          const groupPdfContents = [{
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: group.buffer.toString('base64') }
          }];

          const groupCtx = `${contextNote}\nページ範囲: ${group.pages} / 全${group.totalPages}ページ`;

          // Run 4 agents on this group (2 at a time to avoid rate limits)
          const [r1, r2] = await Promise.all([
            callAgent(1, '建築図面解析AI', getAgent1Prompt(), [
              ...groupPdfContents,
              { type: 'text', text: `この建設プロジェクトのPDF図面(${group.pages})から建築工事の情報を抽出してください。\n${groupCtx}` }
            ]),
            callAgent(2, '電気設備解析AI', getAgent2Prompt(), [
              ...groupPdfContents,
              { type: 'text', text: `この建設プロジェクトのPDF図面(${group.pages})から電気設備工事の情報を抽出してください。\n${groupCtx}` }
            ])
          ]);

          await new Promise(r => setTimeout(r, 5000)); // Rate limit pause

          const [r3, r4] = await Promise.all([
            callAgent(3, '機械設備解析AI', getAgent3Prompt(), [
              ...groupPdfContents,
              { type: 'text', text: `この建設プロジェクトのPDF図面(${group.pages})から機械設備工事の情報を抽出してください。\n${groupCtx}` }
            ]),
            callAgent(4, '仕様・条件解析AI', getAgent4Prompt(), [
              ...groupPdfContents,
              { type: 'text', text: `この建設プロジェクトのPDF図面(${group.pages})から仕様・条件情報を抽出してください。\n${groupCtx}` }
            ])
          ]);

          allArchResults.push(r1);
          allElecResults.push(r2);
          allMechResults.push(r3);
          allCondResults.push(r4);
        }

        // Rate limit pause between batches
        if (gi + 2 < allGroups.length) {
          send('phase', { phase: 1.5, message: 'レートリミット回避: 15秒待機中...' });
          await new Promise(r => setTimeout(r, 15000));
        }
      }

      // Merge group results
      const mergeResults = (results) => {
        if (results.length === 1) return results[0];
        return { mergedFromGroups: results.length, groups: results };
      };

      const result1 = mergeResults(allArchResults);
      const result2 = mergeResults(allElecResults);
      const result3 = mergeResults(allMechResults);
      const result4 = mergeResults(allCondResults);

      send('phase1_results', { architecture: result1, electrical: result2, mechanical: result3, conditions: result4 });

      // Phase 2: Agent 5 with merge awareness
      send('phase', { phase: 2, message: 'Phase 2: 数量積算AIが全グループのデータを統合中...' });
      const mergeNote = `\n\n重要: 以下の結果は${allGroups.length}グループに分割して解析された結果です。各グループの結果を統合し、重複を排除して全体の見積もりを作成してください。`;

      const result5 = await callAgent(5, '数量積算AI',
        '以下のプロンプトに従い、正確な数量積算と概算見積もりを作成してください。' + mergeNote,
        [{ type: 'text', text: getAgent5Prompt(result1, result2, result3, result4) }],
        'claude-sonnet-4-20250514'
      );
      send('phase2_results', { quantitySurvey: result5 });

      // Phase 3: Agent 6
      send('phase', { phase: 3, message: 'Phase 3: 見積書生成AIが最終見積書を作成中...' });
      const result6 = await callAgent(6, '見積書生成AI',
        '以下のプロンプトに従い、プロフェッショナルな御見積書を完成させてください。',
        [{ type: 'text', text: getAgent6Prompt(result5, result4) }],
        'claude-sonnet-4-20250514'
      );

      send('complete', { phases: { architecture: result1, electrical: result2, mechanical: result3, conditions: result4, quantitySurvey: result5, estimate: result6 } });
    }
  } catch (error) {
    console.error('Error:', error);
    send('error', { message: error.message || 'エラーが発生しました' });
  } finally {
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`\n${'='.repeat(52)}`);
  console.log(`  見積もり生成AI Pro — 6体AIエージェント搭載`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  参照DB: ${REFERENCE_DATA.project.name}`);
  console.log(`${'='.repeat(52)}\n`);
});
