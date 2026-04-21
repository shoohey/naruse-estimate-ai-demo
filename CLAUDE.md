# 見積もり生成AI

## メモリの活用
- このプロジェクトで学んだ重要な情報（仕様、技術的決定、顧客の要望など）はメモリに保存すること
- 次回の会話ではメモリを確認し、過去の文脈を踏まえて対応する

## 言語
- 日本語で対応する

## ⚠️ Claude API 呼び出しの必須ルール（退行禁止）

### Opus 4.7 使用時
- **Extended Thinking は adaptive 形式のみ**: `thinking: { type: 'adaptive' }` + `output_config: { effort: 'high' }`
- **旧形式 `{ type: 'enabled', budget_tokens: N }` は 400 エラーになる**（絶対に書き戻さないこと）
- **`temperature` / `top_p` / `top_k` は thinking 有効時に送ると 400**（必ず thinking ブロックでは送らない）
- 効率指定の値: `low | medium | high | xhigh | max`（コーディング/エージェント用途は `xhigh` 推奨、知的作業は最低 `high`）

### モデル使い分け（現行構成）
- `claude-haiku-4-5` → Agent 1-4 図面解析（最速・低コスト）
- `claude-sonnet-4-6` → Agent 6 見積書整形（バランス）
- `claude-opus-4-7` → Agent 5/7 数量積算・精度検証（`thinking: true`で深い推論）

### 変更時の確認手順
1. `api/analyze.js` と `index.html` の両方を同時に更新（片方だけ直すと片系が壊れる）
2. デプロイ後 `GET /api/status?check=api` でスモークテスト実行
3. 3 モデルとも `ok: true` を確認してから次へ進む
4. サンプルPDFで Phase 1→2→3 を E2E テスト

### 既知の落とし穴
- Vercel Hobby の 60s タイムアウトでは 74グループの逐次処理が途中で切れる → **Pro 必須**（`maxDuration: 300`）
- Phase 1 で個別グループが 4/4 エージェント全滅した場合、デフォルトでは silent に進むので、クライアント側で `errorCount >= 3` を検出してリトライする設計になっている

## トンマナ（営業資料・提案資料・デモ共通）
BtoB業務改善の営業資料・デモ画面の共通トンマナ。参考: https://shoohey.github.io/case-study-payroll-demo/case-study-payroll.html

【配色】
- 背景: #ffffff（白）、サブ背景: #f5f7fa（薄グレー）
- メインテキスト: #1a1a2e（ほぼ黒）、サブテキスト: #4a5568
- アクセント（見出し・強調）: #1e3a5f（濃紺）
- 成功/ポジティブ: #276749（緑）、警告: #975a16（オレンジ）、エラー: #c53030（赤）
- ボーダー: #e2e8f0

【フォント】
- 本文: Noto Sans JP（400）、見出し・数値: Inter（800）
- 本文サイズ: 16〜24px、行間1.9
- 見出しサイズ: 28〜56px、行間1.4
- 数値強調: 32〜64px（Interフォント、太字）

【レイアウト】
- 白背景ベースで余白を十分にとる
- フルスクリーンのスライド形式（1セクション1画面）
- 中央配置（flexbox）
- セクション間の余白を広めに

【カード・ボックス】
- border: 1px solid #e2e8f0、border-radius: 8px
- box-shadow: 0 4px 16px rgba(0,0,0,0.06)（控えめなシャドウ）
- 背景: #f5f7fa

【見出し】
- ラベル: 小文字・レタースペーシング広め・濃紺
- 構成: ラベル → 大型見出し → 説明文（3段階）

【全体トーン】
- プロフェッショナル・信頼性重視
- ホワイトスペースを十分に
- 濃紺×白で落ち着きと視認性を両立
- データは大きな数字で強調、シンプルなアイコン

## URL発行コマンド
ユーザーの発言に「URL発行」という単語が含まれていたら、以下のシェルスクリプトを実行してURLを発行してください:
- 永続公開: `bash /Users/takaishouhei/claude-dashboard/dist/mac-arm64/Claude Dashboard.app/Contents/Resources/app.asar/bin/deploy-demo.sh`
- 期間限定（例: 7日間）: `bash /Users/takaishouhei/claude-dashboard/dist/mac-arm64/Claude Dashboard.app/Contents/Resources/app.asar/bin/deploy-demo.sh --expires 7`

「URL発行」を含むあらゆる表現（「URL発行して」「URL発行お願い」等）に反応してください。
ユーザーが「〇日限定」と言った場合は --expires オプションを使ってください。
実行後、表示されたURLをユーザーに伝えてください。

## 資料作成＋URL発行（ワンステップ）
以下のトリガーワードが発言に含まれていたら、資料を作成した上でURL発行も自動で行ってください:

