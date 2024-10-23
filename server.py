from flask import Flask, jsonify, send_file, request, make_response
import os

app = Flask(__name__)

LEVEL = [
    None,
    "Cypress Garden"
]

t = 200

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

class Model:
    def __init__(self, user):
        center = {'x': 0, 'y': 0, 'z': 0}
        self.map = {
            user['level']: {
                'center': center,
                'quadrant': t,
                'noiseWidth': t * 2,
                'noiseHeight': t,
                'segments': 50,
                'sop': {
                    'trees': t / 2,
                    'grasses': t / 3,
                    'grounds': 0,
                    'cliffs': t / 2
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

# Routes

@app.route('/')
def index():
    return send_file('index.html')

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

if __name__ == '__main__':
    app.run(port=8080)
