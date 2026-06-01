/**
 * 参照データベース — 西友スーパーマーケット工事 RAG用ナレッジ
 *
 * v2: 複数プロジェクト対応（座間林間 + 西一之江）
 *  - PROJECTS.zamaRinkan: 西友座間林間店 新店工事（S造2階建・延床2,602.8m2・税抜2.54億円）
 *  - PROJECTS.nishiIchinoe: 西友西一之江店 新店工事（既存建屋改修ベースの内装・設備工事・税抜0.95億円）
 *
 * 後方互換: REFERENCE_DATA トップレベルは引き続き座間林間（プライマリ参照）。
 * 新コードは REFERENCE_DATA.PROJECTS から両プロジェクトのデータにアクセスできる。
 *
 * このデータは実際の見積書と設計図面・竣工資料から AI エージェント並列抽出で構造化した学習データ。
 * 新しい建設図面が入力された際、このデータを参照して概算見積もりの精度を飛躍的に高めます。
 */

const REFERENCE_DATA = {

  // ============================
  // プロジェクト概要
  // ============================
  project: {
    name: '西友座間林間店 新店工事',
    type: 'スーパーマーケット新店工事（S造2階建）',
    client: '株式会社 西友',
    contractor: 'セック株式会社',
    location: '神奈川県座間市小松原2丁目5266-1',
    structure: 'S造（鉄骨造）',
    floors: 2,
    buildingHeight: 8626, // mm
    siteArea: 4141.95, // m2
    buildingArea: 1344.02, // m2
    floorArea1F: 1301.40, // m2
    floorArea2F: 1301.40, // m2
    totalFloorArea: 2602.80, // m2
    parkingArea: 1213.56, // m2
    legalFloorArea: 2066.34, // m2
    parkingSpaces: 90,
    elevators: 2, // 9人乗り + 15人乗り（本体別途）
    designDate: '2025-12-23',
    estimateDate: '2026-01-19',
    designer: '森村設計',
    totalCostExclTax: 254000000,
    taxRate: 0.10,
    totalCostInclTax: 279400000,
    costPerM2: 97587 // 円/m2（税抜）
  },

  // ============================
  // 工事カテゴリ別 金額・比率
  // ============================
  categories: {
    '共通仮設工事':   { amount:   8742810, ratio: 0.0344 },
    '建築工事':       { amount: 100697233, ratio: 0.3965 },
    '電気設備工事':   { amount:  28909242, ratio: 0.1138 },
    '機械設備工事':   { amount: 103353688, ratio: 0.4069 },
    '現場管理費':     { amount:   4250000, ratio: 0.0167 },
    '諸経費':         { amount:  40533410, ratio: 0.1596 },
    '調整値引き':     { amount: -32486383, ratio: -0.1279 }
  },

  // 工事費の構成比率（値引前の直接工事費ベース）
  costStructure: {
    directConstruction: 241702973, // 共通仮設+建築+電気+機械
    managementFee: { amount: 4250000, rateOfDirect: 0.0176 },
    designFee: 1000000,
    overhead: { amount: 29650058, rateOfDirect: 0.1227 },
    legalWelfare: { amount: 9883352, rateOfDirect: 0.0409 },
    discount: { amount: -32486383, rateOfTotal: -0.1279 }
  },

  // ============================
  // 建築工事 中項目別
  // ============================
  architectureBreakdown: {
    '直接仮設工事':     11311510,
    '解体工事':          4931000,
    'コンクリート工事': 10927200,
    '組積工事':           637670,
    '防水工事':          2482500,
    '金属工事・鉄骨工事': 13482550,
    '左官工事':          2328400,
    '塗装工事':          6270000,
    '建具工事':         11657500,
    'ガラス工事':         933920,
    '内装工事':         27907025,
    'その他工事':        7827958
  },

  // ============================
  // 電気設備工事 中項目別
  // ============================
  electricalBreakdown: {
    '幹線・動力設備工事':     13879676,
    '電灯設備工事':            9603740,
    '電話配管・テレビ共聴設備': 2046472,
    '放送設備工事':            1088790,
    '空調換気設備工事':        1038609,
    'EMS導入工事':              720360,
    '工事用仮設電源工事':       531595
  },

  // ============================
  // 機械設備工事 中項目別
  // ============================
  mechanicalBreakdown: {
    '施設内給水設備工事':   4894525,
    '施設内排水設備工事':   8892195,
    '衛生器具設備工事':     8008948,
    '空調機器設備工事':    53029532,
    '換気設備工事':        20326266,
    '防災設備工事':         8202222
  },

  // ============================
  // 単価データベース（建築工事）
  // ============================
  unitPrices: {
    // --- 仮設工事 ---
    temporary: {
      '仮設トイレ（水洗）': { unit: '台', price: 55000 },
      '仮設ハウス（4坪AC付）': { unit: '台', price: 300000 },
      '片付け清掃費': { unit: '日', price: 5500 },
      '発生材処分運搬（4tコンテナ）': { unit: '台', price: 150000 },
      '引渡し清掃（ガラスサッシ内外）': { unit: '式', price: 300000 },
      '引渡し清掃（空調機・床）': { unit: 'm2', price: 350 },
      '現場養生費': { unit: '日', price: 3300 },
      'ゴミ搬出費': { unit: '人工', price: 28000 },
      '搬入費': { unit: '人工', price: 28000 },
      '墨出し': { unit: '日', price: 70000 },
      '仮設足場架け払い（本足場）': { unit: 'm2', price: 1550 },
      '飛散防止シート（黒メッシュ）': { unit: 'm2', price: 280 },
      '巾木': { unit: 'm2', price: 550 },
      '昇降階段': { unit: '基', price: 11000 },
      '侵入防止金網フェンス': { unit: 'm', price: 3750 },
      '場内小運搬費': { unit: 'm2', price: 210 },
      '資材運搬費': { unit: 'm2', price: 280 },
      'レントゲン・コア抜き': { unit: '式', price: 2500000, note: 'H300程度まで' }
    },

    // --- 解体工事 ---
    demolition: {
      '天井ケイカル撤去（下地残し）': { unit: 'm2', price: 2200 },
      '天井内配管撤去': { unit: '式', price: 850000 },
      '貯水タンク解体（FRP）': { unit: '基', price: 330000 },
      'べた基礎解体': { unit: '式', price: 380000 },
      'コンプレッサー斫り': { unit: '式', price: 180000 }
    },

    // --- コンクリート工事 ---
    concrete: {
      '床生コン打設（t165 スタイロ53 ワイヤーメッシュ込）': { unit: 'm2', price: 12760 },
      '床生コン打設（t465 スタイロ323）': { unit: 'm2', price: 32560 },
      'ポンプ車損料': { unit: '台', price: 125000 }
    },

    // --- 組積工事 ---
    masonry: {
      '70ブロック2段積（FLから）': { unit: 'm', price: 5830 },
      '70ブロック（SL+690まで）': { unit: 'm', price: 10175 }
    },

    // --- 防水工事 ---
    waterproofing: {
      '土間下入隅塗膜防水': { unit: 'm', price: 10800 },
      'ケイ酸質系塗布防水（EVピット等）': { unit: 'm2', price: 13200 },
      'スタイロフォーム（t100）': { unit: 'm2', price: 10500 }
    },

    // --- 金属・鉄骨工事 ---
    metal: {
      '新規天井LGS（吊りボルト800-1000）': { unit: 'm2', price: 3200 },
      '新規天井LGS（1F 既存吊りボルト使用）': { unit: 'm2', price: 3600 },
      '間仕切りフカシ壁（ST4565）': { unit: 'm2', price: 3200 },
      '間仕切りドア開口補強': { unit: 'ヶ所', price: 12500 },
      '柱型LGS': { unit: 'm2', price: 3850 },
      '天井点検口（450角）': { unit: 'ヶ所', price: 14500 },
      '天井点検口（600角）': { unit: 'ヶ所', price: 15000 },
      'EV周り壁（ST100）': { unit: 'm2', price: 3850 }
    },

    // --- 左官工事 ---
    plastering: {
      '際防水下地': { unit: 'm2', price: 2800 },
      'グリーストラップ内側補修': { unit: 'ヶ所', price: 25000 },
      'グレーチング内側補修': { unit: 'ヶ所', price: 35000 },
      'スロープ新設（型枠込み）': { unit: 'm2', price: 43000 },
      '倉庫床立上げ入隅30R': { unit: 'm', price: 8800 },
      '床補修': { unit: 'm2', price: 9500 }
    },

    // --- 塗装工事 ---
    painting: {
      '天井塗装': { unit: 'm2', price: 2950 },
      'ALC壁吹付塗装（玉吹き）': { unit: 'm2', price: 4730 },
      '売場壁塗装': { unit: 'm2', price: 3200 },
      '柱塗装': { unit: 'm2', price: 3200 },
      '防塵塗装（アッシュフォード）': { unit: 'm2', price: 2200 }
    },

    // --- 建具工事 ---
    fixtures: {
      '軽量スチール片開き戸': { unit: '箇所', priceRange: [256800, 376600] },
      'スイングドア': { unit: '箇所', price: 300000 },
      'スライドドア': { unit: '箇所', priceRange: [220000, 250000] },
      '自動スライドドア': { unit: '箇所', price: 550000 },
      'スチール2段式フラッシュ戸': { unit: '箇所', price: 600000 },
      'スチール親子開きフラッシュ戸': { unit: '箇所', price: 500000 },
      '3連排煙窓付FIX（W3540xH2300）': { unit: '箇所', price: 990000 },
      '2連排煙窓付FIX（W2300xH2340）': { unit: '箇所', price: 700000 },
      '排煙窓付FIX（W1470xH2340）': { unit: '箇所', price: 400000 },
      '防煙垂れ壁（W25000xH800）': { unit: '式', price: 789600 },
      '防煙垂れ壁（W14000xH800）': { unit: '式', price: 486000 },
      'トイレブース（1ブース）': { unit: '式', price: 250000 },
      'トイレブース（2ブース）': { unit: '式', price: 350000 }
    },

    // --- 内装工事 ---
    interior: {
      '天井不燃ジプトーン3x3': { unit: 'm2', price: 2480 },
      '天井不燃ジプトーン1.5x3': { unit: 'm2', price: 2640 },
      '天井ケイカルV目地': { unit: 'm2', price: 3450 },
      '天井ケイカルt8（V目地3x3）': { unit: 'm2', price: 3500 },
      '壁PBt12.5': { unit: 'm2', price: 2200 },
      '壁耐水PBt12.5': { unit: 'm2', price: 2750 },
      '壁ケイカルt8': { unit: 'm2', price: 3850 },
      '柱型強化PB': { unit: 'm2', price: 2860 },
      '売場床材（マティルMBE-230）施工費': { unit: 'm2', price: 1980 },
      '厨房床材（アルトロセーフティ）': { unit: 'm', price: 19800 },
      'トイレ床材（グラニット）': { unit: 'm', price: 9690 },
      'クロス施工': { unit: 'm2', price: 1450 },
      'メラミン化粧板施工': { unit: 'm', price: 4800 }
    },

    // --- その他建築工事 ---
    otherArch: {
      'バリカー（φ60.5 H800xW1500）': { unit: '本', price: 80000 }
    }
  },

  // ============================
  // 単価データベース（電気設備工事）
  // ============================
  electricalPrices: {
    // --- 幹線・ケーブル ---
    cables: {
      'CVT200sq': { unit: 'm', price: 14080 },
      'CVT150sq': { unit: 'm', price: 10428 },
      'CVT100sq': { unit: 'm', price: 7051 },
      'CVT60sq': { unit: 'm', price: 4257 },
      'CVT38sq': { unit: 'm', price: 3100 },
      'CV14-3C': { unit: 'm', price: 880 },
      'CV8-5C': { unit: 'm', price: 750 },
      'CV5.5-3C': { unit: 'm', price: 520 }
    },

    // --- 分電盤 ---
    panels: {
      '分電盤（小型）': { unit: '面', priceRange: [104400, 220000] },
      '分電盤（中型）': { unit: '面', priceRange: [220000, 400000] },
      '分電盤（大型）': { unit: '面', priceRange: [400000, 535200] },
      '分電盤設置・幹線接続': { unit: '面', price: 55000 }
    },

    // --- ケーブルラック ---
    cableRack: {
      'SD-QR50': { unit: '本', price: 19635 },
      'SD-QR60': { unit: '本', price: 22000 },
      'SD-QR90': { unit: '本', price: 25300 }
    },

    // --- 照明器具 ---
    lighting: {
      'LED非常灯（NNFB93605C）': { unit: '台', price: 18590 },
      'LED非常灯防湿防雨型（NNFB91715C）': { unit: '台', price: 17050 },
      '人感センサー親器': { unit: '台', price: 11550 },
      'ライティングレール': { unit: 'm', price: 2145 },
      'LEDベースライト（23.4W）': { unit: '台', price: 12000 },
      'LEDベースライト（56.5W大型）': { unit: '台', price: 28000 },
      'LEDスポットライト（26.2W）': { unit: '台', price: 18000 },
      'LEDダウンライト': { unit: '台', priceRange: [6000, 15000] }
    },

    // --- 配線工事 ---
    wiring: {
      '店内照明墨出し配線工事': { unit: '式', price: 566500 },
      'バックヤード等配線工事': { unit: '式', price: 506000 },
      '幹線配線工事': { unit: '式', price: 594000 }
    },

    // --- 放送設備 ---
    broadcast: {
      'PAアンプ（TA-2030）': { unit: '台', price: 60500 },
      'CD/USBプレイヤー（CD-400U）': { unit: '台', price: 82500 },
      '天井埋込スピーカー12CM 3W': { unit: '台', price: 4345 },
      'アンプ・マイクロホン設置接続': { unit: '式', price: 165000 }
    },

    // --- 防災設備 ---
    fireAlarm: {
      'P型1級複合盤受信機（30回線）': { unit: '台', price: 1581800 },
      '作動式スポット感知器': { unit: '個', price: 3100 },
      '避難口誘導灯（B-BH片面）': { unit: '台', price: 53790 },
      '室内通路誘導灯（B-BH両面）': { unit: '台', price: 64085 },
      '粉末蓄圧式消火器（PEP10N）': { unit: '本', price: 8800 }
    }
  },

  // ============================
  // 単価データベース（機械設備工事）
  // ============================
  mechanicalPrices: {
    // --- 給水設備 ---
    waterSupply: {
      'HIVP50': { unit: 'm', price: 1490 },
      'HIVP20': { unit: 'm', price: 410 },
      '保温工事（GW20mm厚）': { unit: '式', price: 600000 },
      '給水管施工費': { unit: 'm', price: 4000 },
      'VB-50A（塩ビライニング鋼管）': { unit: 'm', price: 5665 },
      'VB-20A（塩ビライニング鋼管）': { unit: 'm', price: 1945 }
    },

    // --- 排水設備 ---
    drainage: {
      '耐火二層管100A': { unit: 'm', price: 4650 },
      '耐火二層管75A': { unit: 'm', price: 3190 },
      '耐火二層管50A': { unit: 'm', price: 1950 },
      '排水管施工費': { unit: 'm', price: 8000 }
    },

    // --- 衛生器具 ---
    sanitary: {
      'ユニバーサルシート': { unit: '台', price: 354200 },
      '自動単水栓（AM-320CV1）': { unit: '台', price: 46200 },
      'グリストラップ（大型 SE-55SA）': { unit: '台', priceRange: [308450, 342050] },
      'グリストラップ（小型 SK-40C）': { unit: '台', price: 249315 },
      'パルスメーター50A': { unit: '台', price: 515680 },
      '衛生器具取付費': { unit: '式', price: 1200000 },
      '厨房機器繋ぎ込み費': { unit: '式', price: 500000 }
    },

    // --- 空調設備 ---
    hvac: {
      'ビル用マルチ室外機（400型 RXYA400A）': { unit: '台', price: 816240 },
      'ビル用マルチ室外機（280型 RXYA280A）': { unit: '台', price: 547560 },
      '天カセラウンドフロー（140型 FXYFA140NAA）': { unit: '台', price: 149520 },
      '外気処理エアコン天埋ダクト（FXYMA280ZAN）': { unit: '台', price: 1062360 },
      'カラットデシカント（DES/DX10）': { unit: '台', price: 1980000 },
      'デシカント遠方操作盤（EMS対応）': { unit: '式', price: 1450000 },
      '内機設置費': { unit: '式', price: 1200000 },
      '外機設置費': { unit: '式', price: 850000 },
      '冷媒管配管施工費': { unit: '式', price: 1800000 },
      '耐火処理（材工共）': { unit: '式', price: 700000 },
      '防振ハンガー': { unit: 'セット', price: 26500 }
    },

    // --- 換気設備 ---
    ventilation: {
      '消音形キャビネットファン（FY-28CCY3）': { unit: '台', price: 1177800 },
      '耐湿形キャビネットファン大風量（FY-25DCM3）': { unit: '台', price: 288600 },
      'インテリジェントタッチマネージャー': { unit: '台', price: 468000 },
      '排気ダクト（亜鉛鉄板t0.6 材工共）': { unit: 'm2', price: 10600 },
      '排気ダクト（亜鉛鉄板t0.8 材工共）': { unit: 'm2', price: 12480 },
      'SUS鋼板ダクト（t0.8 火気仕様）': { unit: 'm2', price: 28650 },
      'GW25t保温（材工）': { unit: '式', price: 990000 },
      '脱臭装置（KCU3KW83）': { unit: '台', price: 1104000 },
      'スパイラルダクト250A': { unit: 'm', price: 5370 },
      'スパイラルダクト200A': { unit: 'm', price: 4565 },
      'スパイラルダクト150A': { unit: 'm', price: 4060 }
    },

    // --- 防災設備 ---
    fireProtection: {
      'フード消火（小型）': { unit: '台', price: 49900 },
      'フード・ダクト用消火': { unit: '台', price: 85900 },
      '移動式粉末消火設備（33kg）': { unit: '台', price: 80000 }
    }
  },

  // ============================
  // 労務単価
  // ============================
  laborRates: {
    '現場管理者': { unit: '日・人', price: 25000 },
    '警備費（出入管理）': { unit: '日', price: 18000 },
    '誘導用警備費': { unit: '人工', price: 25000 },
    '保全管理費': { unit: '日', price: 28000 },
    '一般作業員': { unit: '人工', price: 28000 }
  },

  // ============================
  // m2あたりの概算単価（工種別・建物用途別）
  // ============================
  costPerM2ByCategory: {
    'スーパーマーケット新店': {
      totalFloorArea: 2602.80,
      '共通仮設': 3359,    // 8,742,810 / 2,602.80
      '建築工事': 38686,   // 100,697,233 / 2,602.80
      '電気設備': 11107,   // 28,909,242 / 2,602.80
      '機械設備': 39709,   // 103,353,688 / 2,602.80
      '合計（税抜）': 97587 // 254,000,000 / 2,602.80
    }
  },

  // ============================
  // 工事費率テンプレート
  // ============================
  feeRatios: {
    'スーパーマーケット': {
      managementFee: 0.0176,    // 現場管理費 / 直接工事費
      designFee: 0.0041,        // 設計費 / 直接工事費
      overhead: 0.1227,         // 諸経費 / 直接工事費
      legalWelfare: 0.0409,     // 法定福利費 / 直接工事費
      discount: 0.1279          // 調整値引率
    },
    'オフィスビル': {
      managementFee: 0.02,
      designFee: 0.005,
      overhead: 0.12,
      legalWelfare: 0.04,
      discount: 0.10
    },
    '店舗（一般）': {
      managementFee: 0.018,
      designFee: 0.004,
      overhead: 0.11,
      legalWelfare: 0.04,
      discount: 0.12
    },
    '工場・倉庫': {
      managementFee: 0.015,
      designFee: 0.003,
      overhead: 0.10,
      legalWelfare: 0.04,
      discount: 0.08
    },
    '工場（小規模・新築/増築）': {
      // 夏島工場(税抜140M)の実績費率。base=直接工事費127,793,504(現場管理費を内包)
      managementFee: 0.0628,  // 現場管理費は直接工事費に内包される実績（別計上ではない）
      designFee: 0,
      overhead: 0.0912,       // 諸経費 / 直接工事費
      legalWelfare: 0.0130,   // 法定福利 / 直接工事費
      discount: 0.0079        // 端数調整のみ。座間のような大幅値引きはない
    },
    '住宅': {
      managementFee: 0.02,
      designFee: 0.005,
      overhead: 0.15,
      legalWelfare: 0.04,
      discount: 0.05
    }
  },

  // ============================
  // 建物用途別 m2単価の目安
  // ============================
  benchmarkCostPerM2: {
    'スーパーマーケット（新店・S造）': { min: 85000, typical: 97500, max: 130000 },
    'コンビニ（新店・S造）': { min: 100000, typical: 120000, max: 150000 },
    'オフィスビル（S造）': { min: 150000, typical: 200000, max: 300000 },
    'オフィスビル（RC造）': { min: 200000, typical: 280000, max: 400000 },
    '店舗（内装のみ）': { min: 50000, typical: 80000, max: 150000 },
    '工場（S造・大規模/倉庫的）': { min: 60000, typical: 80000, max: 120000 },
    '工場（製造施設・小規模S造 600〜1000m2級/新築・増築）': { min: 180000, typical: 216000, max: 270000 }, // 夏島工場実績。地盤改良杭・重量鉄骨・大型シャッターで小売の約2.2倍に上振れ
    '倉庫（S造）': { min: 40000, typical: 55000, max: 80000 },
    '住宅（木造）': { min: 180000, typical: 230000, max: 350000 },
    '住宅（RC造）': { min: 250000, typical: 320000, max: 450000 },
    '病院・福祉施設': { min: 250000, typical: 350000, max: 500000 },
    '学校': { min: 200000, typical: 260000, max: 350000 },
    'ホテル': { min: 250000, typical: 350000, max: 600000 }
  },

  // ============================
  // 特記事項・見積もり条件
  // ============================
  specialConditions: [
    '日中工事（オーナー様工事と同時受注・同時期施工を前提）',
    '見積有効期限: 提出後30日',
    '防水保証: 10年（メーカー保証書提出必須）',
    '鉄骨溶接部: 超音波探傷検査必須',
    '建具金物: MIWA又はGOAL指定',
    '自動ドア: ナブコ又は同等品',
    '防火シャッター: 危害防止装置付き（建築基準法対応）',
    '産業廃棄物: 適正処理費用を計上',
    '支払条件: 規定通り'
  ]
};

