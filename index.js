import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

try {
  const projects = await fetchJSON('./lib/projects.json');
  const latestProjects = projects.slice(0, 3);
  const projectsContainer = document.querySelector('.projects');
  renderProjects(latestProjects, projectsContainer, 'h2');
} catch (error) {
  console.error('Unable to load latest projects:', error);
}

try {
  const githubData = await fetchGitHubData('ssyquia');
  const profileStats = document.querySelector('#profile-stats');

  if (profileStats) {
    profileStats.innerHTML = `
      <dl>
        <dt>Public Repos</dt><dd>${githubData.public_repos}</dd>
        <dt>Public Gists</dt><dd>${githubData.public_gists}</dd>
        <dt>Followers</dt><dd>${githubData.followers}</dd>
        <dt>Following</dt><dd>${githubData.following}</dd>
      </dl>
    `;
  }
} catch (error) {
  console.error('Unable to load GitHub profile stats:', error);
}
