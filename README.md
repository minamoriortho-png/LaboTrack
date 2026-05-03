# 技工物 進行表 Supabaseログイン修正版

## 重要

Supabase JSで使うProject URLは `/rest/v1/` なしです。

正:
https://xiflbktnmjzwdiavfdgz.supabase.co

誤:
https://xiflbktnmjzwdiavfdgz.supabase.co/rest/v1/

## Vercel環境変数

VITE_SUPABASE_URL=https://xiflbktnmjzwdiavfdgz.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_paj79HmcbGKtvsIHdRHkjg_Nu1G53mp

このZIPではfallbackとして上記値もコードに入れています。

## 先にやること

1. Supabase SQL Editorで `supabase-schema.sql` を実行
2. Authentication > Users でユーザーを作成
3. ユーザーのEmail confirmedを確認
4. GitHubにアップ
5. VercelでRedeploy

## Vercel設定

- Framework Preset: Vite
- Build Command: npm run build
- Output Directory: dist
