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

// --- render summary stats into #stats as a <dl> ---

function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  // Basic numbers
  const totalLOC = data.length;           // rows == lines
  const totalCommits = commits.length;

  // Distinct files
  const filesCount = d3.group(data, d => d.file).size;

  // Aggregates over whole dataset
  const maxDepth = d3.max(data, d => d.depth);
  const longestLine = d3.max(data, d => d.length);

  // Per-file aggregates → then summarize
  // max line number per file ≈ file length (in lines)
  const perFileMaxLine = d3.rollups(
    data,
    v => d3.max(v, d => d.line),
    d => d.file
  ); // => [ [file, maxLine], ... ]
  const maxLines = d3.max(perFileMaxLine, d => d[1]);
  const avgFileLength = Math.round(d3.mean(perFileMaxLine, d => d[1]));

  // Time-of-day with most work (morning/afternoon/evening/night)
  const workByPeriod = d3.rollups(
    data,
    v => v.length,
    d => new Date(d.datetime).toLocaleString('en', { dayPeriod: 'short' })
  ); // => [ ['morning', n], ... ]
  const mostActivePeriod = d3.greatest(workByPeriod, d => d[1])?.[0] ?? 'n/a';

  // Helper to add a row (dt + dd)
  const row = (label, value, useHtml = false) => {
    useHtml
      ? dl.append('dt').html(label)
      : dl.append('dt').text(label);
    dl.append('dd').text(value);
  };

  // Render rows (matches the screenshot/order style)
  row('Total <abbr title="Lines of code">LOC</abbr>', totalLOC, true);
  row('Total commits', totalCommits);
  row('Files', filesCount);
  row('Max depth', maxDepth);
  row('Longest line', longestLine);
  row('Max lines (file)', maxLines);
  row('Avg file length', avgFileLength);
  row('Most active period', mostActivePeriod);
}

function renderScatterPlot(data, commits) {
  // --- dimensions ---
  const width = 1000;
  const height = 600;

  // --- svg ---
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  // --- scales ---
  const xScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([0, width])
    .nice();

  const yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([height, 0]);

  // --- margins & usable area ---
  const margin = { top: 10, right: 10, bottom: 30, left: 40 };
  const usable = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom
  };

  // update ranges with margins
  xScale.range([usable.left, usable.right]);
  yScale.range([usable.bottom, usable.top]);

  // --- gridlines (add BEFORE axes) ---
  svg.append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usable.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usable.width));

  // --- dots ---
  const dots = svg.append('g').attr('class', 'dots');
  dots.selectAll('circle')
    .data(commits)
    .join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', 4)
    .attr('fill', 'steelblue');

  // --- axes ---
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3.axisLeft(yScale)
    .tickFormat(d => String(d % 24).padStart(2, '0') + ':00');

  svg.append('g')
    .attr('transform', `translate(0, ${usable.bottom})`)
    .call(xAxis);

  svg.append('g')
    .attr('transform', `translate(${usable.left}, 0)`)
    .call(yAxis);
}

// ===== run everything =====
const data = await loadData();
const commits = processCommits(data);
renderCommitInfo(data, commits);       // you already added this in Step 1.3
renderScatterPlot(data, commits);      // <— add this call