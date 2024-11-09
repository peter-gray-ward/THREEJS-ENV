from flask import Flask, jsonify, send_file, request, make_response
import os
import re
import urllib.parse
import urllib.request
import random
import json
from io import BytesIO
import glob

app = Flask(__name__)

LEVEL = [
    None,
    "Cypress Garden"
]

t = 100

class User:
    def __init__(self, name, level, position):
        self.name = name
        self.level = level
        self.position = position
    def to_dict(self):
        return {
            'name': self.name,
            'level': self.level,
            'position': self.position
        }

IMAGES = os.listdir('./images')

class Model:
    def __init__(self, user):
        center = {'x': 0, 'y': 0, 'z': 0}
        self.art_gallery_photos = self.loadArtMuseum1('./images/art-museum-1')
        self.images = {
            'leaf': [f"/images/{filename}" for filename in IMAGES if re.match(r'^leaf', filename)],
            'ground': [f"/images/{filename}" for filename in IMAGES if re.match(r'^ground', filename)],
            'floor': [f"/images/{filename}" for filename in IMAGES if re.match(r'^floor', filename)],
            'bark': [f"/images/{filename}" for filename in IMAGES if re.match(r'^bark', filename)]
        }
        self.map = {
            user['level']: {
                'center': center,
                'quadrant': t * 5,
                'noiseWidth': t * 2,
                'noiseHeight': t,
                'segments': 50,
                'sop': {
                    'trees': t / 2,
                    'grasses': t / 4,
                    'grounds': t * 2,
                    'cliffs': t
                },
                'grasses': [],
                'grounds': [],
                'structures': [
                    {
                        'name': 'castle',
                        'position': {
                            'foundation': {'x': 0, 'y': 16, 'z': 0},
                            'elevator': {
                                'x': 40 - 1.25,
                                'y': 1.5 + 3,
                                'z': -25 + 1.25,
                                'floor': {
                                    'x': 40 - 1.25,
                                    'y': 1.5 + 0.1,
                                    'z': -25 + 1.25,
                                },
                                'ceiling': {
                                    'x': 40 - 1.25,
                                    'y': 1.5 + 3 - 0.1,
                                    'z': -25 + 1.25,
                                },
                                'shaft': {
                                    'front': [
                                        {
                                            'x': 40 - 1.25,
                                            'y': 1.5 + (15 / 2 * (_ + 1)),
                                            'z': -25 + 2.5 - .1,
                                            'door': {
                                                'x': 40 - 1.25,
                                                'y': (15 / 2 * (_ + 1)) - 1.5 + 1,
                                                'z': -25 + 2.5 - .1,
                                            }
                                        } for _ in range(20)
                                    ],
                                    'right': {
                                        'x': 1.5 + 3,
                                        'y': 1.5 + (15 * 20 / 2),
                                        'z': -25 + 1.25 - 0.1
                                    },
                                    'left': {
                                        'x': 40 - 1.25,
                                        'y': 1.5 + (15 * 20),
                                        'z': -25 + 1.25
                                    }
                                }
                            }
                        },
                        'area': {
                            'foundation': {'width': 20, 'height': 50, 'depth': 20},
                            'floor': {'width': 20, 'height': 3, 'depth': 20},
                            'elevator': {
                                'width': 2.5,
                                'height': 3,
                                'depth': 2.5,
                                'floor': {'width': 2.5, 'height': 0.2, 'depth': 2.5},
                                'shaft': {'right': {'width': 2.5, 'height': (15 * 19 + 3), 'depth': 0.2}}
                            },
                            'wall': {'height': 30}
                        },
                        'floors': 20,
                        'textures': {'foundation': "/images/concrete"}
                    }
                ],
                'trees': [],
                'Grass': [
                    '#33462d', '#435c3a', '#4e5e3e', '#53634c', '#536c46', '#5d6847'
                ],
                'treeCondition': "!inCastle && (Math.random() < 0.31 || (Math.random() < 0.3 && !isNearGrassPatch))",
                'grassPatchPersistence': 0.01,
                'textures': {
                    'barks': [f'/images/trees/bark/bark-{i + 1}.jpg' for i in range(7)],
                    'branches': [f'/images/trees/foliage/branches/tree-branch-{i + 1}.png' for i in range(4)],
                    'foliage': [f'/images/trees/foliage/textures/foliage-{i + 1}.jpg' for i in range(7)]
                },
                'amplitude': 50,
                'persistence': 0.15,
                'altitudeVariance': 20,
                'width': t * 2,
                'height': t * 2,
                'grassBladeDensity': 300
            }
        }
        self.user = user

    def loadArtMuseum1(self, museumPath):
        # List files in the hardcoded directory
        fs_paths = [f'/images/art-museum-1/{filename}/' for filename in os.listdir('./images/art-museum-1')]

        # List files in the provided museumPath directory
        museum_paths = [f'/{museumPath}/{filename}' for filename in os.listdir(museumPath)]

        # Combine both lists and return
        return fs_paths + museum_paths

