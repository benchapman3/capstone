from pykml import parser
import pandas as pd
import numpy as np
import requests
import json
import math

import sys

Vso = 41

def main(kmlData):

    # Data Preprocessing 

    # Parse the KML file
    with open(kmlData, 'r') as kml_file:
        kml_doc = parser.parse(kml_file).getroot()
    altitudeMode = kml_doc.Document.Placemark.getchildren()[2].getchildren()[0]

    attributes = kml_doc.findall(
        ".//{http://www.google.com/kml/ext/2.2}SimpleArrayData")

    times = list(kml_doc.getchildren()[0].Placemark.getchildren()[2].findall(
        ".//{http://www.opengis.net/kml/2.2}when"))
    coords = list(kml_doc.getchildren()[0].Placemark.getchildren()[2].findall(
        ".//{http://www.google.com/kml/ext/2.2}coord"))
    acc_horiz = []
    acc_vert = []
    course = []
    speed_kts = []
    altitude = []
    bank = []
    pitch = []
    for param in attributes:
        if param.get("name") == 'acc_horiz':
            for attr in param.getchildren():
                acc_horiz.append(attr.text)
        elif param.get("name") == 'acc_vert':
            for attr in param.getchildren():
                acc_vert.append(attr.text)
        elif param.get("name") == 'course':
            for attr in param.getchildren():
                course.append(attr.text)
        elif param.get("name") == 'speed_kts':
            for attr in param.getchildren():
                speed_kts.append(attr.text)
        elif param.get("name") == 'altitude':
            for attr in param.getchildren():
                altitude.append(attr.text)
        elif param.get("name") == 'bank':
            for attr in param.getchildren():
                bank.append(attr.text)
        elif param.get("name") == 'pitch':
            for attr in param.getchildren():
                pitch.append(attr.text)

    times = [str(t) for t in times]
    coords = [str(c) for c in coords]

    data = [times, coords, bank, pitch, altitude, speed_kts, course, acc_horiz, acc_vert]

    # Transpose the array using the zip() function
    data = [list(x) for x in zip(*data)]

    data = pd.DataFrame(data, columns =  ['times', 'coords', 'bank', 'pitch', 'altitude', 'speed_kts', 'course', 'acc_horiz', 'acc_vert'])

    data[['longitude', 'latitude', 'height']] = data['coords'].str.split(' ', expand=True)

    data.drop('coords', axis=1, inplace=True)

    data['timestamp'] = data['times']
    data['bank'] = data['bank'].astype(float)
    data['pitch'] = data['pitch'].astype(float)
    data['altitude'] = data['altitude'].astype(float)
    data['speed_kts'] = data['speed_kts'].astype(float)
    data['course'] = data['course'].astype(float)
    data['latitude'] = data['latitude'].astype(float)
    data['longitude'] = data['longitude'].astype(float)
    data['height'] = data['height'].astype(float)
    data['acc_horiz'] = data['acc_horiz'].astype(int)
    data['acc_vert'] = data['acc_vert'].astype(int)
    data.set_index('timestamp', inplace=True)

    # Takeoff and Landing segmentation.
    # We check the height is below 25 and the speed 
    # is either increasing or decreasing.
    # Two while loops that check for landing and takeoff.
    
    takeoffs = 0
    landings = 0
    segments = []
    start = 0
    end = 0
    takeoffs = 0
    landings = 0
    i = 0
    while i < len(data):
        if (data['height'][i] > 500):
            i += 60
            continue
        if (data['height'][i] < 25):
            if i+15 >= len(data):
                end = data['speed_kts'][len(data)-1]
            else:
                end = data['speed_kts'][i+15]
            start = data['speed_kts'][i]
            if data['height'][i] < 25:
                if end - start > 25 and start < 25 and 50 < end < 100:
                    segments.append({"start":i, "end": i + 15,   "status": "takeoff", "score" : "NA"})
                    takeoffs += 1
                    i += 15
                    continue
        i += 5
    i = 0
    while i < len(data):
        if (data['height'][i] > 500):
            i += 60
            continue
        if (data['height'][i] < 25):
            if i+20 >= len(data):
                end = data['speed_kts'][len(data)-1]
            else:
                end = data['speed_kts'][i+20]
            start = data['speed_kts'][i]

            if (start - end > 15 and start < 100 and end < 25 ):
                segments.append({"start":i, "end": i + 15,   "status": "landing" ,"score" : "NA"})
                landings += 1
                i += 60
                continue
        i += 5

    # sort segments by starting point. 
    segments.sort(key=lambda x: x["start"])

    # Segmenting taxi and airborne maneuvers by when the takeoff begins,
    # and when the landing ends and vis versa.
    startPoint = 0
    i = 0
    while i < len(segments):
        # just tookoff, last segment was taxi
        if segments[i]["status"] == "takeoff":
            segments.insert(i, {"start":startPoint, "end": segments[i]["start"],   "status": "taxi", "score" : "NA"})
            # Drop the rows between the start and end indexes from the original DataFrame
            startPoint = segments[i + 1]["end"]
        # just landed, last segment was airborne
        elif segments[i]["status"] == "landing":
            segments.insert(i, {"start":startPoint, "end": segments[i]["start"],   "status": "airborne", "score" : "NA"})
            startPoint = segments[i + 1]["end"]
        i += 2

    if len(segments) != 0:
        segments.append({"start":segments[-1]["end"], "end":len(data),   "status": "taxi", "score" : "NA"})
    else:
        segments.append({"start":0, "end":len(data),   "status": "airborne", "score" : "NA"})

    # calculate score for segments that are out of bounds.
    def calculateScore (diff):
        score = 100 * np.exp(-0.12 * diff)
        return score
    
    # SCORING for Takeoff and Landing
    # Find the difference from the average course and the current course.

    for i in range(0, len(segments), 1):
            score = 100
            if segments[i]['status'] in ("takeoff", "landing"):
                    avg = sum(data["course"][segments[i]["start"]:segments[i]["end"]])/(segments[i]["end"]-segments[i]["start"])
                    for j in range(segments[i]['start'], segments[i]['end'], 1):
                            course = data['course'][j]
                            curScore = calculateScore(abs(course - avg))
                            score = (score + curScore) / 2
                    segments[i]['score'] = str(round(score,1))

    # -------------------------------------------------------------------------------------- END
    
    # --- SLOW FLIGHT ---

    start = -1
    last = -1
    slow_flight_segments = []
    for i in range(0, len(data), 50):
        difference = abs(data["altitude"][i])
        ground_speed = data['speed_kts'][i]
        slow_flt = Vso + 10
        near_stall_speed = abs(ground_speed - slow_flt)

        # if we have been long enough since our last data point, end the segment. 
        if (i - last > 100 or i >= len(data) - 100) and start != -1:
            slow_flight_segments.append([start, last])
            start = -1

        if difference >= 1500 and near_stall_speed <= 10:
            if start == -1:
                start = i
            last = i

    for slow_segment in slow_flight_segments:
        # get index of splice, put it in at the end. 
        index = -1
        for i in range(len(segments)):
            if segments[i]['end'] >= slow_segment[0]:
                index = i
                break
            else:
                continue

        if index != -1:
            # if the overall segment is greater than ours, then we need to split it.
            if segments[index]['end'] > slow_segment[1]:
                segments.insert(index + 1, {"start":slow_segment[1], "end":segments[index]["end"], "status": segments[index]["status"], "score" : "NA"})
            else:
                segments[index + 1]["start"] = slow_segment[1]

            segments[index]['end'] = slow_segment[0]
            segments.insert(index + 1, {"start":slow_segment[0], "end":slow_segment[1], "status": "slow_flight"})
            index = -1

    # SCORING Slow Flight

    def calculate_slow_flight_score(speeds):
        target_speed = 51
        max_speed_deviation = 20
        penalty = 0.1

        total_penalty = 0
        num_points = len(speeds)

        for speed in speeds:
            speed_deviation = abs(speed - target_speed)
            if speed_deviation > max_speed_deviation:
                total_penalty += (speed_deviation - max_speed_deviation) * penalty

        max_possible_penalty = (max_speed_deviation * num_points ) * penalty
        score = max(0, 100 - (total_penalty / (max_possible_penalty + 1)) * 100)
        return score

    for segment in segments:
        if segment['status'] == "slow_flight":
            speeds = data['speed_kts'][segment['start']:segment['end']]
            score = calculate_slow_flight_score(speeds)
            segment['score'] = str(round(score,1))

    # ----------------------------------------------------------------------------------------- END


    # --- TOUCH AND GO ---
            
    def touch_and_go (start, end):
        if ((data["height"][start] > 30) and (data["height"][end] > 30) and (data["height"][(end-start)//2+start] < 25)):
            return 1
        
    touch_and_go_segments = []
    i = 0
    while i < len(data):
        if (i < len(data)-40):
            if (touch_and_go(i, i+40)):
                touch_and_go_segments.append([i, i + 40])
                i += 40
                continue

        i += 1
    i = 0

    # SCORING Touch and Go

    for i in range(0, len(touch_and_go_segments), 1):
        score = 100
        avg = sum(data["course"][touch_and_go_segments[i][0]:touch_and_go_segments[i][1]])/(touch_and_go_segments[i][1]-touch_and_go_segments[i][0])
        for j in range(touch_and_go_segments[i][0], touch_and_go_segments[i][1], 1):
                course = data['course'][j]
                curScore = calculateScore(abs(course - avg))
                score = (score + curScore) / 2
        touch_and_go_segments[i].append(str(round(score,1)))

    for seg in touch_and_go_segments:
        index = -1
        for i in range(len(segments)):
            if segments[i]['end'] >= seg[0]:
                index = i
                break
            else:
                continue

        if index != -1:
            # if the overall segment is greater than ours, then we need to split it.
            if segments[index]['end'] > seg[1]:
                segments.insert(index + 1, {"start":seg[1], "end":segments[index]["end"], "status": segments[index]["status"], "score" : seg[2]})
            else:
                segments[index + 1]["start"] = seg[1]

            segments[index]['end'] = seg[0]
            segments.insert(index + 1, {"start":seg[0], "end":seg[1], "status": "touch&go", "score": seg[2]})
            index = -1
            
    # -------------------------------------------------------------------------------------------- END
            
    
    def score_point_turn(data, start, end):
        mean_speed = 0
        mean_alt = 0
        for i in range(start, end, 1):
            mean_speed += data['speed_kts'][i]
            mean_alt += data['altitude'][i]
        mean_alt /= (end - start)
        mean_speed /= (end - start)
        speed_stdev = 0
        alt_stdev = 0
        for i in range(start, end, 1):
            add_speed = ((data['speed_kts'][i] - mean_speed) ** 2)
            add_alt = ((data['altitude'][i] - mean_alt) ** 2)
            speed_stdev += add_speed
            alt_stdev += add_alt
        speed_stdev /= (end - start)
        alt_stdev /= (end - start)
        alt_stdev = math.sqrt(alt_stdev)
        speed_stdev = math.sqrt(speed_stdev)
            # Assuming lower deviation values are better
        altitude_score = (100 - alt_stdev / 4)
        speed_score = (100 - speed_stdev * 2)
    
    # If either score is negative, set it to zero
        altitude_score = max(altitude_score, 0)
        speed_score = max(speed_score, 0)
    
        average_score = (altitude_score + speed_score) / 2
        return average_score



# --- POINT TURNS ---
    count = 0 
    last = 0
    increasing = True
    start = 0

    turn_segments = []

    for i in range(5,len(data) - 5, 5):
        if data['altitude'][i] > 800 and data['altitude'][i] < 1000:

            change = float(data['course'][i]) - float(data['course'][last])

            # check if the change is greater than 180
            # if it is, then we need to change the sign of the change
            if abs(change) > 180:
                change = (360 - abs(change)) * np.sign(change) * -1
            if change > 0:
                if increasing == False:
                    count = 0
                    increasing = True
                    start = i
                    # start = last
                count += 1
            else:
                if increasing == True:
                    count = 0
                    increasing = False
                    start = i
                count += 1
            if count >= 20:
                if abs(data["longitude"][i] - data["longitude"][start]) < 0.01 and abs(data["latitude"][i] - data["latitude"][start]) < 0.01:
                    turn_segments.append([start, i])
                count = 0
                start = i
            last = i


    for turn_segment in turn_segments:
        # get index of splice, put it in at the end. 
        index = -1
        for i in range(len(segments)):
            if segments[i]['end'] >= turn_segment[0]:
                index = i
                break
            else:
                continue

        if index != -1:
            # if the overall segment is greater than ours, then we need to split it.
            if segments[index]['end'] > turn_segment[1]:
                segments.insert(index + 1, {"start":turn_segment[1], "end":segments[index]["end"], "status": segments[index]["status"], "score" : "NA"})
            else:
                segments[index + 1]["start"] = turn_segment[1]

            segments[index]['end'] = turn_segment[0]

            segments.insert(index + 1, {"start":turn_segment[0], "end":turn_segment[1], "status": "point_turn", "score": round(score_point_turn(data, turn_segment[0], turn_segment[1]),1)
} )
            score
            index = -1

    # --- POINT TURNS DONE ---

    print(json.dumps(segments))
    sys.stdout.flush()


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) == 0:
        print("No file specified")
        exit()
    elif len(args) > 1:
        Vso = int(args[1])
    else:
        Vso = 41
    main(args[0])