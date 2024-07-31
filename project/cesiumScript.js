var viewer; 

import { kml } from "https://unpkg.com/@tmcw/togeojson?module";
// import './node_modules/jquery/dist/jquery.min.js';


var segmentList = document.getElementById("segment-list");
segmentList.style.visibility = "hidden";

var animationInterval

var segmentToAdd = {}

var defaultHTML = `<h2 id="segment-title" style="text-align: center;">Segments</h2>
          <table class="table table-striped table-bordered table-sm" >
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col"><input type="checkbox" class="form-check-input" id = "segment-check-all" checked></th>
                <th scope="col">Segment</th>
                <th scope="col">Start</th>
                <th scope="col">End</th>
                <th scope="col"><button data-toggle="modal" data-target="#scoreModal" style="border: none; padding: 0; background: none; color: blue; text-decoration: underline; cursor: pointer;">Score</button></th>
                <th scope="col">View</th>
              </tr>
            </thead>
            <tbody id="segment-table">
            </tbody>
          </table>`;


const types = {
    "takeoff": "Takeoff",
    "landing": "Landing",
    "airborne": "Airborne",
    "taxi": "Taxi",
    "slow_flight": "Slow Flight",
    "debug": "Debug",
    "point_turn": "Turn Around a Point",
    "s_turn": "S Turn",
    "touch&go": "Touch and Go",
}

var listV = {
    "Vs0": 41,
    "Vs1": 48,
    "Vx": 62,
    "Vy": 74,
    "Vsw": 50,
    "Vref": 65,
    "Vne": 160,
    "Vmxt": 20,
};

