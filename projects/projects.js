import { fetchJSON, renderProjects, fetchGithubData } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');

const projectsContainer = document.querySelector('.projects');

renderProjects(projects, projectsContainer, 'h2');

const titleElement = document.querySelector('.projects-title');
titleElement.textContent = `${projects.length} Projects`;