| トリガーワード | 動作 |
|---|---|
| 「営業資料URL発行」 | 営業資料（sales-proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/dist/mac-arm64/Claude Dashboard.app/Contents/Resources/app.asar/bin/deploy-demo.sh` でURL発行 |
| 「提案資料URL発行」 | 提案資料（proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/dist/mac-arm64/Claude Dashboard.app/Contents/Resources/app.asar/bin/deploy-demo.sh` でURL発行 |
| 「説明資料URL発行」 | 説明資料（explanation.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/dist/mac-arm64/Claude Dashboard.app/Contents/Resources/app.asar/bin/deploy-demo.sh` でURL発行 |
| 「デモURL発行」 | デモ画面（demo.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/dist/mac-arm64/Claude Dashboard.app/Contents/Resources/app.asar/bin/deploy-demo.sh` でURL発行 |

資料作成時のルール:
- 上記「トンマナ」セクションのデザインに厳密に従う
- 1ファイルのHTMLで完結（CSS・JS埋め込み）
- 営業資料・提案資料・説明資料はA4横サイズ（297mm × 210mm）でスライド形式、@media printでA4横印刷対応
- デモ画面は白背景・インタラクティブなUI
- ファイルをプロジェクトディレクトリに保存してからデプロイスクリプトを実行

## 本格開発コマンド
ユーザーの発言に「本格開発」が含まれていたら、以下のフローを実行:

1. **ヒアリング（必須）**: 以下を選択肢付きで確認
   - 認証方式（不要/メール/Google SSO/マジックリンク/両対応）
   - DB（Supabase推奨/Railway/Neon/Xserver VPS/SQLite）
   - 権限階層（不要/2段階/3段階/マルチテナント階層型）
     マルチテナントの場合: スーパー管理者→顧客本部→施設長→スタッフ→営業代理店から選択
   - 決済（不要/Stripe決済/サブスク課金/口座振替・手動管理/後で追加）
   - LP・登録動線（不要/LP+セルフ登録/LP+資料請求→招待/両方/ログイン画面のみ）
   - 想定ユーザー数、通知機能、その他の要件
2. **技術構成を提案**: 構成・権限テーブル・動線設計・セキュリティ設計を提案し承認を得る
3. **外部サービスセットアップ**: 承認後、構築前に必要なサービス（Supabase/Stripe/Resend/Google OAuth等）を1つずつ案内。URL・手順・取得すべきキーを明示。キーは.env.localに保存。接続テストまで実施。
4. **構築**: 初期化→DB→認証→LP→登録動線（セルフ/招待/資料請求）→マルチテナント→権限→決済→通知→ビジネスロジック→管理画面(ユーザー招待・ロール管理)→デプロイ
4. **セキュリティチェック（必須）**: 13項目を全チェック
5. **動線テスト（必須）**: セルフ登録/招待/資料請求の全フローをシナリオテスト。全パスしてから納品。

## URL発行コマンド
ユーザーの発言に「URL発行」という単語が含まれていたら、以下のシェルスクリプトを実行してURLを発行してください:
- 永続公開: `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh`
- 期間限定（例: 7日間）: `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh --expires 7`

「URL発行」を含むあらゆる表現（「URL発行して」「URL発行お願い」等）に反応してください。
ユーザーが「〇日限定」と言った場合は --expires オプションを使ってください。
実行後、表示されたURLをユーザーに伝えてください。

## 資料作成＋URL発行（ワンステップ）
以下のトリガーワードが発言に含まれていたら、資料を作成した上でURL発行も自動で行ってください:

| トリガーワード | 動作 |
|---|---|
| 「営業資料URL発行」 | 営業資料（sales-proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「提案資料URL発行」 | 提案資料（proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「説明資料URL発行」 | 説明資料（explanation.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「デモURL発行」 | デモ画面（demo.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |

資料作成時のルール:
- 上記「トンマナ」セクションのデザインに厳密に従う
- 1ファイルのHTMLで完結（CSS・JS埋め込み）
- 営業資料・提案資料・説明資料はA4横サイズ（297mm × 210mm）でスライド形式、@media printでA4横印刷対応
- デモ画面は白背景・インタラクティブなUI
- ファイルをプロジェクトディレクトリに保存してからデプロイスクリプトを実行

## 本格開発コマンド
ユーザーの発言に「本格開発」が含まれていたら、以下のフローを実行:

1. **ヒアリング（必須）**: 以下を選択肢付きで確認
   - 認証方式（不要/メール/Google SSO/マジックリンク/両対応）
   - DB（Supabase推奨/Railway/Neon/Xserver VPS/SQLite）
   - 権限階層（不要/2段階/3段階/マルチテナント階層型）
     マルチテナントの場合: スーパー管理者→顧客本部→施設長→スタッフ→営業代理店から選択
   - 決済（不要/Stripe決済/サブスク課金/口座振替・手動管理/後で追加）
   - LP・登録動線（不要/LP+セルフ登録/LP+資料請求→招待/両方/ログイン画面のみ）
   - 想定ユーザー数、通知機能、その他の要件