// ============================
// 西一之江プロジェクト（v2 追加 — 既存建屋改修ベース）
// ============================
const NISHI_ICHINOE = {
  project: {
    name: '西友西一之江店 新店工事',
    type: 'スーパーマーケット新店工事（既存建屋改修ベースの内装・設備工事）',
    client: '株式会社 西友',
    contractor: 'セック株式会社',
    location: '東京都江戸川区西一之江1丁目1291-1',
    structure: null, // 既存建屋改修のため見積書に明示なし
    floors: null,
    buildingHeight: null,
    siteArea: null,
    buildingArea: null,
    totalFloorArea: null,
    constructionPeriod: '2025年8月上旬〜11月上旬予定（約90日）',
    designDate: null,
    estimateDate: '2025-07-17',
    totalCostExclTax: 95000000,
    taxRate: 0.10,
    totalCostInclTax: 104500000,
    costPerM2: null, // 延床不明のため算出不能
    sourcePDFs: [
      '㈰_セック_西友西一之江店_新店工事_御見積書_20250724.pdf'
    ]
  },

  categories: {
    '共通仮設工事':   { amount:  4597210, ratio: 0.0484 },
    '建築工事':       { amount: 37805610, ratio: 0.3980 },
    '電気設備工事':   { amount: 15762660, ratio: 0.1659 },
    '機械設備工事':   { amount: 29343010, ratio: 0.3089 },
    '現場管理費':     { amount:  2250000, ratio: 0.0237 },
    '諸経費':         { amount:  8381575, ratio: 0.0882 },
    '調整値引き':     { amount: -3140065, ratio: -0.0331 }
  },

  costStructure: {
    directConstruction: 87508490, // 共通仮設+建築+電気+機械
    managementFee: { amount: 2250000, rateOfDirect: 0.0257 },
    designFee: 500000,
    overhead: { amount: 4058268, rateOfDirect: 0.0464 },
    legalWelfare: { amount: 3823307, rateOfDirect: 0.0437 },
    discount: { amount: -3140065, rateOfTotal: -0.0331 }
  },

  // 追加・変更見積（本工事後の差分）
  additionalWorks: [
    { title: '多目的トイレ工事',         amountExclTax: 1340000, date: '2025-09-20' },
    { title: '排水管内カメラ調査',       amountExclTax:  153000, date: '2025-09-29' },
    { title: '不陸調整工事',             amountExclTax: 2000000, date: '2025-09-22' },
    { title: '追加工事(5-1)',            amountExclTax: 4400000, date: '2025-11-05' },
    { title: '増減 修正2(5-2)',          amountExclTax: 2150000, date: '2025-11-19' },
    { title: '追加工事(9)',              amountExclTax: 1480000, date: '2025-11-05' },
    { title: '追加工事2(10)',            amountExclTax:  220000, date: '2025-12-02' },
    { title: '内装設備工事 最終差額(11)', amountExclTax: 2270000, date: '2026-01-20' }
  ],
  additionalWorksTotalExclTax: 13813000,
  grandTotalExclTax: 108813000,

  architectureBreakdown: {
    '直接仮設工事':      1871000,
    '解体工事':          2186150,
    'コンクリート工事':  3031100,
    '組積工事':           202800,
    '防水工事':           378000,
    '金属工事・鉄骨工事': 7092250,
    '左官工事':           446500,
    '塗装工事':           912810,
    '建具工事':          6593500,
    'ガラス工事':         530500,
    '内装工事':         11476920,
    'その他工事':        3084080
    // 鉄筋・石・タイル工事は本案件では0計上（既存建屋活用のため）
  },

  electricalBreakdown: {
    '幹線・動力設備工事':       5798100,
    '電灯設備工事':             3651730,
    '電話配管・テレビ共聴設備':  835900,
    '放送設備工事':              498380,
    '空調換気設備工事':          724300,
    'EMS導入工事':               984700,
    '防災設備工事':             3269550 // 西一之江では電気側に独立計上（座間と異なる）
  },

  mechanicalBreakdown: {
    '施設内給水設備工事':  1105900,
    '施設内排水設備工事':  1065400,
    '衛生器具設備工事':    1298900,
    '空調機器設備工事':   12344510,
    '換気設備工事':       13528300
    // 防災設備工事は本案件では電気側に計上のため機械側は無し
  },

  unitPrices: {
    temporary: {
      '現場養生費': { unit: '日', price: 3300, note: '90日' },
      '集塵機': { unit: '台', price: 88000, note: '30日×2台' },
      '集塵機運搬費': { unit: '回', price: 25000 },
      'ゴミ搬出費': { unit: '人工', price: 28000 },
      '搬入費': { unit: '人工', price: 28000 },
      '仮設トイレ（水洗）': { unit: '台', price: 55000 },
      '仮設4坪ハウス（AC付）': { unit: '台', price: 300000 },
      '片付け清掃費': { unit: '日', price: 5500 },
      '発生材処分運搬費（4tコンテナ）': { unit: '台', price: 150000 },
      '立馬（駱駝15号）': { unit: '台', price: 18900 },
      '天台（コンステージMKT-1750）': { unit: '台', price: 34650 },
      '仮設照明（パノラマスタンドLED）': { unit: '台', price: 59400 },
      '漏電遮断機付きコードリール': { unit: '台', price: 25200 },
      '引渡し清掃（ガラス・サッシ）': { unit: '式', price: 120000 },
      '引渡し清掃（床ワックス含む）': { unit: 'm2', price: 400 },
      '諸官庁検査立会費': { unit: '式', price: 90000 },
      '関係省庁申請手続き費': { unit: '式', price: 85000 }
    },
    demolition: {
      '東面開口解体（建具用）': { unit: 'ヶ所', price: 55000 },
      '南面開口解体（建具用）': { unit: 'ヶ所', price: 110000 },
      '西面開口解体（建具用）': { unit: 'ヶ所', price: 70000 },
      '西面開口部基礎斫り工事': { unit: 'ヶ所', price: 70000 },
      'カッター入れ': { unit: 'm', price: 550 },
      '売場道路カッター入れ（W200×h250×3回入れ）': { unit: 'm', price: 4200 },
      'バックヤードカッター入れ（3回入れ）': { unit: 'm', price: 4000 },
      '溝斫り（W200×h250）': { unit: 'm', price: 7000 },
      'バックヤード斫り工事': { unit: 'm2', price: 16500 },
      '斫り用コンプレッサー': { unit: '日', price: 50000 }
    },
    concrete: {
      '店内床生コン打設（厚100、スタイロ＋WM込）': { unit: 'm2', price: 11500 },
      '店内床生コン打設（厚80）': { unit: 'm2', price: 9200 },
      '店内床生コン打設（厚60）': { unit: 'm2', price: 7000 },
      '埋戻し工事（W200×H150）': { unit: 'm', price: 4500 },
      '埋戻し工事（W250×H250）': { unit: 'm', price: 11000 },
      'ポンプ車損料': { unit: '台', price: 88000 }
    },
    masonry: {
      '70ブロック2段積': { unit: 'm', price: 6200 },
      '70ブロック150積': { unit: 'm', price: 4200 }
    },
    waterproofing: {
      'ゴミ置き場防水工事': { unit: 'm2', price: 10800 },
      '冷蔵庫・冷凍庫防水工事': { unit: 'm2', price: 10800 }
    },
    metal: {
      '新規天井LGS（吊りボルト1500-1900）': { unit: 'm2', price: 3200 },
      'X,Yチャンネル水平補強': { unit: 'm2', price: 1450 },
      'X,Yチャンネル斜めブレス': { unit: 'ヶ所', price: 21000 },
      '間仕切り・フカシ壁（ST4565）': { unit: 'm2', price: 3200 },
      '間仕切りドア開口補強': { unit: 'ヶ所', price: 12100 },
      'スライドドア開口補強': { unit: 'ヶ所', price: 26500 },
      'ゴミ庫間仕切壁（ST100）': { unit: 'm2', price: 3850 },
      '柱型LGS': { unit: 'm2', price: 3850 },
      '埋込消火器間仕切壁': { unit: 'ヶ所', price: 42000 },
      '天井点検口設置': { unit: 'ヶ所', price: 14500 },
      '壁点検口設置（目地タイプ）': { unit: 'ヶ所', price: 19800 },
      '鍵付き点検口設置': { unit: 'ヶ所', price: 25000 },
      '外壁開口補強（アルミ6連排煙窓）': { unit: 'ヶ所', price: 275000 },
      '外壁開口補強（アルミ3連排煙窓）': { unit: 'ヶ所', price: 145000 },
      'ゴミ置き場SUS貼り': { unit: 'm2', price: 20000 },
      '亜鉛鉄板下地': { unit: 'm2', price: 14500 }
    },
    plastering: {
      '際防水下地': { unit: 'm2', price: 2600 },
      'グレーチング内側補修': { unit: 'ヶ所', price: 32000 },
      '新規扉部スロープ新設': { unit: 'ヶ所', price: 95000 },
      '後方通路スロープ新設': { unit: 'm2', price: 15500 },
      '薄塗モルタル3mm': { unit: 'm2', price: 2500 },
      '雑左官': { unit: '人工', price: 28000 }
    },
    painting: {
      '売場壁塗装': { unit: 'm2', price: 3200 },
      '売場柱塗装': { unit: 'm2', price: 3200 },
      '各所コーナー塗装': { unit: 'm', price: 770 },
      'ゴミ置き場壁塗装': { unit: 'm2', price: 3200 },
      'ゴミ置き場天井塗装': { unit: 'm2', price: 2800 },
      '風除室壁塗装': { unit: 'm2', price: 3200 },
      '従業員トイレ壁塗装': { unit: 'm2', price: 3200 }
    },
    fixtures: {
      '両開きスイングドア（SWD-1, ユニフロー W1600×H2005）': { unit: 'セット', price: 288000 },
      'SUS304HL三方枠': { unit: '本', price: 92000 },
      '片開きハンガードア半自動（LSD-1）': { unit: 'セット', price: 490000 },
      '両開き親子ドア（LSD-2, W1200×H2100）': { unit: 'セット', price: 380000 },
      '片開きドア（LSD-3, W600×H2000）': { unit: 'セット', price: 290000 },
      '片開きドア（LSD-4, W700×H2000）': { unit: 'セット', price: 300000 },
      '片開きドア（LSD-5, W800×H2000）': { unit: 'セット', price: 230000 },
      '片開きドア レバーハンドル電気錠（LSD-6）': { unit: 'セット', price: 380000 },
      '両開き親子ドア（SD-1, W1500×H2100）': { unit: 'セット', price: 550000 },
      '自動ドア 引き分け＋FIX窓（AAD-1, W5145×H2800）': { unit: 'セット', price: 1080000 },
      '排煙窓3連窓（AW-7, W3158×H761）': { unit: 'セット', price: 700000 },
      '排煙窓5連窓（AW-8, W6731×H761）': { unit: 'セット', price: 1400000 },
      '建具施工費': { unit: '人工', price: 28000 }
    },
    glass: {
      'FL6透明＋飛散防止フィルム（W1035×H2075）': { unit: 'セット', price: 40000 },
      'TP8透明強化（W800×H2080）': { unit: 'セット', price: 50000 },
      'コーキング費': { unit: 'm', price: 500 },
      'コーキング費（防火）': { unit: 'm', price: 1350 },
      'ガラス施工費': { unit: '人工', price: 28000 }
    },
    interior: {
      '天井不燃ジプトーン3x3': { unit: 'm2', price: 2400 },
      '天井不燃ジプトーン1.5x3': { unit: 'm2', price: 2600 },
      '壁強化PB（Z12.5）': { unit: 'm2', price: 2750 },
      '柱型強化PB（Z12.5）': { unit: 'm2', price: 3500 },
      '壁PBt12.5': { unit: 'm2', price: 2200 },
      '壁PBt12.5素地張り': { unit: 'm2', price: 2400 },
      '壁耐水PBt12.5': { unit: 'm2', price: 2750 },
      '壁ケイカルt8': { unit: 'm2', price: 3800 },
      '壁GW充填（t50×24kg）': { unit: 'm2', price: 1800 },
      'クロス施工費': { unit: 'm2', price: 1450 },
      'メラミン化粧板施工費': { unit: 'm', price: 4800 },
      '床Pタイル施工費': { unit: 'm2', price: 1980 },
      '巾木施工費（副資材含む）': { unit: 'm', price: 990 },
      '冷凍冷蔵庫塗床（タフクリートSY-SD工法）': { unit: 'm2', price: 16500 },
      '青果冷蔵庫塗床（ケミクリートE）': { unit: 'm2', price: 11000 },
      '生ゴミ処理室塗床': { unit: '式', price: 120000 },
      '倉庫・後方通路塗床（セラミキュア）': { unit: 'm2', price: 1550 }
    },
    otherArch: {
      '壁掛けテレビ金具設置': { unit: '箇所', price: 11000 },
      '姿見鏡（松竹工業 M5×600×1800）': { unit: '枚', price: 13500 },
      'カーテン（サンゲツ AC2416, W2000×H2200）': { unit: 'セット', price: 50000 },
      '荷捌口コーナーガード': { unit: '箇所', price: 15000 },
      'オーニング本体（BXテンパル W9000）': { unit: '台', price: 495000 },
      'オーニング キャンバス（防炎）': { unit: '枚', price: 293150 },
      'バリカー設置（FPA-17CB12）': { unit: '本', price: 80000 },
      'バリカー設置（FPA-12CB12）': { unit: '本', price: 55000 },
      '外構 舗装版破砕工': { unit: 'm2', price: 3850 },
      '外構 既存フェンス撤去（基礎残置）': { unit: 'm', price: 2750 },
      '外構 キュービクル基礎': { unit: '式', price: 650000 },
      '外構 舗装復旧工（路盤共）': { unit: 'm2', price: 35500 },
      '外構 メッシュフェンス設置（セキスイG10 H1800）': { unit: 'm', price: 12500 },
      '外構 区画線改修（既存消去含む）': { unit: '式', price: 280000 }
    }
  },

  electricalPrices: {
    cables: {
      'CVT100sq': { unit: 'm', price: 7000 },
      'CVT60sq':  { unit: 'm', price: 4500 },
      'CVT38sq':  { unit: 'm', price: 2950 },
      'CVT14sq':  { unit: 'm', price: 1200 },
      'CV5.5-4C': { unit: 'm', price: 610 },
      'CV3.5-4C': { unit: 'm', price: 460 },
      'IV14sq(G)': { unit: 'm', price: 400 },
      'IV5.5sq(G)': { unit: 'm', price: 280 },
      'IV1.6(G)': { unit: 'm', price: 55 },
      'VVF2.0-3C': { unit: 'm', price: 310 },
      'VVF2.0-2C': { unit: 'm', price: 200 },
      'VVF1.6-3C': { unit: 'm', price: 200 },
      'VVF1.6-2C': { unit: 'm', price: 105 },
      'PF22(保護用)': { unit: 'm', price: 105 },
      'PF28': { unit: 'm', price: 180 }
    },
    panels: {
      'L-T1-1 屋内自立(河村電器)': { unit: '式', price: 950000 },
      'L-T1-2 屋内壁掛(河村電器)': { unit: '式', price: 130000 },
      'L-T1-3 屋内壁掛(河村電器)': { unit: '式', price: 210000 },
      'P-T1-1 屋内壁掛(河村電器)': { unit: '式', price: 210000 },
      'P-T1-2 屋内壁掛(河村電器)': { unit: '式', price: 250000 },
      'ELV制御盤 屋内壁掛(河村電器)': { unit: '式', price: 99000 },
      '分電盤搬入作業': { unit: '式', price: 132000 },
      '分電盤設置工事': { unit: '面', price: 44000 }
    },
    cableRack: {
      'SD-QR40': { unit: '本', price: 20000 },
      'SD-QRLA40 L型ラック': { unit: '本', price: 15500 },
      'SD-CV40Y 直線屋根型カバー': { unit: '本', price: 14500 },
      '新設ラック加工施工工事': { unit: '式', price: 245000 },
      '新設ラックカバー施工工事': { unit: '式', price: 55000 },
      '幹線配線工事': { unit: '式', price: 265000 }
    },
    lighting: {
      '投光器(NNY24987同等品)': { unit: '台', price: 113300, note: '駐輪場照明' },
      'ライティングレール': { unit: 'm', price: 2740 },
      'ライティングレールジョイナー': { unit: '個', price: 4585 },
      '人感センサー親器': { unit: '台', price: 12000 },
      '人感センサー子器': { unit: '台', price: 9500 },
      '店内基本照明配線取付作業': { unit: '個', price: 4500 },
      'ダウンライト墨出し配線取付工事': { unit: '個', price: 4500 },
      '店内墨出し下地材仕込み取付作業': { unit: '式', price: 200000 },
      'エアコン・ロスナイ電源工事': { unit: '式', price: 70000 },
      '店内照明墨出し配線工事': { unit: '式', price: 420000 },
      'バックヤード等配線工事': { unit: '式', price: 165000 },
      'スポットライト取付工事': { unit: '式', price: 99000 }
    },
    wiring: {
      '幹線配線工事': { unit: '式', price: 265000 },
      'コンセント配線取付工事': { unit: '式', price: 230000 },
      '店内コンセント墨出しボックス取付': { unit: '式', price: 135000 },
      'BY作業場事務所コンセント墨出し工事': { unit: '式', price: 230000 },
      'レジコンセント工事': { unit: '式', price: 175000 },
      '床コンセントボックス配管工事': { unit: '式', price: 130000 },
      'Wコンセント(WN1302010)': { unit: 'セット', price: 560 },
      'E付Wコンセント(WN1512K)': { unit: 'セット', price: 680 },
      '抜け止めWコンセントE付(WN1162)': { unit: 'セット', price: 880 },
      'アップコンセント(DU5146PV)': { unit: 'セット', price: 5900 },
      '防水コンセント(WK4106)': { unit: '個', price: 1320 }
    },
    broadcast: {
      '埋込スピーカー(CM-2330A)': { unit: '個', price: 4600 },
      '埋込スピーカー アッテネーター付き(CM-2330AT)': { unit: '個', price: 6800 },
      'アッテネーター(AT-065A)': { unit: '個', price: 3400 },
      '配線工事費': { unit: '式', price: 330000 },
      '機器取付工事費': { unit: '式', price: 77000 },
      '調整試験費': { unit: '式', price: 16500 }
    },
    fireAlarm: {
      'P型1級複合盤受信機(HAV-AAW20 ホーチキ)': { unit: '台', price: 650000 },
      '光電式スポット感知器(SLV-2RL ホーチキ)': { unit: '個', price: 15800 },
      '定温式スポット感知器(DFG1W70L ホーチキ)': { unit: '個', price: 2300 },
      'フラット型小型機器収容箱(KSU-10HSKY ホーチキ)': { unit: '台', price: 26500 },
      '配線工事費(自火報)': { unit: '式', price: 380000 },
      '機器取付工事(自火報)': { unit: '式', price: 260000 },
      '避難口誘導灯C級片面(FA10312CLE1)': { unit: '台', price: 25000 },
      '室内通路誘導灯C級両面(FA10322CLE1)': { unit: '台', price: 26500 },
      '誘導灯配線工事費': { unit: '式', price: 330000 },
      '誘導灯機器取付工事費': { unit: '式', price: 120000 },
      '消火器埋込タイプ(UFB-1F-3025)': { unit: '個', price: 23000 },
      '消火器据え置きタイプ(SK-FEB-FG310)': { unit: '個', price: 10500 },
      '消火器(粉末ABC10型)': { unit: '個', price: 5000 }
    },
    ems: {
      'MVVS1.25sq-2C': { unit: 'm', price: 240 },
      'MVVS1.25sq-4C': { unit: 'm', price: 385 },
      'Cate5E': { unit: 'm', price: 120 },
      'Cate6':  { unit: 'm', price: 200 },
      'Bルート申請作業': { unit: '式', price: 40000 },
      '室温センサー工事': { unit: '式', price: 45000 },
      '水道計測センサー工事': { unit: '式', price: 45000 },
      '温湿度水道センサー配線接続工事': { unit: '式', price: 99000 },
      'エネミエール配線接続工事': { unit: '式', price: 185000 },
      'EMS集中盤取付け管配線接続工事': { unit: '式', price: 70000 },
      'スマートメーター配線配管工事': { unit: '式', price: 70000 }
    }
  },

  mechanicalPrices: {
    waterSupply: {
      'HIVP50': { unit: 'm', price: 2455 },
      'HIVP25': { unit: 'm', price: 1255 },
      'HIVP20': { unit: 'm', price: 770 },
      '給水繋ぎ手・接合剤': { unit: '式', price: 60000 },
      '給排水管施工費': { unit: 'm', price: 5000 },
      '配管支持金具': { unit: '式', price: 200000 },
      'ゲートバルブ': { unit: '式', price: 66000 },
      '保温工事（AJGC20mm厚）': { unit: 'm', price: 3850 }
    },
    drainage: {
      'VP75': { unit: 'm', price: 2280 },
      'VP65': { unit: 'm', price: 1520 },
      'VP50': { unit: 'm', price: 1240 },
      'VP40': { unit: 'm', price: 900 },
      '排水桝及び排水目皿設置': { unit: '式', price: 48000 },
      '既存管接続': { unit: 'ヶ所', price: 33000 },
      '圧送ポンプ系統配管（保温・全ネジ固定込み）': { unit: 'm', price: 10500 },
      '排水管施工費': { unit: 'm', price: 5000 }
    },
    sanitary: {
      '雑排NSBスマートポンプ（ZA-100NSB+）': { unit: '個', price: 440000 },
      '厨房用バスケット桝（STU-35）': { unit: '個', price: 88000 },
      '衛生器具設置（トイレ・SK・手洗い）': { unit: '台', price: 30000 },
      '洗濯機パン設置': { unit: '台', price: 16500 },
      '休憩室流し台設置': { unit: '台', price: 30000 },
      '売場手洗器設置': { unit: '台', price: 30000 },
      '厨房用水栓取付（フレキ管・止水栓込み）': { unit: '式', price: 75000 },
      'バリアフリートイレ（LSD-8）': { unit: '台', price: 600000 },
      '1窓用トイレ呼出壁付型表示器（CBN-1C）': { unit: '台', price: 126060 }
    },
    hvac: {
      '高効率ビル用マルチ組合20馬力（PA-P560UX6）': { unit: '式', price: 1100000 },
      '高効率ビル用マルチ組合18馬力（PA-P500UX6）': { unit: '式', price: 920000 },
      'ビル用ビルトインオルダクト形（CS-P90FE6U）': { unit: '台', price: 105000 },
      'ビル用4方向天井カセット形（CS-P160U6U）': { unit: '台', price: 132000 },
      '壁掛けエアコン室内外セット（XCS-285DFL-W/S）': { unit: '式', price: 89210 },
      '4方向天井カセットECOツイン（PA-P280U7B x2）': { unit: '式', price: 494560 },
      '1方向天井カセットEco（PA-P40DM7HNB）': { unit: '式', price: 145000 },
      '1方向天井カセットEco（PA-P40U7HB）': { unit: '式', price: 134100 },
      '4方向天井カセットEco（PA-P63U7HNB）': { unit: '式', price: 180000 },
      'オールフレッシュ仕様工場改造費': { unit: '式', price: 320000 },
      '安全遮断弁（CZ-P160BU6）': { unit: '台', price: 132000 },
      '冷媒漏洩検知警報機（CZ-RLDS1）': { unit: '台', price: 26500 },
      '冷媒管（6.4-12.7A）': { unit: 'm', price: 4000 },
      '冷媒管（9.5-15.9A）': { unit: 'm', price: 5200 },
      '冷媒管（12.7-25.1A）': { unit: 'm', price: 8800 },
      '冷媒管（15.9-28.6A）': { unit: 'm', price: 13200 },
      '冷媒管継手材': { unit: '式', price: 260000 },
      '冷媒配管施工費': { unit: '式', price: 770000 },
      'ドレン管（VP-25A）': { unit: 'm', price: 440 },
      '搬入工事/設置費用': { unit: '式', price: 400000 },
      '内機設置工事費（開口・パネル含）': { unit: '式', price: 320000 },
      'ガスチャージ': { unit: '式', price: 180000 },
      '機密検査/ガス圧': { unit: '式', price: 80000 },
      '耐火処理（材工共）': { unit: '式', price: 180000 },
      '試運転調整費': { unit: '式', price: 45000 }
    },
    ventilation: {
      '排気ファン新キャビネット消音（FY-28SCX3）': { unit: '台', price: 205000 },
      'ロスナイ（FY-150ZB10）': { unit: '台', price: 135000 },
      'ロスナイ（FY-15ZBG3）': { unit: '台', price: 84000 },
      'カラットデシカント（DES・DX10）': { unit: '台', price: 1980000 },
      'カラットデシカント用遠方操作盤（EMS対応品）': { unit: '式', price: 1450000 },
      'カラットデシカント本体改造費': { unit: '式', price: 300000 },
      'デシカント運送費': { unit: '式', price: 175000 },
      'デシカント試運転調整費': { unit: '式', price: 220000 },
      '防振ハンガー': { unit: 'セット', price: 26500 },
      '角材/亜鉛ダクト（0.6t 材工共）': { unit: 'm2', price: 10500 },
      '角材/亜鉛ダクト（0.8t 材工共・口加工費含む）': { unit: 'm2', price: 21600 },
      '保温施工（GW25t 材工共）': { unit: '式', price: 990000 },
      'スパイラルダクト（亜鉛 300A 材工共）': { unit: 'm', price: 8500 },
      'スパイラルダクト（亜鉛 250A 材工共）': { unit: 'm', price: 7500 },
      'スパイラルダクト（亜鉛 200A 材工共）': { unit: 'm', price: 6200 },
      'スパイラルダクト（亜鉛 150A 材工共）': { unit: 'm', price: 5100 },
      'スパイラルダクト（亜鉛 100A 材工共）': { unit: 'm', price: 3500 },
      'VHS（500x500）': { unit: '台', price: 62000 },
      'VHS（450x450）': { unit: '台', price: 53000 },
      'VHS（350x350）': { unit: '台', price: 36000 },
      'WC（三菱電機 W-35SDB(M)）': { unit: '台', price: 80000 },
      '外部開口工事（76か所）': { unit: '式', price: 200000 }
    },
    fireProtection: {} // 西一之江では電気側に計上のため空
  },

  specialConditions: [
    '日中工事（本工事）／一部日中工事、基本夜間工事（最終差額）',
    '事前確認: 特定解体工事発注者住所、第一種特定製品設置有無',
    '現場管理費根拠: 90日 × 25,000円 × 1名 = 2,250,000円',
    '見積有効期限: 提出後30日',
    '支払条件: 規定通り'
  ],

  notes: '本工事は㈰_20250724(¥95M)が唯一の本見積。後続11件は追加・増減見積。既存建屋改修ベースのため鉄筋・石・タイル工事は0計上、防災設備は電気側に独立計上。延床面積の記載がないため costPerM2 は算出不能。デシカント機器(DES・DX10 ¥1,980,000)は座間林間と同型・同単価で価格妥当性が確認できる。'
};