# Routes
flowers = [
    "Rose", "Tulip", "Daisy", "Sunflower", "Lily", 
    "Orchid", "Daffodil", "Marigold", "Lavender", "Chrysanthemum",
    "Peony", "Hyacinth", "Begonia", "Carnation", "Iris",
    "Poppy", "Gladiolus", "Lilac", "Hibiscus", "Dahlia",
    "Zinnia", "Aster", "Primrose", "Petunia", "Jasmine",
    "Magnolia", "Camellia", "Freesia", "Gardenia", "Azalea",
    "Heather", "Bluebell", "Amaryllis", "Foxglove", "Snapdragon",
    "Anemone", "Buttercup", "Crocus", "Snowdrop", "Violet",
    "Forget-me-not", "Lotus", "Verbena", "Sweet Pea", "Impatiens",
    "Bouvardia", "Bleeding Heart", "Ranunculus", "Yarrow", "Cosmos"
]

cliffs = [
    "cliff texture", "rock texture", "moss rock", "rock moss",
    "rock face", "cliff texture"
]


@app.route('/')
def index():
    return send_file('index.html')

@app.route('/favicon')
def favicon():
    file_path = os.path.join('favicon.ico')
    response = make_response(send_file(file_path))
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/static/lib/<path:filename>')
def custom_static(filename):
    return send_file('static/lib', filename, mimetype='application/javascript')

@app.route('/random-cliff-image', methods=('GET',))
def random_image():
    with open('./art-images.json', 'r') as file:
        arts = json.load(file)
        return random.choice(arts)

@app.route('/search-image/<search_term>', methods=('GET',))
def random_image_endpoint(search_term):
    base_url = "https://pixabay.com/api/"
    api_key = "25483695-93658ed46b8876fc2d6419379"

    # Set up query parameters
    params = {
        "key": api_key,
        "q": search_term,
        "image_type": "photo",
        "pretty": "true"
    }

    # Encode the parameters and create the URL
    url = f"{base_url}?{urllib.parse.urlencode(params)}"

    # Make the request and parse the response
    try:
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode())
            return jsonify({ 'status': 'success', 'data': data })
    except urllib.error.URLError as e:
        print(f"Error: {e.reason}")
        return None

@app.route('/images/<path:subpath>')
def get_image(subpath):
    file_path = os.path.join('images', subpath)
    response = make_response(send_file(file_path))
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '0'
    return response

@app.route('/load/<username>')
def load_user(username):
    user = User(name=username, level=LEVEL[1], position={'x': 0, 'y': 0, 'z': 0})
    model = Model(user.to_dict())
    return jsonify(model.__dict__)

@app.route('/lib/<filename>')
def get_lib(filename):
    file_path = os.path.join('lib', filename)
    return send_file(file_path, mimetype='text/javascript')

@app.route('/src/<filename>')
def get_src(filename):
    file_path = os.path.join('src', filename)
    return send_file(file_path, mimetype='text/javascript')

@app.route('/download-image/<image_type>/<image_description>', methods=('POST',))
def download_image(image_type, image_description):
    body = request.get_json()
    if 'url' in body and body['url']:
        # Count files in the directory matching the image_type prefix
        type_count = len([filename for filename in os.listdir('./images') if re.match(r'^' + re.escape(image_type), filename)])

        # Construct the file path for saving the image
        file_path = f"./images/{image_type}-{type_count}-{image_description}.jpg"  # Adjust the extension if needed

        # Download the image
        try:
            urllib.request.urlretrieve(body['url'], file_path)
            return jsonify({"message": "Image downloaded successfully", "file_path": file_path}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 400
    else:
        return jsonify({"error": "No URL provided"}), 400

@app.route('/models/<name>', methods=('GET',))
def fetch_gltf_model(name):
    # Define the full path to the file
    file_path = os.path.join('models', name)
    
    # Check if the file exists
    if not os.path.exists(file_path):
        print(f'not os.path.exists({file_path})')
        return None
    
    # Serve the file
    try:
        print('sending_file ' + file_path)
        return send_file(file_path, mimetype='application/octet-stream')
    except Exception as e:
        print(f'exception sending file {file_path}: {e}')
        return None



@app.route('/audio/process', methods=('POST',))
def process_audio():
    data = request.json
    
    # Extract props
    file = data.get('file')
    action = data.get('action')
    details = data.get('details', {})

    # Check if required props are present
    if not file or not action:
        return jsonify({"error": "Missing 'file' or 'action' in request body."}), 400

    # Initialize response structure
    result = {"file": file, "action": action, "details": {}}

    # Handle different actions based on props
    if action == "analyze":
        if details.get("frequencies"):
            result["details"]["frequencies"] = analyze_frequencies(file)  # Call a frequency analysis function
        if details.get("metadata"):
            result["details"]["metadata"] = extract_metadata(file)  # Call a metadata extraction function
    
    elif action == "transform":
        if details.get("volume_adjustment"):
            result["details"]["volume"] = adjust_volume(file, details["volume_adjustment"])  # Placeholder
    
    else:
        return jsonify({"error": f"Unknown action '{action}'"}), 400

    # Return the response with analysis results
    return jsonify(result)

# Placeholder functions for audio processing
def analyze_frequencies(file):
    # Your frequency analysis logic here
    return "Frequency analysis results"

def extract_metadata(file):
    # Your metadata extraction logic here
    return "Metadata analysis results"

def adjust_volume(file, level):
    # Your volume adjustment logic here
    return f"Volume adjusted to {level}"



@app.route('/save', methods=('POST',))
def save():
    body = request.get_json()
    if 'position' in body and 'username' in body:
        return jsonify({ 'status': True })
    else:
        return jsonify({ 'status': False })





if __name__ == '__main__':
    port = int(os.getenv("PORT", 8080))  # Fallback to 8080 if PORT is not set
    app.run(host="0.0.0.0", port=port)

