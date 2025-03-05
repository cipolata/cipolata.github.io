const PATH = ""

function show_image(src) {
    // Create a new image element
    let img = document.createElement("img");
    // Set the source, width, 
    img.src = src;
    // Append the image element
    // to the body of the document
    document.getElementById("gallery")
            .appendChild(img);
}            


fetch('images.json')
    .then(response => response.json()) // Parse JSON
    .then(unshuffled => unshuffled.map(value => ({ value, sort: Math.random() }))
                            .sort((a, b) => a.sort - b.sort)
                            .map(({ value }) => value))
    .then(data =>
        data.map(filename => "images/".concat(filename))
            .forEach(img_path => 
                show_image(PATH.concat(img_path)))
    ) // Work with JSON data
    .catch(error => console.error('Error fetching JSON:', error));

//console.log("Script loaded successfully!");