2. **技術構成を提案**: 構成・権限テーブル・動線設計・セキュリティ設計を提案し承認を得る
3. **外部サービスセットアップ**: 承認後、構築前に必要なサービス（Supabase/Stripe/Resend/Google OAuth等）を1つずつ案内。URL・手順・取得すべきキーを明示。キーは.env.localに保存。接続テストまで実施。
4. **構築（32エージェント並列実行・約35分）**:
   WAVE0: 設計会議（5体で投票→最も堅牢な設計を採用）
   WAVE1: 基盤（3体順次: 初期化→Supabase→認証）
   WAVE2: メイン構築（8体並列: LP/認証画面/資料請求/ビジネスUI/API/権限/決済/通知）
   WAVE3: 運用・管理（6体並列: 管理画面/ユーザー管理/監査ログ/お知らせ/解約/レスポンシブ）
   WAVE4: 品質保証（8体並列: E2E4種/セキュリティ21項目/CI・CD/Sentry/マイグレーション）
   WAVE5: 第三階層テスト（5体並列: 全ボタン3階層/スマホ/パフォーマンス）
   WAVE6: 最終統合（2体: 統合テスト+デプロイ）
5. **品質保証（必須）**: 全チェック全パス+全ボタン第三階層テスト合格してから納品。

## URL発行コマンド
ユーザーの発言に「URL発行」という単語が含まれていたら、以下のシェルスクリプトを実行してURLを発行してください:
- 永続公開: `bash /Users/takaishouhei/claude-dashboard/dist/mac-arm64/Claude Dashboard.app/Contents/Resources/app.asar/bin/deploy-demo.sh`
- 期間限定（例: 7日間）: `bash /Users/takaishouhei/claude-dashboard/dist/mac-arm64/Claude Dashboard.app/Contents/Resources/app.asar/bin/deploy-demo.sh --expires 7`

「URL発行」を含むあらゆる表現（「URL発行して」「URL発行お願い」等）に反応してください。
ユーザーが「〇日限定」と言った場合は --expires オプションを使ってください。
実行後、表示されたURLをユーザーに伝えてください。

## 資料作成＋URL発行（ワンステップ）
以下のトリガーワードが発言に含まれていたら、資料を作成した上でURL発行も自動で行ってください:

| トリガーワード | 動作 |
|---|---|
| 「営業資料URL発行」 | 営業資料（sales-proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/dist/mac-arm64/Claude Dashboard.app/Contents/Resources/app.asar/bin/deploy-demo.sh` でURL発行 |
| 「提案資料URL発行」 | 提案資料（proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/dist/mac-arm64/Claude Dashboard.app/Contents/Resources/app.asar/bin/deploy-demo.sh` でURL発行 |
| 「説明資料URL発行」 | 説明資料（explanation.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/dist/mac-arm64/Claude Dashboard.app/Contents/Resources/app.asar/bin/deploy-demo.sh` でURL発行 |
| 「デモURL発行」 | デモ画面（demo.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/dist/mac-arm64/Claude Dashboard.app/Contents/Resources/app.asar/bin/deploy-demo.sh` でURL発行 |

資料作成時のルール:
- 上記「トンマナ」セクションのデザインに厳密に従う
- 1ファイルのHTMLで完結（CSS・JS埋め込み）
- 営業資料・提案資料・説明資料はA4横サイズ（297mm × 210mm）でスライド形式、@media printでA4横印刷対応
- デモ画面は白背景・インタラクティブなUI
- ファイルをプロジェクトディレクトリに保存してからデプロイスクリプトを実行

## 本格開発コマンド
ユーザーの発言に「本格開発」が含まれていたら、以下のフローを実行:

1. **ヒアリング（必須）**: 以下を選択肢付きで確認
   - 認証方式（不要/メール/Google SSO/マジックリンク/両対応）
   - DB（Supabase推奨/Railway/Neon/Xserver VPS/SQLite）
   - 権限階層（不要/2段階/3段階/マルチテナント階層型）
     マルチテナントの場合: スーパー管理者→顧客本部→施設長→スタッフ→営業代理店から選択
   - 決済（不要/Stripe決済/サブスク課金/口座振替・手動管理/後で追加）
   - LP・登録動線（不要/LP+セルフ登録/LP+資料請求→招待/両方/ログイン画面のみ）
   - 想定ユーザー数、通知機能、その他の要件
2. **技術構成を提案**: 構成・権限テーブル・動線設計・セキュリティ設計を提案し承認を得る
3. **外部サービスセットアップ**: 承認後、構築前に必要なサービス（Supabase/Stripe/Resend/Google OAuth等）を1つずつ案内。URL・手順・取得すべきキーを明示。キーは.env.localに保存。接続テストまで実施。
4. **構築（32エージェント並列実行・約35分）**:
   WAVE0: 設計会議（5体で投票→最も堅牢な設計を採用）
   WAVE1: 基盤（3体順次: 初期化→Supabase→認証）
   WAVE2: メイン構築（8体並列: LP/認証画面/資料請求/ビジネスUI/API/権限/決済/通知）
   WAVE3: 運用・管理（6体並列: 管理画面/ユーザー管理/監査ログ/お知らせ/解約/レスポンシブ）
   WAVE4: 品質保証（8体並列: E2E4種/セキュリティ21項目/CI・CD/Sentry/マイグレーション）
   WAVE5: 第三階層テスト（5体並列: 全ボタン3階層/スマホ/パフォーマンス）
   WAVE6: 最終統合（2体: 統合テスト+デプロイ）