async function loadCesium(){

    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJhNGM4YmQ4NS0xY2I4LTRlODQtOTk4Ny1iMmM2OWM4ZmU1YTkiLCJpZCI6MTY4MTQ1LCJpYXQiOjE2OTU1MDE5NDB9.Uq4MCNulR_JhkJJm90buFQ_gO55GEPcpHzUm_mTxUAw';
    viewer = new Cesium.Viewer('cesiumContainer', {});
    viewer.canvas.width = 3000;
    viewer.canvas.margin = 5000
    viewer.canvas.height = 1000;
    
    if("currentFlight" in localStorage){
        var flight = localStorage.getItem("currentFlight")
        cesiumPlane(JSON.parse(flight))
        for (const [key, value] of Object.entries(listV)) {
            document.getElementById(key).value = localStorage.getItem(key) || value;
        }
    }  else {
        $(window).on('load', function() {
            $('#uploadModal').modal('show');
            
        });
    }

    function cesiumPlane(flightData){
        const timeStepInSeconds = 30;
        const totalSeconds = timeStepInSeconds * (flightData.length - 1);

        // fix starting time. 
        const start = Cesium.JulianDate.fromIso8601("2020-03-09T23:10:00Z");
        const stop = Cesium.JulianDate.addSeconds(start, totalSeconds, new Cesium.JulianDate());
        viewer.clock.startTime = start.clone();
        viewer.clock.stopTime = stop.clone();
        viewer.clock.currentTime = start.clone();
        viewer.timeline.zoomTo(start, stop);
        // Speed up the playback speed 50x.
        viewer.clock.multiplier = 50;
        // Start playing the scene.
        viewer.clock.shouldAnimate = true;
        
        const positionProperty = new Cesium.SampledPositionProperty();

        var positions = [];

        for (let i = 0; i < flightData.length; i++) {
            const dataPoint = flightData[i]
            if (dataPoint[2] < 0){
                dataPoint[2] = 0
            }
        }

        flightData = shiftColumnToMinZero(flightData, 2)
        for (let i = 0; i < flightData.length; i++) {
            const dataPoint = flightData[i]
            const time = Cesium.JulianDate.addSeconds(start, i * timeStepInSeconds, new Cesium.JulianDate());
            const position = Cesium.Cartesian3.fromDegrees(dataPoint[0], dataPoint[1], dataPoint[2]);
            positionProperty.addSample(time, position);
            positions.push(position)
        }

        function shiftColumnToMinZero(matrix, columnIndex) {
            const column = matrix.map(row => row[columnIndex]);
            var minValue = Math.min(...column);
            const shiftedColumn = column.map(element => element - minValue);
            const shiftedMatrix = matrix.map((row, rowIndex) => {
                const newRow = [...row];
                newRow[columnIndex] = shiftedColumn[rowIndex];
                return newRow;
            });
            return shiftedMatrix;
        }
        // instead of positions, do it so that for every segment, do their positions, and their respective color. 
        //for segment in segmnets..
        var segments
        var segmentPolylines = []
        fetch('/python')
        .then(response => response.json())
        .then(data => {
            // console.log("Received ")
            // console.log(data.message); // This will log the message from the server
            segments = JSON.parse(data.message)

            if (segmentToAdd.start != undefined && segmentToAdd.start < segmentToAdd.end){ 
                segments.push(segmentToAdd)
            }

            console.log(segments)

            // for each segment, use their starting and ending point in order to 
            // write down their starting and ending times in flight

            for (let i = 0; i < segments.length; i++) {
                // console.log("segment: " + segments[i].start + " " + segments[i].end + " status: " + segments[i].status)
                
                const startTime = segments[i].start;
                const formattedStartTime = formatTime(startTime);
                segments[i]["startTime"] = formattedStartTime;

                const endTime = segments[i].end;
                const formattedEndTime = formatTime(endTime);
                segments[i]["endTime"] = formattedEndTime;

                function formatTime(seconds) {
                    const hours = Math.floor(seconds / 3600);
                    const minutes = Math.floor((seconds % 3600) / 60);
                    const remainingSeconds = seconds % 60;
                    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
                }

                
                var color;
                switch (segments[i].status) {
                    case "takeoff":
                        color = Cesium.Color.RED
                        break;
                    case "landing":
                        color = Cesium.Color.GREEN
                        break;
                    case "airborne":
                        color = Cesium.Color.BLUE
                        break;
                    case "taxi":
                        color = Cesium.Color.ORANGE
                        break;
                    case "slow_flight":
                        color = Cesium.Color.YELLOW
                        break;
                    case "debug":
                        color = Cesium.Color.CYAN
                        break;
                    case "point_turn":
                        color = Cesium.Color.BLUEVIOLET
                        break;
                    case "touch&go":
                        color = Cesium.Color.HOTPINK
                        break;
                }
                var wallColor = Cesium.Color.fromAlpha(color,0.3)
                var polyline = viewer.entities.add({
                    polyline: 
                    {
                        positions: positions.slice(segments[i].start,segments[i].end + 1),
                        width: 3,
                        material: color
                    },
                    wall: {
                        positions: positions.slice(segments[i].start,segments[i].end + 1),
                        material: wallColor
                    }
                })
                segmentPolylines.push([polyline, color])

                var tableSegments = document.getElementById("segment-table");
                const tr = document.createElement('tr');

                const number = document.createElement('td');
                number.textContent = i + 1;
                number.style.fontWeight = "bold";

                const name = document.createElement('td');
                name.textContent = types[segments[i].status];

                const start = document.createElement('td');
                start.textContent = segments[i].startTime;

                const end = document.createElement('td');
                end.textContent = segments[i].endTime;

                const score = document.createElement('td');
                score.textContent = segments[i].score == "NA" ? "" : "" + segments[i].score + "%";
                const checkBoxHolder = document.createElement('td');
                const checkBox = document.createElement('input');
                checkBox.type = "checkbox";
                checkBox.id = 'segmentCheckBox' + i;
                checkBox.className = 'segmentCheckBox form-check-input';
                checkBox.checked = true;

                checkBox.addEventListener('change', () => {
                    var polyline = segmentPolylines[i][0]
                    var color = segmentPolylines[i][1]
                    if (checkBox.checked){
                        polyline.polyline.material = color
                        polyline.wall.material = Cesium.Color.fromAlpha(color,0.3)
                    } else {
                        polyline.polyline.material = Cesium.Color.fromAlpha(color,0)
                        polyline.wall.material = Cesium.Color.fromAlpha(color,0)
                    }
                });

                checkBoxHolder.appendChild(checkBox);

                const flyButtonHolder = document.createElement('td');
                const button = document.createElement('button');
                button.textContent = "Fly";
                button.id = 'segmentButton' + i;
                button.className = 'segmentButton';
                button.addEventListener('click', () => {
                    viewer.flyTo(segmentPolylines[i])
                    document.getElementById("cesiumContainer").scrollIntoView({behavior: "smooth", block: "center", inline: "center"});
                });



                // on button, turns on all checkboxes, off button turns off all checkboxes.
                segmentList.style.visibility = "visible";
                flyButtonHolder.appendChild(button);
                tr.appendChild(number);
                tr.appendChild(checkBoxHolder);
                tr.appendChild(name);
                tr.appendChild(start);
                tr.appendChild(end);
                tr.appendChild(score);
                tr.appendChild(flyButtonHolder);
                tableSegments.appendChild(tr);
                document.getElementById("segment-check-all").addEventListener('click', () => {
                    if (document.getElementById('segment-check-all').checked){
                        for (let i = 0; i < segments.length; i++) {
                            if (!document.getElementById('segmentCheckBox' + i).checked){
                                document.getElementById('segmentCheckBox' + i).click();
                            }
                        }
                    } else {
                        for (let i = 0; i < segments.length; i++) {
                            if (document.getElementById('segmentCheckBox' + i).checked){
                                document.getElementById('segmentCheckBox' + i).click();
                            }
                        }
                    }
                })
                
            }
            loadModel();
            // hide the modal. 
            $('#uploadModal').modal('hide');
            document.getElementById("progress-bar").style.width = "100%";
            clearInterval(animationInterval);
            var debugModalButton = document.getElementById("debugModalBtn");
            debugModalButton.style.visibility = "visible";
        })
        .catch(error => {
            console.error('Error:', error);
        });
        
    async function loadModel() {
        // Load the glTF model from Cesium ion.
        const airplaneUri = await Cesium.IonResource.fromAssetId(2328472);
        const airplaneEntity = viewer.entities.add({
            availability: new Cesium.TimeIntervalCollection([ new Cesium.TimeInterval({ start: start, stop: stop }) ]),
            position: positionProperty,
            // Attach the 3D model instead of the green point.
            model: { uri: airplaneUri },
            // Automatically compute the orientation from the position.
            orientation: new Cesium.VelocityOrientationProperty(positionProperty),    
            path: new Cesium.PathGraphics({ width: 0 })
        });
        viewer.trackedEntity = airplaneEntity;
    }
    };

}

