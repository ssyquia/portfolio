import { fetchJSON, renderProjects } from '../global.js';

try {
  const projects = await fetchJSON('../lib/projects.json');
  const projectsContainer = document.querySelector('.projects');
  renderProjects(projects, projectsContainer, 'h2');

  const projectsCount = document.querySelector('.projects-count');
  if (projectsCount) {
    projectsCount.textContent = `(${projects.length})`;
  }
} catch (error) {
  console.error('Unable to load projects page data:', error);
}