5. **品質保証（必須）**: 全チェック全パス+全ボタン第三階層テスト合格してから納品。

## URL発行コマンド
ユーザーの発言に「URL発行」という単語が含まれていたら、以下のシェルスクリプトを実行してURLを発行してください:
- 永続公開: `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh`
- 期間限定（例: 7日間）: `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh --expires 7`

「URL発行」を含むあらゆる表現（「URL発行して」「URL発行お願い」等）に反応してください。
ユーザーが「〇日限定」と言った場合は --expires オプションを使ってください。
実行後、表示されたURLをユーザーに伝えてください。

## 資料作成＋URL発行（ワンステップ）
以下のトリガーワードが発言に含まれていたら、資料を作成した上でURL発行も自動で行ってください:

| トリガーワード | 動作 |
|---|---|
| 「営業資料URL発行」 | 営業資料（sales-proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「提案資料URL発行」 | 提案資料（proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「説明資料URL発行」 | 説明資料（explanation.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「デモURL発行」 | デモ画面（demo.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |

資料作成時のルール:
- 上記「トンマナ」セクションのデザインに厳密に従う
- 1ファイルのHTMLで完結（CSS・JS埋め込み）
- 営業資料・提案資料・説明資料はA4横サイズ（297mm × 210mm）でスライド形式、@media printでA4横印刷対応
- デモ画面は白背景・インタラクティブなUI
- ファイルをプロジェクトディレクトリに保存してからデプロイスクリプトを実行

## 本格開発コマンド
ユーザーの発言に「本格開発」が含まれていたら、以下のフローを実行:

1. **ヒアリング（必須）**: 以下を選択肢付きで確認
   - 認証方式（不要/メール/Google SSO/マジックリンク/両対応）
   - DB（Supabase推奨/Railway/Neon/Xserver VPS/SQLite）
   - 権限階層（不要/2段階/3段階/マルチテナント階層型）
     マルチテナントの場合: スーパー管理者→顧客本部→施設長→スタッフ→営業代理店から選択
   - 決済（不要/Stripe決済/サブスク課金/口座振替・手動管理/後で追加）
   - LP・登録動線（不要/LP+セルフ登録/LP+資料請求→招待/両方/ログイン画面のみ）
   - 想定ユーザー数、通知機能、その他の要件
2. **技術構成を提案**: 構成・権限テーブル・動線設計・セキュリティ設計を提案し承認を得る
3. **外部サービスセットアップ**: 承認後、構築前に必要なサービス（Supabase/Stripe/Resend/Google OAuth等）を1つずつ案内。URL・手順・取得すべきキーを明示。キーは.env.localに保存。接続テストまで実施。
4. **構築（32エージェント並列実行・約35分）**:
   WAVE0: 設計会議（5体で投票→最も堅牢な設計を採用）
   WAVE1: 基盤（3体順次: 初期化→Supabase→認証）
   WAVE2: メイン構築（8体並列: LP/認証画面/資料請求/ビジネスUI/API/権限/決済/通知）
   WAVE3: 運用・管理（6体並列: 管理画面/ユーザー管理/監査ログ/お知らせ/解約/レスポンシブ）
   WAVE4: 品質保証（8体並列: E2E4種/セキュリティ21項目/CI・CD/Sentry/マイグレーション）
   WAVE5: 第三階層テスト（5体並列: 全ボタン3階層/スマホ/パフォーマンス）
   WAVE6: 最終統合（2体: 統合テスト+デプロイ）
5. **品質保証（必須）**: 全チェック全パス+全ボタン第三階層テスト合格してから納品。

## URL発行コマンド
ユーザーの発言に「URL発行」という単語が含まれていたら、以下のシェルスクリプトを実行してURLを発行してください:
- 永続公開: `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh`
- 期間限定（例: 7日間）: `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh --expires 7`

「URL発行」を含むあらゆる表現（「URL発行して」「URL発行お願い」等）に反応してください。
ユーザーが「〇日限定」と言った場合は --expires オプションを使ってください。
実行後、表示されたURLをユーザーに伝えてください。

## 資料作成＋URL発行（ワンステップ）
以下のトリガーワードが発言に含まれていたら、資料を作成した上でURL発行も自動で行ってください:

| トリガーワード | 動作 |
|---|---|
| 「営業資料URL発行」 | 営業資料（sales-proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「提案資料URL発行」 | 提案資料（proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「説明資料URL発行」 | 説明資料（explanation.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「デモURL発行」 | デモ画面（demo.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |

