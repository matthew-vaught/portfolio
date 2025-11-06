// 1) Import D3 (ESM)
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// 2) Load & parse CSV with proper type conversions
async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));
  return data;
}

// 3) Transform rows -> commits array (group by commit)
function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)           // => [ [commitHash, linesArray], ... ]
    .map(([commit, lines]) => {
      // All rows in a commit share these fields, so read them from the first row
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;

      // Build the commit object with:
      // - basic info (id, author, timestamps)
      // - derived info (url, hourFrac, totalLines)
      const ret = {
        id: commit,
        url: `https://github.com/matthew-vaught/portfolio/commit/${commit}`,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      // Keep original lines as a *hidden* property (non-enumerable)
      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false,   // hides it from console enumeration
        writable: false,
        configurable: false,
      });

      return ret;
    });
}

// 4) Run the pipeline
const data = await loadData();
const commits = processCommits(data);

// (Optional) Inspect in console per the instructions
console.log('commits:', commits);

// You’ll use #stats later to render summaries/visuals