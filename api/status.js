module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    hasKey: !!process.env.ANTHROPIC_API_KEY,
    mode: 'cloud',
    agents: 6,
    maxFileSizeMB: 3
  });
};
