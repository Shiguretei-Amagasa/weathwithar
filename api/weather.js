/**
 * WeathWithAR — Weather API Proxy
 * APIキーはサーバー側環境変数にのみ存在。フロントエンドには非公開。
 *
 * GET /api/weather?lat=35.68&lon=139.69&type=current
 * GET /api/weather?lat=35.68&lon=139.69&type=forecast
 */

// ── レートリミット ────────────────────────────────────────────────────────────
const ratemap = new Map();
const RATE_LIMIT  = 60;       // リクエスト数
const RATE_WINDOW = 60_000;   // ウィンドウ幅(ms)
const CLEANUP_INTERVAL = 5 * 60_000; // 5分ごとに古いエントリを削除

// メモリリーク対策: 期限切れエントリを定期削除
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of ratemap) {
    if (now > rec.resetAt) ratemap.delete(ip);
  }
}, CLEANUP_INTERVAL);

function checkRate(ip) {
  const now = Date.now();
  const rec = ratemap.get(ip);
  if (!rec || now > rec.resetAt) {
    ratemap.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (rec.count >= RATE_LIMIT) return false;
  rec.count++;
  return true;
}

// ── CORS ──────────────────────────────────────────────────────────────────────
// ★ デプロイ後は必ず ALLOWED_ORIGIN 環境変数に自分のドメインを設定してください
// 例: https://weatherwithar.vercel.app
// 設定しない場合は全オリジン許可(*) になります
function corsHeaders() {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

function send(res, status, body, extraHeaders = {}) {
  res.writeHead(status, { ...corsHeaders(), ...extraHeaders });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

// ── メインハンドラ ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders()).end();
    return;
  }

  // GET のみ許可
  if (req.method !== 'GET') {
    send(res, 405, { error: 'Method not allowed' });
    return;
  }

  // レートリミット
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || req.socket?.remoteAddress
           || 'unknown';
  if (!checkRate(ip)) {
    send(res, 429, { error: 'Too many requests. Please wait a moment.' });
    return;
  }

  // クエリパラメータ検証
  const { searchParams } = new URL(req.url, `https://${req.headers.host}`);
  const lat  = parseFloat(searchParams.get('lat'));
  const lon  = parseFloat(searchParams.get('lon'));
  const type = searchParams.get('type') || 'current';

  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    send(res, 400, { error: 'Invalid coordinates' });
    return;
  }

  // typeホワイトリスト（ここにない値は一切受け付けない）
  const ALLOWED_TYPES = ['current', 'forecast'];
  if (!ALLOWED_TYPES.includes(type)) {
    send(res, 400, { error: 'Invalid type parameter' });
    return;
  }

  // APIキー確認
  const key = process.env.OWM_API_KEY;
  if (!key) {
    send(res, 500, { error: 'Server configuration error' });
    return;
  }

  // OWMエンドポイント
  const endpoints = {
    current:  `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=ja`,
    forecast: `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric&lang=ja&cnt=4`,
  };

  try {
    const upstream = await fetch(endpoints[type]);
    const data = await upstream.json();

    if (!upstream.ok) {
      // OWMのエラーメッセージをそのままは返さない（情報漏洩防止）
      send(res, upstream.status, { error: 'Weather data unavailable' });
      return;
    }

    // 5分キャッシュ
    send(res, 200, data, {
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    });
  } catch {
    send(res, 502, { error: 'Failed to fetch weather data' });
  }
}
