module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    hasKey: !!process.env.ANTHROPIC_API_KEY,
    mode: 'cloud',
    agents: 7,
    safePdfMB: 1.35,        // 単一グループで送れる安全PDFサイズ
    maxTotalMB: 100,         // 自動分割で扱える合計サイズ目安
    models: { fast: 'claude-haiku-4-5', primary: 'claude-sonnet-4-6', reasoning: 'claude-opus-4-7' },
    features: ['extended-thinking', 'auto-split', 'validation-agent']
  });
};
