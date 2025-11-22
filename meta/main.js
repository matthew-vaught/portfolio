import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import scrollama from "https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm";

// ================= LOAD DATA =================

async function loadData() {
  const data = await d3.csv("loc.csv", (row) => ({
    ...row,
    line: +row.line,
    depth: +row.depth,
    length: +row.length,
    date: new Date(row.date + "T00:00" + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

// ================= PROCESS COMMITS =================

function processCommits(data) {
  const grouped = d3.groups(data, d => d.commit).map(([commit, lines]) => {
    const f = lines[0];

    const ret = {
      id: commit,
      url: `https://github.com/matthew-vaught/portfolio/commit/${commit}`,
      author: f.author,
      datetime: f.datetime,
      hourFrac: f.datetime.getHours() + f.datetime.getMinutes() / 60,
      totalLines: lines.length,
      lines: lines
    };

    return ret;
  });

  return d3.sort(grouped, d => d.datetime);
}

// ================= STATS =================

function renderCommitInfo(data, commits) {
  const dl = d3.select("#stats")
    .append("dl")
    .attr("class", "stats");

  const totalLOC = data.length;
  const totalCommits = commits.length;
  const filesCount = new Set(data.map(d => d.file)).size;
  const maxDepth = d3.max(data, d => d.depth);
  const longestLine = d3.max(data, d => d.length);

  const row = (label, value) => {
    dl.append("dt").html(label);
    dl.append("dd").text(value);
  };

  row("Commits", totalCommits);
  row("Files", filesCount);
  row("LOC", totalLOC);
  row("Max depth", maxDepth);
  row("Longest line", longestLine);
}

// ================= SCATTER PLOT =================

let xScale, yScale;

function renderScatterPlot(commits) {
  const width = 800;
  const height = 500;
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };

  const svg = d3.select("#chart")
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  xScale = d3.scaleTime()
    .domain(d3.extent(commits, d => d.datetime))
    .range([margin.left, width - margin.right]);

  yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([height - margin.bottom, margin.top]);

  const y_axis = d3.axisLeft(yScale).tickFormat(d => `${String(d).padStart(2, "0")}:00`);
  const x_axis = d3.axisBottom(xScale);

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(y_axis);

  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(x_axis);

  svg.append("g").attr("class", "dots");
}

function updateScatterPlot(commits) {
  const svg = d3.select("#chart svg");
  const dots = svg.select("g.dots");

  const rScale = d3.scaleSqrt()
    .domain(d3.extent(commits, d => d.totalLines))
    .range([4, 28]);

  dots.selectAll("circle")
    .data(commits, d => d.id)
    .join("circle")
    .attr("cx", d => xScale(d.datetime))
    .attr("cy", d => yScale(d.hourFrac))
    .attr("r", d => rScale(d.totalLines))
    .attr("fill", "steelblue")
    .attr("opacity", 0.75);
}

// ================= FILE VISUALIZATION =================

const colors = d3.scaleOrdinal(d3.schemeTableau10);

function updateFileDisplay(commits) {
  const lines = commits.flatMap(d => d.lines);

  const files = d3.groups(lines, d => d.file)
    .map(([name, lines]) => ({
      name,
      lines
    }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const container = d3.select("#files")
    .selectAll("div")
    .data(files, d => d.name)
    .join("div");

  container
    .style("--color", (d, i) => colors(i))
    .html("");

  container.append("dt")
    .html(d => `<code>${d.name}</code><small>${d.lines.length} lines</small>`);

  const dots = container.append("dd")
    .selectAll(".loc")
    .data(d => d.lines)
    .join("div")
    .attr("class", "loc");
}

// ================= STORY =================

function buildScatterStory(commits) {
  d3.select("#scatter-story")
    .selectAll(".step")
    .data(commits)
    .join("div")
    .attr("class", "step")
    .html((d, i) => {
      const when = d.datetime.toLocaleString("en", { dateStyle: "full", timeStyle: "short" });
      const linkText = i === 0 ? "my first commit" : "another glorious commit";

      const files = new Set(d.lines.map(l => l.file)).size;

      return `
        On ${when}, I made
        <a href="${d.url}" target="_blank">${linkText}</a>.
        I edited ${d.totalLines} lines across ${files} files.
      `;
    });
}

// ================= SCROLLAMA =================

function setupScrollytelling(commits) {
  const scroller = scrollama();

  function onStepEnter({ element }) {
    const commit = element.__data__;
    const index = commits.findIndex(d => d.id === commit.id);

    d3.selectAll(".step").classed("is-active", false);
    d3.select(element).classed("is-active", true);

    const filtered = commits.slice(0, index + 1);
    updateScatterPlot(filtered);
    updateFileDisplay(filtered);
  }

  scroller.setup({
    step: "#scatter-story .step",
    offset: 0.6
  }).onStepEnter(onStepEnter);

  window.addEventListener("resize", scroller.resize);
}

// ================= RUN =================

const data = await loadData();
const commits = processCommits(data);

renderCommitInfo(data, commits);
renderScatterPlot(commits);
buildScatterStory(commits);

updateScatterPlot(commits.slice(0,1));
updateFileDisplay(commits.slice(0,1));

setupScrollytelling(commits);