import os, sys
import json
from PIL import Image
# Set the directory you want to scan (change this if needed)
DIRECTORY = "./images/"  # Change to your target folder

# Output file name for json
OUTPUT_FILE = "images.json"

# Output folder for scaled images
OUTPUT_FOLDER = "./res/"

# Scaling factor to scale images
QUALITY_FACTOR = 5

def list_files(directory):
    """List all files in the given directory (excluding subdirectories)."""
    files = [f for f in os.listdir(directory) if os.path.isfile(os.path.join(directory, f))]
    return files

def generate_json(directory, output_file):
    """Generate a JSON file listing all files in the directory."""
    data = list_files(directory)

    with open(output_file, "w", encoding="utf-8") as json_file:
        json.dump(data, json_file, indent=4)

    print(f"{output_file} has been created with {len(data)} files.")


def image_scaling(directory, output_folder, quality):
    """Scale all images at directory and save them to output_folder."""
    files = list_files(directory)
    for file in files:
        outfile = file.split('.')[0] + "_compressed.jpg"
        try:
            with Image.open(os.path.join(directory, file)) as im:
                im.save(os.path.join(output_folder, outfile), quality = quality, optimize = True)

        except OSError:
            print("cannot open", file)


if __name__ == "__main__":
    #generate_json(DIRECTORY, OUTPUT_FILE)
    image_scaling(DIRECTORY, OUTPUT_FOLDER, QUALITY_FACTOR)
