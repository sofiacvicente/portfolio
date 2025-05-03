function loadSection(id, file) {
    fetch(file)
        .then(response => response.text())
        .then(data => {
            document.getElementById(id).innerHTML = data;
        })
        .catch(error => console.error(`Could not load ${file}:`, error));
}
loadSection('aboutme', 'aboutme.html');
loadSection('projects', 'projects.html');
