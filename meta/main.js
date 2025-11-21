// 1) Imports
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://unpkg.com/scrollama@3.2.0/dist/scrollama.esm.js';

// ---------- Data loading ----------
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

// ---------- Commit processing ----------
function processCommits(data) {
  const grouped = d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      const f = lines[0];

      const ret = {
        id: commit,
        url: `https://github.com/matthew-vaught/portfolio/commit/${commit}`,
        author: f.author,
        date: f.date,
        time: f.time,
        timezone: f.timezone,
        datetime: f.datetime, // already a Date from loadData
        hourFrac: f.datetime.getHours() + f.datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      // keep original lines (hidden, non-enumerable)
      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false,
        writable: false,
        configurable: false,
      });

      return ret;
    });

  // Sort commits chronologically (earliest → latest)
  return d3.sort(grouped, (d) => d.datetime);
}

// ---------- Summary stats ----------
function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  const totalLOC = data.length;
  const totalCommits = commits.length;
  const filesCount = d3.group(data, (d) => d.file).size;
  const maxDepth = d3.max(data, (d) => d.depth);
  const longestLine = d3.max(data, (d) => d.length);

  const perFileMaxLine = d3.rollups(
    data,
    (v) => d3.max(v, (d) => d.line),
    (d) => d.file,
  );
  const maxLines = d3.max(perFileMaxLine, (d) => d[1]);
  const avgFileLength = Math.round(d3.mean(perFileMaxLine, (d) => d[1]));

  const row = (label, value, useHtml = false) => {
    useHtml ? dl.append('dt').html(label) : dl.append('dt').text(label);
    dl.append('dd').text(value);
  };

  row('Commits', totalCommits);
  row('Files', filesCount);
  row('Total <abbr title="Lines of code">LOC</abbr>', totalLOC, true);
  row('Max depth', maxDepth);
  row('Longest line', longestLine);
  row('Max lines', maxLines);
  row('Avg file length', avgFileLength);
}

// ---------- Tooltip helpers ----------
function renderTooltipContent(commit) {
  if (!commit) return;

  const link = document.getElementById('commit-link');
  const dateEl = document.getElementById('commit-date');
  const timeEl = document.getElementById('commit-time');
  const authEl = document.getElementById('commit-author');
  const linesEl = document.getElementById('commit-lines');

  if (!link) return; // page may not have tooltip

  link.href = commit.url;
  link.textContent = commit.id;
  dateEl.textContent = commit.datetime.toLocaleString('en', { dateStyle: 'full' });
  timeEl.textContent = commit.datetime.toLocaleTimeString('en', {
    hour: '2-digit',
    minute: '2-digit',
  });
  authEl.textContent = commit.author ?? '—';
  linesEl.textContent = String(commit.totalLines ?? commit.lines?.length ?? '—');
}

function updateTooltipVisibility(show) {
  const tip = document.getElementById('commit-tooltip');
  if (!tip) return;
  if (show) {
    tip.hidden = false;
    tip.classList.add('visible');
  } else {
    tip.hidden = true;
    tip.classList.remove('visible');
  }
}

function updateTooltipPosition(event) {
  const tip = document.getElementById('commit-tooltip');
  if (!tip) return;
  const OFFSET = 12;
  tip.style.left = `${event.clientX + OFFSET}px`;
  tip.style.top = `${event.clientY + OFFSET}px`;
}

// ---------- Scatter plot globals ----------
let xScale;
let yScale;

// ---------- Scatter plot: initial render ----------
function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;

  const margin = { top: 10, right: 10, bottom: 30, left: 40 };
  const usable = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usable.left, usable.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usable.bottom, usable.top]);

  // Gridlines
  svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usable.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usable.width));

  // Axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d).padStart(2, '0') + ':00');

  svg
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${usable.bottom})`)
    .call(xAxis);

  svg
    .append('g')
    .attr('class', 'y-axis')
    .attr('transform', `translate(${usable.left}, 0)`)
    .call(yAxis);

  // Group to hold circles (points)
  svg.append('g').attr('class', 'dots');
}

// ---------- Scatter plot: update based on filtered commits ----------
function updateScatterPlot(data, commits) {
  const svg = d3.select('#chart').select('svg');
  if (svg.empty()) return;

  const dots = svg.select('g.dots');

  if (!commits || commits.length === 0) {
    dots.selectAll('circle').remove();
    return;
  }

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3
    .scaleSqrt()
    .domain([minLines || 0, maxLines || 1])
    .range([3, 30]);

  const sorted = d3.sort(commits, (d) => -d.totalLines);

  dots
    .selectAll('circle')
    .data(sorted, (d) => d.id) // key by commit id for stable transitions
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, d) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(d);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => updateTooltipPosition(event))
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
}

// ---------- Files unit visualization ----------
const colors = d3.scaleOrdinal(d3.schemeTableau10);

function updateFileDisplay(filteredCommits) {
  const lines = filteredCommits.flatMap((d) => d.lines);

  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, linesForFile]) => {
      // choose dominant technology for this file
      const typeCounts = d3.rollup(
        linesForFile,
        (v) => v.length,
        (d) => d.type,
      );
      let dominantType = 'other';
      if (typeCounts && typeCounts.size > 0) {
        dominantType = d3.greatest(typeCounts, (d) => d[1])[0];
      }

      return { name, lines: linesForFile, type: dominantType };
    })
    .sort((a, b) => b.lines.length - a.lines.length);

  const container = d3
    .select('#files')
    .selectAll('div')
    .data(files, (d) => d.name)
    .join((enter) =>
      enter.append('div').call((div) => {
        div.append('dt').append('code');
        div.append('dd');
      }),
    );

  container
    .attr('style', (d) => `--color: ${colors(d.type)}`);

  // filename + number of lines
  container
    .select('dt > code')
    .html((d) => `${d.name}<small>${d.lines.length} lines</small>`);

  // one dot per line
  container
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc');
}

// ---------- Scrollytelling text ----------
function buildScatterStory(commits) {
  d3
    .select('#scatter-story')
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html((d, i) => {
      const when = d.datetime.toLocaleString('en', {
        dateStyle: 'full',
        timeStyle: 'short',
      });

      const linkText =
        i === 0
          ? 'my first commit, and it was glorious'
          : 'another glorious commit';

      const filesTouched = d3.rollups(
        d.lines,
        (D) => D.length,
        (l) => l.file,
      ).length;

      return `
        On ${when}, I made
        <a href="${d.url}" target="_blank" rel="noopener">${linkText}</a>.
        I edited ${d.totalLines} lines across ${filesTouched} files.
        Then I looked over all I had made, and I saw that it was very good.
      `;
    });
}

// ---------- Scrollama setup ----------
function setupScrollytelling(commits, data) {
  const scroller = scrollama();

  function onStepEnter(response) {
    const commit = response.element.__data__;
    const idx = commits.findIndex((d) => d.id === commit.id);

    // All commits up to & including this step (cumulative story)
    const filtered = commits.slice(0, idx + 1);

    updateScatterPlot(data, filtered);
    updateFileDisplay(filtered);
  }

  scroller
    .setup({
      container: '#scrolly-1',
      step: '#scrolly-1 .step',
    })
    .onStepEnter(onStepEnter);
}

// ---------- Run ----------
const data = await loadData();
const commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);
buildScatterStory(commits);

// Initial state: show first commit only
updateScatterPlot(data, commits.slice(0, 1));
updateFileDisplay(commits.slice(0, 1));
setupScrollytelling(commits, data);