資料作成時のルール:
- 上記「トンマナ」セクションのデザインに厳密に従う
- 1ファイルのHTMLで完結（CSS・JS埋め込み）
- 営業資料・提案資料・説明資料はA4横サイズ（297mm × 210mm）でスライド形式、@media printでA4横印刷対応
- デモ画面は白背景・インタラクティブなUI
- ファイルをプロジェクトディレクトリに保存してからデプロイスクリプトを実行

## 本格開発コマンド
ユーザーの発言に「本格開発」が含まれていたら、以下のフローを実行:

1. **ヒアリング（必須）**: 以下を選択肢付きで確認
   - 認証方式（不要/メール/Google SSO/マジックリンク/両対応）
   - DB（Supabase推奨/Railway/Neon/Xserver VPS/SQLite）
   - 権限階層（不要/2段階/3段階/マルチテナント階層型）
     マルチテナントの場合: スーパー管理者→顧客本部→施設長→スタッフ→営業代理店から選択
   - 決済（不要/Stripe決済/サブスク課金/口座振替・手動管理/後で追加）
   - LP・登録動線（不要/LP+セルフ登録/LP+資料請求→招待/両方/ログイン画面のみ）
   - 想定ユーザー数、通知機能、その他の要件
2. **技術構成を提案**: 構成・権限テーブル・動線設計・セキュリティ設計を提案し承認を得る
3. **外部サービスセットアップ**: 承認後、構築前に必要なサービス（Supabase/Stripe/Resend/Google OAuth等）を1つずつ案内。URL・手順・取得すべきキーを明示。キーは.env.localに保存。接続テストまで実施。
4. **構築（32エージェント並列実行・約35分）**:
   WAVE0: 設計会議（5体で投票→最も堅牢な設計を採用）
   WAVE1: 基盤（3体順次: 初期化→Supabase→認証）
   WAVE2: メイン構築（8体並列: LP/認証画面/資料請求/ビジネスUI/API/権限/決済/通知）
   WAVE3: 運用・管理（6体並列: 管理画面/ユーザー管理/監査ログ/お知らせ/解約/レスポンシブ）
   WAVE4: 品質保証（8体並列: E2E4種/セキュリティ21項目/CI・CD/Sentry/マイグレーション）
   WAVE5: 第三階層テスト（5体並列: 全ボタン3階層/スマホ/パフォーマンス）
   WAVE6: 最終統合（2体: 統合テスト+デプロイ）
5. **品質保証（必須）**: 全チェック全パス+全ボタン第三階層テスト合格してから納品。

## URL発行コマンド
ユーザーの発言に「URL発行」という単語が含まれていたら、以下のシェルスクリプトを実行してURLを発行してください:
- 永続公開: `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh`
- 期間限定（例: 7日間）: `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh --expires 7`

「URL発行」を含むあらゆる表現（「URL発行して」「URL発行お願い」等）に反応してください。
ユーザーが「〇日限定」と言った場合は --expires オプションを使ってください。
実行後、表示されたURLをユーザーに伝えてください。

## 資料作成＋URL発行（ワンステップ）
以下のトリガーワードが発言に含まれていたら、資料を作成した上でURL発行も自動で行ってください:

| トリガーワード | 動作 |
|---|---|
| 「営業資料URL発行」 | 営業資料（sales-proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「提案資料URL発行」 | 提案資料（proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「説明資料URL発行」 | 説明資料（explanation.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「デモURL発行」 | デモ画面（demo.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |

資料作成時のルール:
- 上記「トンマナ」セクションのデザインに厳密に従う
- 1ファイルのHTMLで完結（CSS・JS埋め込み）
- 営業資料・提案資料・説明資料はA4横サイズ（297mm × 210mm）でスライド形式、@media printでA4横印刷対応
- デモ画面は白背景・インタラクティブなUI
- ファイルをプロジェクトディレクトリに保存してからデプロイスクリプトを実行

## 本格開発コマンド
ユーザーの発言に「本格開発」が含まれていたら、以下のフローを実行:

1. **ヒアリング（必須）**: 以下を選択肢付きで確認
   - 認証方式（不要/メール/Google SSO/マジックリンク/両対応）
   - DB（Supabase推奨/Railway/Neon/Xserver VPS/SQLite）
   - 権限階層（不要/2段階/3段階/マルチテナント階層型）
     マルチテナントの場合: スーパー管理者→顧客本部→施設長→スタッフ→営業代理店から選択
   - 決済（不要/Stripe決済/サブスク課金/口座振替・手動管理/後で追加）
   - LP・登録動線（不要/LP+セルフ登録/LP+資料請求→招待/両方/ログイン画面のみ）
   - 想定ユーザー数、通知機能、その他の要件