loadCesium();


function reload(){
    segmentList.innerHTML = defaultHTML
    segmentList.style.visibility = "hidden";
    viewer.entities.removeAll()
    viewer.destroy()
    var reader = new FileReader()
    reader.readAsText(document.getElementById("input").files[0])
    reader.onload = (event)=>{
        var json = kml(new DOMParser().parseFromString(event.target.result, "text/xml"));
        var coordinates  = json.features[0].geometry.coordinates; 
        localStorage.clear();
        localStorage.setItem("currentFlight", JSON.stringify(coordinates))
        // document.getElementById('load').style.visibility="visible";
        var progressBar = document.getElementById("progress-bar");
        var width = 0;
        animationInterval = setInterval(increaseWidth, 50);

        function increaseWidth() {
        if (width >= 100) {
            clearInterval(animationInterval);
        } else {
            width++;
            progressBar.style.width = width + "%";
        }
        }
        fetch('/sendKML', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ data: event.target.result }) 
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('Network response was not ok.');
        })
        .then(data => {
            console.log('Server response:', data);
        })
        .catch(error => {
            console.error('Error:', error);
        });


        // make a list of speeds to send, if they are stored in local storage, then use that, otherwise use the default. 
        var sendSpeeds = []
        for (const [key, value] of Object.entries(listV)) {
            sendSpeeds.push(localStorage.getItem(key) || value)
        }

        fetch('/sendVSpeeds', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ data: JSON.stringify(sendSpeeds)}) 
        })

        loadCesium()
    }
}

var element = document.getElementById("input");
element.addEventListener("change",() => {
    var btn = document.getElementById("visualizeBtn");
    btn.disabled = false;
},false)

// when visualize is clicked store the variables in the code. 
// store them in local storage as well. 




