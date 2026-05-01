import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

let projects = [];
let query = '';
let selectedYear = null;

const projectsContainer = document.querySelector('.projects');
const projectsCount = document.querySelector('.projects-count');
const searchInput = document.querySelector('.searchBar');
const svg = d3.select('#projects-pie-plot');
const legend = d3.select('.legend');
const colors = d3.scaleOrdinal(d3.schemeTableau10);

function getSearchedProjects() {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return projects;
  }

  return projects.filter((project) => {
    const values = Object.values(project).join('\n').toLowerCase();
    return values.includes(normalizedQuery);
  });
}

function getVisibleProjects() {
  const searchedProjects = getSearchedProjects();

  if (!selectedYear) {
    return searchedProjects;
  }

  return searchedProjects.filter(
    (project) => String(project.year) === selectedYear,
  );
}

function updateProjectCount(visibleProjects) {
  if (projectsCount) {
    projectsCount.textContent = `(${visibleProjects.length})`;
  }
}

function updateSelectionClasses() {
  svg
    .selectAll('path')
    .attr('class', (d) => (d.data.label === selectedYear ? 'selected' : null));

  legend
    .selectAll('li')
    .attr('class', (d) =>
      d.label === selectedYear ? 'legend-item selected' : 'legend-item',
    );
}

function renderPieChart(projectsGiven) {
  const rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => String(d.year),
  );

  const data = rolledData
    .map(([year, count]) => ({ value: count, label: year }))
    .sort((a, b) => d3.ascending(a.label, b.label));

  const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  const sliceGenerator = d3.pie().value((d) => d.value);
  const arcData = sliceGenerator(data);

  svg.selectAll('path').remove();
  legend.selectAll('li').remove();

  if (data.length === 0) {
    legend.append('li').attr('class', 'legend-item').text('No matching years');
    return;
  }

  svg
    .selectAll('path')
    .data(arcData)
    .join('path')
    .attr('d', arcGenerator)
    .attr('fill', (_, idx) => colors(idx))
    .attr('style', (_, idx) => `--color:${colors(idx)}`)
    .on('click', (_, d) => {
      selectedYear = selectedYear === d.data.label ? null : d.data.label;
      applyFiltersAndRender();
    });

  legend
    .selectAll('li')
    .data(data)
    .join('li')
    .attr('style', (_, idx) => `--color:${colors(idx)}`)
    .attr('class', 'legend-item')
    .html((d) => `<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
    .on('click', (_, d) => {
      selectedYear = selectedYear === d.label ? null : d.label;
      applyFiltersAndRender();
    });

  updateSelectionClasses();
}

function applyFiltersAndRender() {
  const searchedProjects = getSearchedProjects();
  const visibleProjects = getVisibleProjects();

  renderProjects(visibleProjects, projectsContainer, 'h2');
  updateProjectCount(visibleProjects);
  renderPieChart(searchedProjects);
}

try {
  projects = await fetchJSON('../lib/projects.json');
  applyFiltersAndRender();

  searchInput?.addEventListener('input', (event) => {
    query = event.target.value;
    applyFiltersAndRender();
  });
} catch (error) {
  console.error('Unable to load projects page data:', error);
}
