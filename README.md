# 技工物 進行表｜納品アラート除外 修正版V2

## 今回の修正

- 工程が「納品」まで進んだカードは、上部の「間に合わない可能性があるカード」に表示されません
- 工程が「装着」のカードも、上部アラートには表示されません
- アラート対象は「印象」「発注」「承認」のカードのみです
- 統計の「間に合わない可能性」も「納品」「装着」を除外して計算します
- 「装着予定日超過のみ」フィルターも「納品」「装着」を除外します

## 詳細装置名

### ラビアル
- INSIGNIA
- ODB
- InhouseIDB
- DBS

### リンガル
- WINsystem
- ハーモニー
- AIS

### アライナー
- Angel Aligner
- SPARK
- Inhouse Aligner

### リテーナー
- プレートタイプ
- クリアリテーナー
- ボンデッドリンガルリテーナー

### その他
- バイトチェック
- TPA
- サージカルガイド
- その他

## Vercel環境変数

VITE_SUPABASE_URL=https://xiflbktnmjzwdiavfdgz.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_paj79HmcbGKtvsIHdRHkjg_Nu1G53mp

## Vercel設定

- Framework Preset: Vite
- Build Command: npm run build
- Output Directory: dist