2. **技術構成を提案**: 構成・権限テーブル・動線設計・セキュリティ設計を提案し承認を得る
3. **外部サービスセットアップ**: 承認後、構築前に必要なサービス（Supabase/Stripe/Resend/Google OAuth等）を1つずつ案内。URL・手順・取得すべきキーを明示。キーは.env.localに保存。接続テストまで実施。
4. **構築（32エージェント並列実行・約35分）**:
   WAVE0: 設計会議（5体で投票→最も堅牢な設計を採用）
   WAVE1: 基盤（3体順次: 初期化→Supabase→認証）
   WAVE2: メイン構築（8体並列: LP/認証画面/資料請求/ビジネスUI/API/権限/決済/通知）
   WAVE3: 運用・管理（6体並列: 管理画面/ユーザー管理/監査ログ/お知らせ/解約/レスポンシブ）
   WAVE4: 品質保証（8体並列: E2E4種/セキュリティ21項目/CI・CD/Sentry/マイグレーション）
   WAVE5: 第三階層テスト（5体並列: 全ボタン3階層/スマホ/パフォーマンス）
   WAVE6: 最終統合（2体: 統合テスト+デプロイ）
5. **品質保証（必須）**: 全チェック全パス+全ボタン第三階層テスト合格してから納品。

## URL発行コマンド
ユーザーの発言に「URL発行」という単語が含まれていたら、以下のシェルスクリプトを実行してURLを発行してください:
- 永続公開: `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh`
- 期間限定（例: 7日間）: `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh --expires 7`

「URL発行」を含むあらゆる表現（「URL発行して」「URL発行お願い」等）に反応してください。
ユーザーが「〇日限定」と言った場合は --expires オプションを使ってください。
実行後、表示されたURLをユーザーに伝えてください。

## 資料作成＋URL発行（ワンステップ）
以下のトリガーワードが発言に含まれていたら、資料を作成した上でURL発行も自動で行ってください:

| トリガーワード | 動作 |
|---|---|
| 「営業資料URL発行」 | 営業資料（sales-proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「提案資料URL発行」 | 提案資料（proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「説明資料URL発行」 | 説明資料（explanation.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「デモURL発行」 | デモ画面（demo.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |

資料作成時のルール:
- 上記「トンマナ」セクションのデザインに厳密に従う
- 1ファイルのHTMLで完結（CSS・JS埋め込み）
- 営業資料・提案資料・説明資料はA4横サイズ（297mm × 210mm）でスライド形式、@media printでA4横印刷対応
- デモ画面は白背景・インタラクティブなUI
- ファイルをプロジェクトディレクトリに保存してからデプロイスクリプトを実行

## 本格開発コマンド
ユーザーの発言に「本格開発」が含まれていたら、以下のフローを実行:

1. **ヒアリング（必須）**: 以下を選択肢付きで確認
   - 認証方式（不要/メール/Google SSO/マジックリンク/両対応）
   - DB（Supabase推奨/Railway/Neon/Xserver VPS/SQLite）
   - 権限階層（不要/2段階/3段階/マルチテナント階層型）
     マルチテナントの場合: スーパー管理者→顧客本部→施設長→スタッフ→営業代理店から選択
   - 決済（不要/Stripe決済/サブスク課金/口座振替・手動管理/後で追加）
   - LP・登録動線（不要/LP+セルフ登録/LP+資料請求→招待/両方/ログイン画面のみ）
   - 想定ユーザー数、通知機能、その他の要件
2. **技術構成を提案**: 構成・権限テーブル・動線設計・セキュリティ設計を提案し承認を得る
3. **外部サービスセットアップ**: 承認後、構築前に必要なサービス（Supabase/Stripe/Resend/Google OAuth等）を1つずつ案内。URL・手順・取得すべきキーを明示。キーは.env.localに保存。接続テストまで実施。
4. **構築（32エージェント並列実行・約35分）**:
   WAVE0: 設計会議（5体で投票→最も堅牢な設計を採用）
   WAVE1: 基盤（3体順次: 初期化→Supabase→認証）
   WAVE2: メイン構築（8体並列: LP/認証画面/資料請求/ビジネスUI/API/権限/決済/通知）
   WAVE3: 運用・管理（6体並列: 管理画面/ユーザー管理/監査ログ/お知らせ/解約/レスポンシブ）
   WAVE4: 品質保証（8体並列: E2E4種/セキュリティ21項目/CI・CD/Sentry/マイグレーション）
   WAVE5: 第三階層テスト（5体並列: 全ボタン3階層/スマホ/パフォーマンス）
   WAVE6: 最終統合（2体: 統合テスト+デプロイ）
5. **品質保証（必須）**: 全チェック全パス+全ボタン第三階層テスト合格してから納品。

## URL発行コマンド
ユーザーの発言に「URL発行」という単語が含まれていたら、以下のシェルスクリプトを実行してURLを発行してください:
- 永続公開: `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh`
- 期間限定（例: 7日間）: `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh --expires 7`

「URL発行」を含むあらゆる表現（「URL発行して」「URL発行お願い」等）に反応してください。
ユーザーが「〇日限定」と言った場合は --expires オプションを使ってください。
実行後、表示されたURLをユーザーに伝えてください。

