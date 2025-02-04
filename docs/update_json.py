import os
import json

# Set the directory you want to scan (change this if needed)
DIRECTORY = "./images/"  # Change to your target folder

# Output file name
OUTPUT_FILE = "images.json"

def list_files(directory):
    """List all files in the given directory (excluding subdirectories)."""
    files = [f for f in os.listdir(directory) if os.path.isfile(os.path.join(directory, f))]
    return files

def generate_json(directory, output_file):
    """Generate a JSON file listing all files in the directory."""
    files = list_files(directory)
    data = {"files": files}

    with open(output_file, "w", encoding="utf-8") as json_file:
        json.dump(data, json_file, indent=4)

    print(f"✅ {output_file} has been created with {len(files)} files.")

if __name__ == "__main__":
    generate_json(DIRECTORY, OUTPUT_FILE)
