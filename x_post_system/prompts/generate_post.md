# ポスト生成プロンプト

> アプリ `/x-post/create` および手動生成時に使うプロンプト。
> ノウハウ取り込み完了後に最終調整する。

## 入力

- ジャンル（business / spiritual）
- 生成テーマ / 指示
- 参考にする分析結果（`XPostAnalysis` のID等）
- 本数（1〜複数）

## 必須参照ファイル

1. `../knowledge_common/post_principles.md`
2. `../knowledge_common/structure_patterns.md`
3. `../knowledge_common/ng_patterns.md`
4. ジャンルに応じて以下:
   - business → `../knowledge_business/{account_info,teachings,reference_posts}.md`
   - spiritual → `../knowledge_spiritual/{account_info,teachings,reference_posts}.md`

## 生成ルール

1. `account_info.md` の口調・温度を必ず守る
2. `teachings.md` の原則を満たす（NG項目チェック）
3. `reference_posts.md` の構造を **参考にしつつコピーしない**
4. 同じ冒頭フックを連続で使わない
5. ジャンル特有のコンプライアンス遵守（占い系: 断定NG等）

## 出力形式

```
### Post 1
[本文]
構造: フック型
使用KW:
分析参照: [analysisId]
```

> 詳細は取り込み完了後に追記。
