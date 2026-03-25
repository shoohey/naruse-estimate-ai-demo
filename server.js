const express = require('express');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk').default;
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3456;

// Multer設定: アップロードファイルをメモリに保持
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('PDFファイルのみアップロード可能です'));
    }
  }
});

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// APIキー設定エンドポイント
let anthropicClient = null;

app.post('/api/set-key', (req, res) => {
  const { apiKey } = req.body;
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return res.status(400).json({ error: 'Invalid API key format' });
  }
  try {
    anthropicClient = new Anthropic({ apiKey });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PDF解析 + 見積書生成エンドポイント
app.post('/api/analyze', upload.single('pdf'), async (req, res) => {
  if (!anthropicClient) {
    return res.status(400).json({ error: 'APIキーが設定されていません' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'PDFファイルが必要です' });
  }

  const pdfBase64 = req.file.buffer.toString('base64');
  const projectName = req.body.projectName || '照明LED化工事';
  const clientName = req.body.clientName || '';

  // SSEでストリーミング
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    sendEvent('status', { message: 'PDFを読み込んでいます...' });

    // ステップ1: PDFから情報抽出
    sendEvent('status', { message: 'AI が図面を解析しています...（ステップ 1/2: 情報抽出）' });

    const extractionResponse = await anthropicClient.messages.create({
      model: 'claude-opus-4-0-20250514',
      max_tokens: 16000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: `あなたは建設・電気設備工事の見積もり専門AIです。
このPDF図面から以下の情報を正確に抽出してJSON形式で返してください。

【抽出する情報】
1. プロジェクト名（ビル名・工事名）
2. 建物所在地（わかれば）
3. 各フロアの照明器具の種類と数量（ベースライト、ダウンライト、非常灯、誘導灯など）
4. 器具の型番・仕様（わかれば）
5. 施工エリアの範囲（対象フロア数、対象外エリアなど）
6. 特記事項（足場工事の要否、夜間作業、テナントエリアなど）

以下のJSON形式で出力してください:
{
  "projectName": "プロジェクト名",
  "buildingName": "ビル名",
  "location": "所在地",
  "totalFloors": フロア数,
  "floors": [
    {
      "floor": "フロア名（例: B2F, 1F, RF等）",
      "fixtures": [
        {
          "type": "器具種別（ベースライト/ダウンライト/非常灯/誘導灯等）",
          "modelCode": "型番コード（わかれば）",
          "quantity": 数量,
          "specification": "仕様詳細"
        }
      ]
    }
  ],
  "fixtureModels": [
    {
      "code": "型番コード（A321, K321等）",
      "manufacturer": "メーカー名",
      "modelNumber": "製品型番",
      "description": "説明",
      "wattage": "消費電力",
      "estimatedUnitPrice": 想定単価（円）
    }
  ],
  "specialNotes": ["特記事項1", "特記事項2"],
  "constructionScope": {
    "targetFloors": ["対象フロア一覧"],
    "excludedAreas": ["対象外エリア"],
    "scaffoldingRequired": true/false,
    "nightWorkRequired": true/false
  }
}

PDFの全ページを精査し、できるだけ正確に情報を抽出してください。数量は図面の凡例に記載されている数字を正確に読み取ってください。`
            }
          ]
        }
      ]
    });

    let extractedData;
    const extractionText = extractionResponse.content[0].text;
    sendEvent('extraction', { text: extractionText });

    // JSONを抽出
    const jsonMatch = extractionText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        extractedData = JSON.parse(jsonMatch[0]);
      } catch (e) {
        extractedData = { raw: extractionText };
      }
    } else {
      extractedData = { raw: extractionText };
    }

    sendEvent('status', { message: 'AI が見積書を作成しています...（ステップ 2/2: 見積書生成）' });

    // ステップ2: 見積書生成
    const estimateResponse = await anthropicClient.messages.create({
      model: 'claude-opus-4-0-20250514',
      max_tokens: 16000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: pdfBase64,
              },
            },
            {
              type: 'text',
              text: `あなたは建設・電気設備工事の見積もり専門AIです。

以下のPDF図面の情報に基づいて、詳細な見積書をJSON形式で作成してください。

顧客名: ${clientName || '（図面から推定してください）'}
工事名: ${projectName}

【見積書の構成（この構造に必ず従ってください）】

{
  "estimate": {
    "title": "御見積書",
    "date": "2026年3月25日",
    "estimateNo": "E2026-XXXX",
    "clientName": "宛先（SOMPOコーポレートサービス株式会社 等）",
    "projectName": "工事名称",
    "location": "工事場所",
    "constructionPeriod": {
      "start": "着工予定",
      "end": "竣工予定",
      "duration": "工期"
    },
    "summary": {
      "subtotal": 小計（税抜）,
      "discount": 値引額,
      "constructionPrice": 工事価格,
      "legalWelfare": 法定福利費,
      "totalBeforeTax": 税抜合計,
      "tax": 消費税,
      "totalWithTax": 税込合計
    },
    "categories": [
      {
        "id": "1",
        "name": "仮設工事",
        "amount": 金額,
        "items": [
          {
            "id": "1-1",
            "name": "共通仮設工事",
            "quantity": 数量,
            "unit": "単位",
            "unitPrice": 単価,
            "amount": 金額,
            "details": [
              {
                "name": "明細項目名",
                "specification": "仕様",
                "quantity": 数量,
                "unit": "単位",
                "unitPrice": 単価,
                "amount": 金額,
                "note": "備考"
              }
            ]
          }
        ]
      },
      {
        "id": "2",
        "name": "建築工事",
        "amount": 金額,
        "items": [
          {
            "id": "2-1",
            "name": "1階照明器具更新工事",
            "quantity": 1.0,
            "unit": "式",
            "unitPrice": 単価,
            "amount": 金額,
            "details": [...]
          }
        ]
      },
      {
        "id": "3",
        "name": "電気設備工事",
        "amount": 金額,
        "items": [
          {
            "id": "3-1",
            "name": "B2階照明器具更新工事",
            "quantity": 1.0,
            "unit": "式",
            "unitPrice": 単価,
            "amount": 金額,
            "details": [
              {
                "name": "LED照明器具（ベースライト）",
                "specification": "TOSHIBA LEKT415323N-LS9等",
                "quantity": 数量,
                "unit": "台",
                "unitPrice": 単価,
                "amount": 金額,
                "note": ""
              }
            ]
          }
        ]
      },
      {
        "id": "4",
        "name": "建設副産物処分費",
        "amount": 金額,
        "items": [...]
      },
      {
        "id": "5",
        "name": "現場管理費",
        "amount": 金額,
        "items": []
      },
      {
        "id": "6",
        "name": "諸経費",
        "amount": 金額,
        "items": []
      }
    ]
  }
}

【重要な指示】
- PDFから読み取れる器具の種類・数量・型番を正確に反映すること
- 電気設備工事はフロア別に分けること（B2F, B1F, 1F, 2F, 3F〜10F, 11F, PH階, 内階段, 吹抜階段, 外構）
- 各フロアの明細には器具種別ごと（ベースライト、ダウンライト、非常灯、誘導灯）の数量と単価を記載
- 単価は一般的な市場価格を参考に設定（ベースライト: 15,000〜45,000円、ダウンライト: 8,000〜25,000円、非常灯: 20,000〜35,000円、誘導灯: 15,000〜50,000円）
- 施工費（器具取付費）は器具1台あたり3,000〜8,000円
- 既設器具撤去費は1台あたり2,000〜4,000円
- 仮設工事には足場・養生費を含める
- 建築工事にはフロア別の養生費・天井補修費を含める
- 現場管理費は直接工事費の7〜8%
- 諸経費は直接工事費の9〜10%
- 法定福利費は工事価格の3〜4%
- 出精値引は5%程度
- すべての金額は整数（円単位）で出力

JSONのみを出力してください。説明文は不要です。`
            }
          ]
        }
      ]
    });

    const estimateText = estimateResponse.content[0].text;
    const estimateJsonMatch = estimateText.match(/\{[\s\S]*\}/);
    let estimateData;

    if (estimateJsonMatch) {
      try {
        estimateData = JSON.parse(estimateJsonMatch[0]);
      } catch (e) {
        // JSONパースに失敗した場合、再度クリーンアップを試行
        const cleaned = estimateJsonMatch[0]
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');
        try {
          estimateData = JSON.parse(cleaned);
        } catch (e2) {
          sendEvent('error', { message: 'JSON解析エラー。生データを返します。' });
          estimateData = { raw: estimateText };
        }
      }
    } else {
      estimateData = { raw: estimateText };
    }

    sendEvent('status', { message: '見積書の生成が完了しました' });
    sendEvent('complete', {
      extraction: extractedData,
      estimate: estimateData
    });

  } catch (error) {
    console.error('Error:', error);
    sendEvent('error', {
      message: error.message || 'エラーが発生しました',
      details: error.toString()
    });
  } finally {
    res.end();
  }
});

// 公開ディレクトリ作成
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

app.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`  見積もり生成AI デモサーバー起動`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`========================================\n`);
});