## 資料作成＋URL発行（ワンステップ）
以下のトリガーワードが発言に含まれていたら、資料を作成した上でURL発行も自動で行ってください:

| トリガーワード | 動作 |
|---|---|
| 「営業資料URL発行」 | 営業資料（sales-proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「提案資料URL発行」 | 提案資料（proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「説明資料URL発行」 | 説明資料（explanation.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「デモURL発行」 | デモ画面（demo.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |

資料作成時のルール:
- 上記「トンマナ」セクションのデザインに厳密に従う
- 1ファイルのHTMLで完結（CSS・JS埋め込み）
- 営業資料・提案資料・説明資料はA4横サイズ（297mm × 210mm）でスライド形式、@media printでA4横印刷対応
- デモ画面は白背景・インタラクティブなUI
- ファイルをプロジェクトディレクトリに保存してからデプロイスクリプトを実行

## 本格開発コマンド
ユーザーの発言に「本格開発」が含まれていたら、以下のフローを実行:

1. **ヒアリング（必須）**: 以下を選択肢付きで確認
   - 認証方式（不要/メール/Google SSO/マジックリンク/両対応）
   - DB（Supabase推奨/Railway/Neon/Xserver VPS/SQLite）
   - 権限階層（不要/2段階/3段階/マルチテナント階層型）
     マルチテナントの場合: スーパー管理者→顧客本部→施設長→スタッフ→営業代理店から選択
   - 決済（不要/Stripe決済/サブスク課金/口座振替・手動管理/後で追加）
   - LP・登録動線（不要/LP+セルフ登録/LP+資料請求→招待/両方/ログイン画面のみ）
   - 想定ユーザー数、通知機能、その他の要件
2. **技術構成を提案**: 構成・権限テーブル・動線設計・セキュリティ設計を提案し承認を得る
3. **外部サービスセットアップ**: 承認後、構築前に必要なサービス（Supabase/Stripe/Resend/Google OAuth等）を1つずつ案内。URL・手順・取得すべきキーを明示。キーは.env.localに保存。接続テストまで実施。
4. **構築（32エージェント並列実行・約35分）**:
   WAVE0: 設計会議（5体で投票→最も堅牢な設計を採用）
   WAVE1: 基盤（3体順次: 初期化→Supabase→認証）
   WAVE2: メイン構築（8体並列: LP/認証画面/資料請求/ビジネスUI/API/権限/決済/通知）
   WAVE3: 運用・管理（6体並列: 管理画面/ユーザー管理/監査ログ/お知らせ/解約/レスポンシブ）
   WAVE4: 品質保証（8体並列: E2E4種/セキュリティ21項目/CI・CD/Sentry/マイグレーション）
   WAVE5: 第三階層テスト（5体並列: 全ボタン3階層/スマホ/パフォーマンス）
   WAVE6: 最終統合（2体: 統合テスト+デプロイ）
5. **品質保証（必須）**: 全チェック全パス+全ボタン第三階層テスト合格してから納品。

## URL発行コマンド
ユーザーの発言に「URL発行」という単語が含まれていたら、以下のシェルスクリプトを実行してURLを発行してください:
- 永続公開: `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh`
- 期間限定（例: 7日間）: `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh --expires 7`

「URL発行」を含むあらゆる表現（「URL発行して」「URL発行お願い」等）に反応してください。
ユーザーが「〇日限定」と言った場合は --expires オプションを使ってください。
実行後、表示されたURLをユーザーに伝えてください。

## 資料作成＋URL発行（ワンステップ）
以下のトリガーワードが発言に含まれていたら、資料を作成した上でURL発行も自動で行ってください:

| トリガーワード | 動作 |
|---|---|
| 「営業資料URL発行」 | 営業資料（sales-proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「提案資料URL発行」 | 提案資料（proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「説明資料URL発行」 | 説明資料（explanation.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「デモURL発行」 | デモ画面（demo.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |

資料作成時のルール:
- 上記「トンマナ」セクションのデザインに厳密に従う
- 1ファイルのHTMLで完結（CSS・JS埋め込み）
- 営業資料・提案資料・説明資料はA4横サイズ（297mm × 210mm）でスライド形式、@media printでA4横印刷対応
- デモ画面は白背景・インタラクティブなUI
- ファイルをプロジェクトディレクトリに保存してからデプロイスクリプトを実行

## 本格開発コマンド
ユーザーの発言に「本格開発」が含まれていたら、以下のフローを実行:

1. **ヒアリング（必須）**: 以下を選択肢付きで確認
   - 認証方式（不要/メール/Google SSO/マジックリンク/両対応）
   - DB（Supabase推奨/Railway/Neon/Xserver VPS/SQLite）
   - 権限階層（不要/2段階/3段階/マルチテナント階層型）
     マルチテナントの場合: スーパー管理者→顧客本部→施設長→スタッフ→営業代理店から選択
   - 決済（不要/Stripe決済/サブスク課金/口座振替・手動管理/後で追加）
   - LP・登録動線（不要/LP+セルフ登録/LP+資料請求→招待/両方/ログイン画面のみ）
   - 想定ユーザー数、通知機能、その他の要件
