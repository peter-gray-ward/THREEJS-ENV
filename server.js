const express = require('express');
const app = express();
const mysql = require('mysql');
const fs = require('fs');
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'enter123',
  database: 'fun',
  port: 3306 // Default MySQL port
});
const path = require('path');
const dir = (filename) => path.resolve(filename);

app
.use(express.json())
.use(express.urlencoded({ extended: true }))
.get('/', (req, res) => res.sendFile(dir('index.html')))
.get('/three', (req, res) => {
	var fp = path.join(__dirname, 'node_modules/three/build/three.module.js')

	res.sendFile(fp)
})
.get('/image-tags', (req, res) => {
  connection.query(`
    select distinct tag as name, count(tag) as countOf from fun.images 
    group by tag
    order by tag asc`, (err, results) => {
    if (results && results.length) {
      res.jsonp(results)
    }
  })
})
.get('/images', (req, res) => {
  var tag = req.query.tag;
  connection.query(`
    select id
    from fun.images
    where tag is not null and tag = '${tag}'`, (err, results) => {
    if (results && results.length) {
      res.jsonp(results.map(r => r.id))
    }
  })
})
.get('/image', (req, res) => {
  var id = req.query.id;
  if (id) {
    connection.query(`
      select image
      from fun.images
      where id = '${id}'`, (err, results) => {
        res.end(results[0].image)
    })
  }
})
.get('/browse-images', (req, res) => {
  connection.query(
    `SELECT DISTINCT tag AS name, COUNT(tag) AS countOf 
     FROM images 
     GROUP BY tag 
     ORDER BY tag ASC`,
    (err, rTags) => {
      if (err) {
        console.error(err);
        res.status(500).send('Error fetching tags');
        return;
      }

      let tags = {};
      let tagPromises = rTags.map(tag => {
        return new Promise((resolve, reject) => {
          connection.query(
            `SELECT id 
             FROM images 
             WHERE tag IS NOT NULL AND tag = ?`,
            [tag.name],
            (err, ids) => {
              if (err) {
                return reject(err);
              }
              tags[tag.name] = ids.map(id => "/image?id=" + id.id)
             
              resolve();
            }
          );
        });
      });

      Promise.all(tagPromises)
        .then(() => {
          res.send(`
            <html>
              <head>
                <title>Browse Images</title>
              </head>
              <body>
                <h1>Image Tags and IDs</h1>
                <table>
                  ${
                    Object.keys(tags).map(tagName => {
                      return `<tr>
                        <th>${tagName}</th>
                        <td>${tags[tagName].map(src => {
                          return `<img height=100 src="${src}" />`
                        })}</td>
                      </tr>`
                    }).join('')
                  }
                </table>
              </body>
            </html>
          `);
        })
        .catch(err => {
          console.error(err);
          res.status(500).send('Error fetching image IDs');
        });
    }
  );
})
.get('/:filename', (req, res) => res.sendFile(dir(req.params.filename)))
.post('/save', (req, res) => {
  var body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', function() {
    body = JSON.parse(body);
    fs.writeFileSync('./db.json', JSON.stringify(body, null, 2));
  })
})
.get('/load', (req, res) => {
  return fs.readFileSync('./db.json');
})
.listen(8080, () => console.log('http://localhost:4200'));