module.exports = function handler(req, res) {
  // クラウドモードではサーバー側の環境変数を使用するため、このエンドポイントは不要
  res.json({ success: true, note: 'Cloud mode uses server-side env variable' });
};
