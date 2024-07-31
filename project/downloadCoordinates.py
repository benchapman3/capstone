import subprocess
import time
import random

# Open the file in read mode
with open('ned10m_coords.txt', 'r') as file:
    # Read the lines from the file and remove trailing whitespaces
    lines = [line.strip() for line in file.readlines()]

# Now 'lines' contains a list of strings from the file
print(lines[0])
import subprocess

def download_with_curl(url, output_directory):
    # Build the curl command
    command = ['curl', '-O', url]

    # Set the output directory
    if output_directory:
        command += ['--create-dirs', '-o', f'{output_directory}/filename.ext']

    try:
        # Execute the command
        subprocess.run(command, check=True)
        print(f"File downloaded successfully to {output_directory}")
    except subprocess.CalledProcessError as e:
        print(f"Failed to download file. Error: {e}")

# Example usage:
# url = 'https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/TIFF/current/n06e162/USGS_13_n06e162.tif'
output_directory = '/'

# download_with_curl(url, output_directory)

# def download_wget(url, output_directory):
#     command = ['wget', url, '-P', output_directory]

#     try:
#     # Execute the command
#         subprocess.run(command, check=True)
#         print(f"File downloaded successfully to {output_directory}")
#     except subprocess.CalledProcessError as e:
#         print(f"Failed to download file. Error: {e}")

# Example usage:

output_directory = ''
for line in lines:
    random_float = random.uniform(1, 5)
    url = 'https://prd-tnm.s3.amazonaws.com/StagedProducts/Elevation/13/TIFF/current/' + line + '/USGS_13_' + line + '.tif'
    download_with_curl(url, output_directory)
    # respectful backoff
    time.sleep(random_float)
    print("sleeping for " + str(random_float * 1000) + "ms")
