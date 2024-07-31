## Pilot Insight

Pilot Insight evaluates flight data based on FAA regulations. This website allows users to upload a flight file (.kml), and view it visually. The site will segment the flight maneuvers performed during the flight, and display them in different colors. These segments are also scored and the score is visible to the user upon visualization. Users do not have to upload their own flight file, they can also opt to use one of our demo files provided on the site.

----------

### Segmentation Completed
- Takeoff
- Landing
- Turns Around a Point
- Slow Flight
- Touch & Go

----------

## Overview

/docs contains our Landing Page.

/project contains our project.

-----------

## File Specifics

**index.js** runs the Node.js / Express server.

**parseKML.py** computs the backend segmentation and scoring, which is then sent to the Node.js server.

**cesiumScript.js** uses the CesiumJS plugin to display the flight and segmentation visually onto the web server.

------------

## Running Pilot Insight

To run the site, make sure to have **NodeJS** and **Python3** installed on your computer.

Install **NodeJS**: https://nodejs.org/en/download

Then
1. ```cd project```
2. ```pip3 install -r requirements.txt```
3. ```npm install```
4. ```npm start```
5. Go to localhost link in console

---------------

## Branch Details

- **main**: Complete Project