// ============================
// 夏島工場プロジェクト（v3 追加 — 工場・製造施設 新築/一部増築 S造・小規模）
//   実データ: WreckFix㈱ → ㈱メタルスタジオ 夏島工場新築工事 御見積書 No.329 (2025-05-30)
//   税抜工事代金 140,000,000 / 税込 154,000,000 / 延床 約648m2
//   ★小規模S造工場は m2単価が大きく上振れ（規模の経済が働かない＋地盤改良杭＋重量鉄骨＋大型シャッター）。
//     座間・西一之江(小売)の単価をそのまま当てると半額以下に過小評価されるため要注意。
// ============================
const NATSUSHIMA = {
  project: {
    name: '(株)メタルスタジオ夏島工場新築工事',
    type: '工場（製造施設）新築・一部増築（S造2階建・小規模）',
    client: '株式会社メタルスタジオ',
    contractor: 'WreckFix株式会社',
    location: '神奈川県横須賀市夏島町15-7',
    structure: 'S造（鉄骨造）',
    floors: 2,
    totalFloorArea: 648, // m2（概算・延床）
    estimateDate: '2025-05-30',
    totalCostExclTax: 140000000,
    taxRate: 0.10,
    totalCostInclTax: 154000000,
    directCostTotal: 127793504, // 工事合計（現場管理費を含む直接工事費）
    costPerM2: 216049,          // 円/m2（税抜工事代金 / 延床648m2）
    costPerM2Direct: 197212,    // 円/m2（直接工事費ベース）
    steelWeightKg: 44876,       // 主要鉄骨重量（約45t、69kg/m2）→ S造工場は鉄骨が主役
    sourcePDFs: ['★20250530(NET)_(株)メタルスタジオ夏島工場新築工事.pdf']
  },

  // 工種別（直接工事費 127,793,504 を100%とする比率。電気は別途=0）
  categories: {
    '共通仮設工事': { amount:  7987000, ratio: 0.0625 },
    '建築工事':     { amount: 94695516, ratio: 0.7410 },
    '電気設備工事': { amount:        0, ratio: 0.0000, note: '別途工事' },
    '機械設備工事': { amount:  3417688, ratio: 0.0267 },
    '杭工事':       { amount: 11600000, ratio: 0.0908, note: '地盤改良杭 改良径φ1000・Fc600・71本' },
    '解体工事':     { amount:  2065300, ratio: 0.0162, note: '既存ｱｽﾌｧﾙﾄ・庇・受け梁・ｼｬｯﾀｰ撤去' },
    '現場管理費':   { amount:  8028000, ratio: 0.0628 }
  },

  // 直接工事費の外側の費率（base = 直接工事費 127,793,504）
  feeStructure: {
    legalWelfare: { amount:  1664801, rateOfDirect: 0.0130 },
    overhead:     { amount: 11653613, rateOfDirect: 0.0912 },
    adjustment:   { amount: -1111918, rateOfTotal: -0.0079 } // 端数調整（大幅値引きではない）
  },

  // 建築工事 中項目別（合計 94,695,516）
  architectureBreakdown: {
    '直接仮設工事':         4668095,
    '土工事':               6536558,
    '鉄筋工事':             7729990,
    '型枠工事':             3492062,
    'コンクリート工事':     7568636,
    '鉄骨工事':            28772722, // ★建築の30% / 直接の22.5%。S造工場の主役。鉄骨約45t
    '防水工事':             1887885,
    '金属工事':             9731966, // 屋根折板・外壁角波・樋
    '左官工事':             1489608,
    '金属製建具工事':       3413740,
    'シャッター工事':       5536173, // ★電動重量シャッター・耐風圧1400Pa（工場特有の大型）
    'ガラス工事':           1237290,
    '内装工事':             3700946,
    '雑工事':               7072925, // 杭残土運搬処分3,276,000を含む
    'アスファルト舗装工事': 1856920
  },

  mechanicalBreakdown: {
    '衛生器具設備工事':   887440,
    '給水・給湯設備工事': 829840,
    '排水通気設備工事':   940333,
    '雑材・雑工事費':     175000,
    '運搬費':             198600,
    '機械設備工事諸経費': 386475
    // ガス工事は別途（プロパンガス屋打合せ）
  },

  // 杭工事（地盤改良）— 小規模工場でも数量が大きく m2単価を押し上げる主要因
  pileWork: {
    method: '柱状改良 改良径φ1000 / 設計基準強度Fc=600kN/m2 / 71本',
    breakdown: {
      '施工費(空堀部)': { quantity: 76,  unit: 'm', price: 5100,  amount:  387600 },
      '施工費(改良部)': { quantity: 458, unit: 'm', price: 11000, amount: 5038000 },
      'フレコン':       { quantity: 108, unit: 't', price: 38000, amount: 4104000 },
      '機械運搬費':     { amount: 1506000 },
      '機械組立解体費': { amount:  430000 },
      '現場管理費':     { amount: 1143552 }
    },
    total: 11600000,
    note: '2025年4月からの単価適用。杭残土運搬処分(要改良156m3×21,000=3,276,000)は建築-雑工事に計上'
  },

  benchmarkCostPerM2: {
    '工場（製造施設・小規模S造・新築/増築）': { min: 180000, typical: 216000, max: 270000 }
  },

  notes: '小規模S造工場（延床648m2）の実受注見積。m2単価216,049円/m2(税抜工事代金)は小売新店(座間97,587円/m2)の約2.2倍。要因①規模が小さく仮設・重機回送・管理費が床面積で割られ単価上昇 ②地盤改良杭11.6M(約17,900円/m2) ③重量鉄骨45t(69kg/m2) ④工場特有の大型重量シャッター。電気設備は別途工事(0計上)、ガス工事も別途。調整費は端数調整(▲1,111,918)で大幅値引きではない。小売単価を工場に適用すると半額以下に過小評価されるため、工場案件では本データを参照すること。'
};

