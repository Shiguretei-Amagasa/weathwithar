# WeathWithAR 🌤️

> 空に向けるだけで天気予報が現れるWebAR

## アーキテクチャ

```
ユーザーのスマホ
  └─ index.html (カメラ + 傾きセンサー + AR表示)
       └─ /api/weather (Vercel サーバーレス関数)
              └─ OpenWeatherMap API  ← APIキーはここのみに存在
```

**APIキーはサーバー側の環境変数にのみ格納。フロントエンドのコードには一切露出しません。**

---

## デプロイ手順

### 1. Vercel CLIをインストール

```bash
npm i -g vercel
```

### 2. プロジェクトをデプロイ

```bash
cd weatherwithar
vercel
```

### 3. 環境変数を設定（★重要）

Vercel Dashboardで設定するか、CLIで：

```bash
# OpenWeatherMap APIキー (必須)
vercel env add OWM_API_KEY production
# → プロンプトにAPIキーを貼り付けてEnter

# 許可オリジン (推奨: 自分のドメインのみ許可)
vercel env add ALLOWED_ORIGIN production
# → https://あなたのプロジェクト名.vercel.app を入力
```

### 4. 本番デプロイ

```bash
vercel --prod
```

### 5. 完了

生成されたURLをスマートフォンで開く。  
**HTTPS必須**（カメラ・GPS・傾きセンサーは全てHTTPS環境のみ動作）

---

## ローカル開発

```bash
vercel dev
```

`.env.local` ファイルを作成して環境変数を設定：

```env
OWM_API_KEY=あなたのAPIキー
ALLOWED_ORIGIN=http://localhost:3000
```

---

## APIキー取得方法

1. [https://openweathermap.org/api](https://openweathermap.org/api) でアカウント作成
2. API keys タブでキーをコピー
3. 新規登録後は有効化まで最大2時間かかる場合あります
4. 無料枠: 1,000,000 リクエスト/月

---

## セキュリティ設計

| 対策 | 実装場所 |
|---|---|
| APIキーをサーバー側環境変数に隔離 | `api/weather.js` + Vercel Env |
| レートリミット (60req/分/IP) | `api/weather.js` |
| CORS オリジン制限 | `api/weather.js` + `ALLOWED_ORIGIN` 環境変数 |
| 座標バリデーション | `api/weather.js` |
| レスポンスキャッシュ (5分) | `Cache-Control` ヘッダー |

---

## 使い方

1. スマートフォンのブラウザでURLを開く
2. カメラ・位置情報の許可を承認する  
   （iOSはタップでセンサーも許可）
3. スマホを空に向けると天気が表示される 🌤️

---

## ファイル構成

```
weatherwithar/
├── index.html        # ARフロントエンド
├── api/
│   └── weather.js   # Vercelサーバーレス関数 (APIプロキシ)
├── vercel.json       # Vercelデプロイ設定
├── .env.example      # 環境変数サンプル
└── README.md
```
