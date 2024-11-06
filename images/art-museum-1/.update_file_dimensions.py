import os
from PIL import Image

def append_dimensions_to_filenames(directory):
    for filename in os.listdir(directory):
        file_path = os.path.join(directory, filename)
        if not os.path.isfile(file_path) or not filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.bmp')):
            continue
        
        # Get image dimensions
        with Image.open(file_path) as img:
            width, height = img.size

        # Construct new filename with dimensions appended
        name, ext = os.path.splitext(filename)
        new_filename = f"{name}_{width}x{height}{ext}"
        new_file_path = os.path.join(directory, new_filename)

        # Rename the file
        os.rename(file_path, new_file_path)
        print(f"Renamed '{filename}' to '{new_filename}'")

# Example usage
directory = '.'  # Replace with your directory
append_dimensions_to_filenames(directory)

