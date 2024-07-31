// server.js
// where your node app starts

// init project
const express = require('express');
const path = require('path')

const fs = require("fs")

const app = express();

app.use(express.json({ limit: '10mb' }));

// http://expressjs.com/en/starter/static-files.html
app.use(express.static('.'));
app.use('/css', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/css')))
app.use('/js', express.static(path.join(__dirname, 'node_modules/bootstrap/dist/js')))

app.get('/bundle.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'bundle.js'));
});

// http://expressjs.com/en/starter/basic-routing.html
app.get('/', function(request, response) {
  response.sendFile(__dirname + '/index.html');
});

var kml = ""

var list = []

app.post('/sendKML', express.json(), (req, res) => {
  kml = req.body.data; // Access the sent string from the request body
  res.send('KML received successfully'); // Send a response back to the client
});

app.post('/sendVSpeeds', express.json(), (req, res) => {
  list = JSON.parse(req.body.data);
  res.send('VSpeeds received successfully'); // Send a response back to the client
});




async function segment() {
  return new Promise((resolve, reject) => {
    const spawn = require("child_process").spawn;
    const fs = require('fs');

    // console.log(kml)

    fs.writeFileSync('data.txt', kml);
    const pythonProcess = spawn('python3',["parseKML.py", "data.txt", ...list]);

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      resolve(output); // Resolve the promise with the output
    });

    pythonProcess.on('error', (err) => {
      reject(err); // Reject the promise if there's an error
    });
  });
}

app.get('/python', async (req, res) => {
  try {
    const result = await segment(); // Await for segment function
    res.json({ message: result });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

// listen for requests :)
const listener = app.listen(process.env.PORT, function() {
  console.log('Your app is listening on port ' + listener.address().port);
  console.log("http://localhost:" + listener.address().port)
});



app.get('/json', async (req, res) => {
  var tj = require('@mapbox/togeojson'),
      fs = require('fs'),
      // node doesn't have xml parsing or a dom. use xmldom
      DOMParser = require('xmldom').DOMParser;

  var kml2 = new DOMParser().parseFromString(fs.readFileSync(kml, 'utf8'));

  var converted = tj.kml(kml2);

  var convertedWithStyles = tj.kml(kml2, { styles: true });

  res.json({ message: converted });
});



