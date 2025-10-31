import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Fetch projects JSON
const projects = await fetchJSON('../lib/projects.json');

// Select containers
const projectsContainer = document.querySelector('.projects');
const titleElement = document.querySelector('.projects-title');

// Render initial projects and title
renderProjects(projects, projectsContainer, 'h2');
titleElement.textContent = `${projects.length} Projects`;

// ----------------------
// PIE CHART + LEGEND
// ----------------------
function renderPieChart(projectsGiven) {
  // Clear existing chart + legend
  let newSVG = d3.select('#projects-pie-plot');
  newSVG.selectAll('path').remove();

  let newLegend = d3.select('.legend');
  newLegend.selectAll('*').remove();

  // Roll up data by year
  let newRolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year
  );

  // Format for D3 pie
  let newData = newRolledData.map(([year, count]) => ({
    label: year,
    value: count,
  }));

  // Create pie chart
  let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  let sliceGenerator = d3.pie().value((d) => d.value);
  let arcData = sliceGenerator(newData);
  let arcs = arcData.map((d) => arcGenerator(d));
  let colors = d3.scaleOrdinal(d3.schemeTableau10);

  arcs.forEach((arc, idx) => {
    newSVG
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(idx))
      .attr('stroke', 'white')
      .attr('stroke-width', 1);
  });

  // Create legend
  newData.forEach((d, idx) => {
    newLegend
      .append('li')
      .attr('class', 'legend-item')
      .attr('style', `--color:${colors(idx)}`)
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
  });
}

// Initial pie render
renderPieChart(projects);

// ----------------------
// SEARCH FUNCTIONALITY
// ----------------------
let query = '';
let searchInput = document.querySelector('.searchBar');

searchInput.addEventListener('input', (event) => {
  // Update query
  query = event.target.value.toLowerCase();

  // Filter projects
  let filteredProjects = projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query);
  });

  // Re-render visible projects
  renderProjects(filteredProjects, projectsContainer, 'h2');

  // Update pie + legend based on filtered data
  renderPieChart(filteredProjects);
});