// ============================
// 全プロジェクトコレクション（v2 新コードはこちらを使用）
// ============================
REFERENCE_DATA.PROJECTS = {
  zamaRinkan: {
    project: REFERENCE_DATA.project,
    categories: REFERENCE_DATA.categories,
    costStructure: REFERENCE_DATA.costStructure,
    architectureBreakdown: REFERENCE_DATA.architectureBreakdown,
    electricalBreakdown: REFERENCE_DATA.electricalBreakdown,
    mechanicalBreakdown: REFERENCE_DATA.mechanicalBreakdown,
    unitPrices: REFERENCE_DATA.unitPrices,
    electricalPrices: REFERENCE_DATA.electricalPrices,
    mechanicalPrices: REFERENCE_DATA.mechanicalPrices,
    costPerM2ByCategory: REFERENCE_DATA.costPerM2ByCategory,
    specialConditions: REFERENCE_DATA.specialConditions
  },
  nishiIchinoe: NISHI_ICHINOE,
  natsushima: NATSUSHIMA
};
REFERENCE_DATA.PRIMARY_PROJECT = 'zamaRinkan';

// プロジェクト選定ヒント: 入力内容（用途・規模）から最適な参照プロジェクトを選ぶ
//  - 新店S造・延床1000m2超・新築 → zamaRinkan
//  - 既存建屋改修・内装中心・延床1000m2未満 → nishiIchinoe
//  - 両方参照（両方の単価を比較したい）→ 'both'
REFERENCE_DATA.projectSelectionHints = {
  '新店S造（新築）': 'zamaRinkan',
  '既存建屋改修（内装中心）': 'nishiIchinoe',
  '小規模スーパー改修': 'nishiIchinoe',
  '大規模新店': 'zamaRinkan',
  '工場・製造施設（S造）': 'natsushima',
  '小規模S造（新築/増築）': 'natsushima',
  '工場新築・増築': 'natsushima'
};

// Node.js環境向けエクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = REFERENCE_DATA;
}
