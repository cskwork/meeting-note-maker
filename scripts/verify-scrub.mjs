// Regression fixture for Whisper output post-filter.
// Run: node scripts/verify-scrub.mjs
//
// This script mirrors the scrubHallucination + truncateAtRepetitionLoop logic
// in src/stt/sttWorker.ts. If you change that logic, update this file too —
// the build's TS strict pass is the source-of-truth, this is the fast check.

function scrubHallucination(text) {
  let t = text.replace(/�/g, '').trim();
  if (!t) return '';
  t = truncateAtRepetitionLoop(t);
  if (!t) return '';
  if (/^[\s\-—–·.…,!?。、ㆍ"'`()<>「」『』]+$/u.test(t)) return '';
  const compact = t.replace(/\s+/g, '');
  if (compact.length >= 4) {
    const firstChar = compact[0];
    const sameRatio = [...compact].filter((c) => c === firstChar).length / compact.length;
    if (sameRatio >= 0.9) return '';
  }
  return t;
}

function truncateAtRepetitionLoop(text) {
  const tokens = text.split(/\s+/);
  if (tokens.length < 4) return text;
  for (let i = 0; i + 3 < tokens.length; i++) {
    const a = stripPunct(tokens[i]);
    if (!a) continue;
    if (
      stripPunct(tokens[i + 1]) === a &&
      stripPunct(tokens[i + 2]) === a &&
      stripPunct(tokens[i + 3]) === a
    ) return tokens.slice(0, i).join(' ').trim();
  }
  const WIN = 6, THRESHOLD = 5;
  for (let i = 0; i + WIN <= tokens.length; i++) {
    const window = tokens.slice(i, i + WIN).map(stripPunct).filter(Boolean);
    if (window.length < THRESHOLD) continue;
    const firsts = window.map((w) => [...w][0]);
    const top = mostCommon(firsts);
    if (top.count >= THRESHOLD) return tokens.slice(0, i).join(' ').trim();
  }
  return text;
}

function stripPunct(s) {
  return s.replace(/[.!?,;:、。…·"'`()<>「」『』]/gu, '');
}

function mostCommon(arr) {
  const m = new Map();
  for (const c of arr) m.set(c, (m.get(c) ?? 0) + 1);
  let best = { ch: '', count: 0 };
  for (const [ch, count] of m) if (count > best.count) best = { ch, count };
  return best;
}

const cases = [
  // [name, input, expected]
  ['empty', '', ''],
  ['whitespace', '   \t\n  ', ''],
  ['dashes only', '- - - - -', ''],
  ['dots only', '...', ''],
  ['ellipsis', '…', ''],
  ['repeated char', 'ㅋㅋㅋㅋㅋㅋㅋㅋ', ''],
  ['replacement chars stripped', '안녕�하세요�', '안녕하세요'],
  ['valid Korean kept', '제대로 기능이 작동을 안 하고 있어', '제대로 기능이 작동을 안 하고 있어'],
  [
    'real-world Whisper degeneration (from user report)',
    '제대로 기능이 작동을 안 하고 있어 기능을 제대로 작동이 안 하고있어 무슨 일을 해? 왜 기능에 작동 안 하고있는지? 뭐 뭐 뭐? 뭐? 뭣? 뭢? 뭉? 뭈? 뭃? 뭜? 뭴? 뭝? 뭇? 뭌?',
    '제대로 기능이 작동을 안 하고 있어 기능을 제대로 작동이 안 하고있어 무슨 일을 해? 왜 기능에 작동 안 하고있는지?',
  ],
  ['same word x4', '뭐 뭐 뭐 뭐 안녕', ''],
  ['english loop after Korean', '안녕하세요 the the the the the', '안녕하세요'],
  ['short single word kept', '왜', '왜'],
  ['short question kept', '왜?', '왜?'],
];

let failed = 0;
for (const [name, input, expected] of cases) {
  const got = scrubHallucination(input);
  const ok = got === expected;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${name}` +
      (ok ? '' : `\n      input    : ${JSON.stringify(input)}` +
              `\n      expected : ${JSON.stringify(expected)}` +
              `\n      got      : ${JSON.stringify(got)}`),
  );
  if (!ok) failed++;
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed === 0 ? 0 : 1);