2. **技術構成を提案**: 構成・権限テーブル・動線設計・セキュリティ設計を提案し承認を得る
3. **外部サービスセットアップ**: 承認後、構築前に必要なサービス（Supabase/Stripe/Resend/Google OAuth等）を1つずつ案内。URL・手順・取得すべきキーを明示。キーは.env.localに保存。接続テストまで実施。
4. **構築（32エージェント並列実行・約35分）**:
   WAVE0: 設計会議（5体で投票→最も堅牢な設計を採用）
   WAVE1: 基盤（3体順次: 初期化→Supabase→認証）
   WAVE2: メイン構築（8体並列: LP/認証画面/資料請求/ビジネスUI/API/権限/決済/通知）
   WAVE3: 運用・管理（6体並列: 管理画面/ユーザー管理/監査ログ/お知らせ/解約/レスポンシブ）
   WAVE4: 品質保証（8体並列: E2E4種/セキュリティ21項目/CI・CD/Sentry/マイグレーション）
   WAVE5: 第三階層テスト（5体並列: 全ボタン3階層/スマホ/パフォーマンス）
   WAVE6: 最終統合（2体: 統合テスト+デプロイ）
5. **品質保証（必須）**: 全チェック全パス+全ボタン第三階層テスト合格してから納品。

## URL発行コマンド
ユーザーの発言に「URL発行」という単語が含まれていたら、以下のシェルスクリプトを実行してURLを発行してください:
- 永続公開: `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh`
- 期間限定（例: 7日間）: `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh --expires 7`

「URL発行」を含むあらゆる表現（「URL発行して」「URL発行お願い」等）に反応してください。
ユーザーが「〇日限定」と言った場合は --expires オプションを使ってください。
実行後、表示されたURLをユーザーに伝えてください。

## 資料作成＋URL発行（ワンステップ）
以下のトリガーワードが発言に含まれていたら、資料を作成した上でURL発行も自動で行ってください:

| トリガーワード | 動作 |
|---|---|
| 「営業資料URL発行」 | 営業資料（sales-proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「提案資料URL発行」 | 提案資料（proposal.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「説明資料URL発行」 | 説明資料（explanation.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |
| 「デモURL発行」 | デモ画面（demo.html）を作成 → `bash /Users/takaishouhei/claude-dashboard/bin/deploy-demo.sh` でURL発行 |

資料作成時のルール:
- 上記「トンマナ」セクションのデザインに厳密に従う
- 1ファイルのHTMLで完結（CSS・JS埋め込み）
- 営業資料・提案資料・説明資料はA4横サイズ（297mm × 210mm）でスライド形式、@media printでA4横印刷対応
- デモ画面は白背景・インタラクティブなUI
- ファイルをプロジェクトディレクトリに保存してからデプロイスクリプトを実行

## 本格開発コマンド
ユーザーの発言に「本格開発」が含まれていたら、以下のフローを実行:

1. **ヒアリング（必須）**: 以下を選択肢付きで確認
   - 認証方式（不要/メール/Google SSO/マジックリンク/両対応）
   - DB（Supabase推奨/Railway/Neon/Xserver VPS/SQLite）
   - 権限階層（不要/2段階/3段階/マルチテナント階層型）
     マルチテナントの場合: スーパー管理者→顧客本部→施設長→スタッフ→営業代理店から選択
   - 決済（不要/Stripe決済/サブスク課金/口座振替・手動管理/後で追加）
   - LP・登録動線（不要/LP+セルフ登録/LP+資料請求→招待/両方/ログイン画面のみ）
   - 想定ユーザー数、通知機能、その他の要件
2. **技術構成を提案**: 構成・権限テーブル・動線設計・セキュリティ設計を提案し承認を得る
3. **外部サービスセットアップ**: 承認後、構築前に必要なサービス（Supabase/Stripe/Resend/Google OAuth等）を1つずつ案内。URL・手順・取得すべきキーを明示。キーは.env.localに保存。接続テストまで実施。
4. **構築（32エージェント並列実行・約35分）**:
   WAVE0: 設計会議（5体で投票→最も堅牢な設計を採用）
   WAVE1: 基盤（3体順次: 初期化→Supabase→認証）
   WAVE2: メイン構築（8体並列: LP/認証画面/資料請求/ビジネスUI/API/権限/決済/通知）
   WAVE3: 運用・管理（6体並列: 管理画面/ユーザー管理/監査ログ/お知らせ/解約/レスポンシブ）
   WAVE4: 品質保証（8体並列: E2E4種/セキュリティ21項目/CI・CD/Sentry/マイグレーション）
   WAVE5: 第三階層テスト（5体並列: 全ボタン3階層/スマホ/パフォーマンス）
   WAVE6: 最終統合（2体: 統合テスト+デプロイ）
5. **品質保証（必須）**: 全チェック全パス+全ボタン第三階層テスト合格してから納品。