var importFlightButton = document.getElementById("modalButton");

// when we click import flight, reset the progress bar. 
importFlightButton.addEventListener("click", function() {
    var progressBar = document.getElementById("progress-bar");
    progressBar.style.width = "0";
});

// reset button changes the values to the default values.
var resetButton = document.getElementById("vSpeedResetBtn");
resetButton.addEventListener("click", function() {
    for (const [key, value] of Object.entries(listV)) {
        document.getElementById(key).value = value;
    }
});

// on load, reset the values. 


// when we hit visualize, we store all the values into the localStorage. 
var button = document.getElementById("visualizeBtn");
button.addEventListener("click", function () {
    for (const [key, value] of Object.entries(listV)) {
        let value = document.getElementById(key).value;
        localStorage.setItem(key, value);
    }
    reload();
});



var debugButton = document.getElementById("debugBtn");

debugButton.addEventListener("click", function() {

    var debugStart = document.getElementById("debugStart").value;
    var debugEnd = document.getElementById("debugEnd").value;

    // console.log("debugStart: " + debugStart);

    segmentToAdd = {
        start: parseInt(debugStart),
        end: parseInt(debugEnd),
        status: "debug",
        score: "NA"
    }

    segmentList.innerHTML = defaultHTML
    segmentList.style.visibility = "hidden";
    viewer.entities.removeAll()
    viewer.destroy()
    loadCesium()
    
});


// if no button is selected, then the button is disabled.
// on button press, make that track selected, by its name, and upload that file to localstroage


function buttonSelect(id) {
    segmentList.innerHTML = `<h2 id="segment-title" style="text-align: center;">Segments</h2>
        <table class="table table-striped table-bordered table-sm" >
        <thead>
            <tr>
            <th scope="col">#</th>
            <th scope="col"><input type="checkbox" class="form-check-input" id = "segment-check-all" checked></th>
            <th scope="col">Segment</th>
            <th scope="col">Start</th>
            <th scope="col">End</th>
            <th scope="col"><button data-toggle="modal" data-target="#scoreModal" style="border: none; padding: 0; background: none; color: blue; text-decoration: underline; cursor: pointer;">Score</button></th>
            <th scope="col">View</th>
            </tr>
        </thead>
        <tbody id="segment-table">
        </tbody>
        </table>`;
    segmentList.style.visibility = "hidden";
    viewer.entities.removeAll()
    viewer.destroy()

    var oFrame = document.getElementById("iframe" + id);
    var strRawContents = oFrame.contentWindow.document.body.childNodes[0].innerHTML;
    var decodedContents = strRawContents.replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    var json = kml(new DOMParser().parseFromString(decodedContents, "text/xml"));
    var coordinates  = json.features[0].geometry.coordinates; 
    localStorage.clear();
    localStorage.setItem("currentFlight", JSON.stringify(coordinates))
    var progressBar = document.getElementById("progress-bar");
    var width = 0;
    animationInterval = setInterval(increaseWidth, 50);

    function increaseWidth() {
    if (width >= 100) {
        clearInterval(animationInterval);
    } else {
        width++;
        progressBar.style.width = width + "%";
    }
    }
    fetch('/sendKML', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ data: decodedContents }) 
    })
    .then(response => {
        if (response.ok) {
            return response.json();
        }
        throw new Error('Network response was not ok.');
    })
    .then(data => {
        console.log('Server response:', data);
    })
    .catch(error => {
        console.error('Error:', error);
    });

    // make a list of speeds to send, if they are stored in local storage, then use that, otherwise use the default. 
    var sendSpeeds = []
    for (const [key, value] of Object.entries(listV)) {
        sendSpeeds.push(localStorage.getItem(key) || value)
    }

    fetch('/sendVSpeeds', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ data: JSON.stringify(sendSpeeds)}) 
    })

    loadCesium()



}


button = document.getElementById("demo1");
button.addEventListener("click", function() {
    buttonSelect("demo1")
});

button = document.getElementById("demo2");
button.addEventListener("click", function() {
    buttonSelect("demo2")
});

button = document.getElementById("demo3");
button.addEventListener("click", function() {
    buttonSelect("demo3")
});




// on visualize, click reload


