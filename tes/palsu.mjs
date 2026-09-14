/** Token palsu — dirakit di runtime biar file tes tidak berbentuk secret. */
const A = (n) => "A".repeat(n);

export const palsu = {
  github: () => `ghp_${A(36)}`,
  githubPat: () => `github_pat_${A(40)}`,
  telegram: () => `1234567890:${A(35)}`,
  aws: () => `AKIA${A(16)}`,
  awsSecret: () => "B".repeat(40),
  slack: () => ["xoxb", "1".repeat(12), A(24)].join("-"),
  stripe: () => `sk_live_${A(24)}`,
  openai: () => `sk-proj-${A(40)}`,
  openaiClassic: () => `sk-${A(48)}`,
  anthropic: () => `sk-ant-${A(40)}`,
  google: () => `AIza${A(35)}`,
  npm: () => `npm_${A(36)}`,
  gitlab: () => `glpat-${A(22)}`,
  huggingface: () => `hf_${A(22)}`,
  pemHeader: () => "-----BEGIN " + "RSA PRIVATE KEY-----",
  certHeader: () => "-----BEGIN " + "CERTIFICATE-----",
  seed12: () => Array.from({ length: 12 }, () => "alpha").join(" "),
  seed24: () => Array.from({ length: 24 }, () => "bravo").join(" "),
  nilaiEnv: () => "jangan-cetak-nilai-ini",
};
