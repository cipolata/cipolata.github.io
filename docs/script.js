document.body.style.overflow = "hidden";

fetch('images.json')
    .then(response => response.json()) // Parse JSON
    .then(data => console.log(data)) // Work with JSON data
    .catch(error => console.error('Error fetching JSON:', error));

console.log("Script loaded successfully!");
