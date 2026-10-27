// Evaluate the keyword and semantic search fixtures with MRR and Recall@10.
import fs from 'node:fs';

// --- 1. Load the inputs (already done for you) -----------------------------
// test-set.csv has a header row, then: query,correct_post_ids
// correct_post_ids may be a semicolon list, e.g. "1024;1025".
function loadTestSet(path) {
  const lines = fs.readFileSync(path, 'utf8').trim().split('\n').slice(1);
  return lines.map(line => {
    const [query, ids] = line.split(',');
    return { query, correctIds: ids.split(';').map(Number) };
  });
}
const testSet = loadTestSet('test-set.csv');

// search-results.json maps each query to the top-10 ranked post_id lists that
// each system returned: { "<query>": { keyword: [...], semantic: [...] } }
const results = JSON.parse(fs.readFileSync('search-results.json', 'utf8'));

// --- 2. TODO: Reciprocal Rank ----------------------------------------------
// Return 1 / (rank of the FIRST correct id in rankedIds). Return 0 if none of
// the correct ids appear in rankedIds. Rank is 1-based (first result = rank 1).
function reciprocalRank(rankedIds, correctIds) {
  const rank = rankOf(rankedIds, correctIds);
  return rank === null ? 0 : 1 / rank;
}

// Helper: the 1-based rank of the first correct id, or null if it is a miss.
function rankOf(rankedIds, correctIds) {
  const correctIdSet = new Set(correctIds);
  const index = rankedIds.findIndex((id) => correctIdSet.has(Number(id)));
  return index === -1 ? null : index + 1;
}

if (testSet.length === 0) {
  throw new Error('The test set must contain at least one query.');
}

const keywordReciprocalRanks = [];
const semanticReciprocalRanks = [];
let keywordHits = 0;
let semanticHits = 0;
const rows = [];

for (const { query, correctIds } of testSet) {
  const queryResults = results[query];
  if (!queryResults || !Array.isArray(queryResults.keyword) || !Array.isArray(queryResults.semantic)) {
    throw new Error(`Missing ranked result lists for query: ${query}`);
  }

  const keywordRank = rankOf(queryResults.keyword, correctIds);
  const semanticRank = rankOf(queryResults.semantic, correctIds);
  const keywordRR = reciprocalRank(queryResults.keyword, correctIds);
  const semanticRR = reciprocalRank(queryResults.semantic, correctIds);

  keywordReciprocalRanks.push(keywordRR);
  semanticReciprocalRanks.push(semanticRR);
  if (keywordRR > 0) keywordHits++;
  if (semanticRR > 0) semanticHits++;
  rows.push({
    query,
    keywordRank: keywordRank ?? 'miss',
    semanticRank: semanticRank ?? 'miss',
  });
}

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const keywordMRR = mean(keywordReciprocalRanks);
const semanticMRR = mean(semanticReciprocalRanks);
const keywordRecall = keywordHits / testSet.length;
const semanticRecall = semanticHits / testSet.length;
const format = (value) => value.toFixed(2);

console.log('| Query | Keyword rank | Semantic rank |');
console.log('|---|---|---|');
for (const row of rows) {
  console.log(`| ${row.query} | ${row.keywordRank} | ${row.semanticRank} |`);
}
console.log(
  `| **Summary** | **MRR ${format(keywordMRR)} · Recall@10 ${format(keywordRecall)}** | **MRR ${format(semanticMRR)} · Recall@10 ${format(semanticRecall)}** |`,
);
