import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');

const projectsContainer = document.querySelector('.projects');

renderProjects(projects, projectsContainer, 'h2');

// TEMP for Step 6 console testing
window.projects = projects;
window.renderProjects = renderProjects;
console.log('projects + renderProjects exposed to window');