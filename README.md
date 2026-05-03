# 技工物 進行表 Supabase + Vercel 連携版

## 使い方

1. SupabaseのSQL Editorで `supabase-schema.sql` の内容を実行
2. Supabase Authenticationでログインユーザーを作成
3. このフォルダをGitHubにアップロード
4. VercelでGitHubリポジトリをデプロイ

## Supabase URL

このコードでは以下のProject URLを使用しています。

https://xiflbktnmjzwdiavfdgz.supabase.co

※ supabase-jsでは `/rest/v1/` 付きのAPI URLではなく、Project URLを使います。

## Vercel環境変数

コード内にfallbackとして値を入れていますが、本番ではVercelのEnvironment Variablesにも入れてください。

VITE_SUPABASE_URL=https://xiflbktnmjzwdiavfdgz.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_paj79HmcbGKtvsIHdRHkjg_Nu1G53mp

## Vercel設定

- Framework Preset: Vite
- Build Command: npm run build
- Output Directory: dist
