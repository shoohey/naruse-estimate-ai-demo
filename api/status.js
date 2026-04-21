// GET /api/status            → 設定情報のみ
// GET /api/status?check=api   → Claude API の thinking 形式を実地で検証(smoke test)
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const base = {
    hasKey: !!process.env.ANTHROPIC_API_KEY,
    mode: 'cloud',
    agents: 7,
    safePdfMB: 1.35,
    maxTotalMB: 100,
    models: { fast: 'claude-haiku-4-5', primary: 'claude-sonnet-4-6', reasoning: 'claude-opus-4-7' },
    features: ['extended-thinking-adaptive', 'auto-split', 'validation-agent'],
    thinkingFormat: { type: 'adaptive', output_config: { effort: 'high' } },
    deployedAt: new Date().toISOString(),
  };

  // 通常応答: 設定のみ
  if (!req.query || req.query.check !== 'api') {
    return res.json(base);
  }

  // Smoke test: 実際に Claude API に最小リクエストを投げ、Opus 4.7 の thinking adaptive 形式が通るか確認
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return res.status(400).json({ ...base, check: { ok: false, error: 'ANTHROPIC_API_KEY not set' } });
  }

  const checks = {};
  const testModel = async (model, useThinking) => {
    const body = {
      model,
      max_tokens: 512,
      messages: [{ role: 'user', content: 'Return the word OK only.' }],
    };
    if (useThinking) {
      body.thinking = { type: 'adaptive' };
      body.output_config = { effort: 'low' };
    } else {
      body.temperature = 0;
    }
    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) return { ok: false, status: resp.status, error: data?.error?.message || 'unknown' };
      return { ok: true, stopReason: data.stop_reason };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  };

  checks.haikuFast     = await testModel('claude-haiku-4-5',  false);
  checks.sonnetPrimary = await testModel('claude-sonnet-4-6', false);
  checks.opusThinking  = await testModel('claude-opus-4-7',   true);

  const allOk = checks.haikuFast.ok && checks.sonnetPrimary.ok && checks.opusThinking.ok;
  res.status(allOk ? 200 : 500).json({ ...base, check: { ok: allOk, ...checks } });
};
