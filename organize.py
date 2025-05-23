from json import loads
from csv import writer 
data=loads(open('run2.json').read())
start=data[0]['timestamp']
with open('run2.csv','w',newline='') as f:
    writer=writer(f)
    field=['Time','WeatherTime','PoiTime','PredictTime']
    writer.writerow(field)
    for entry in data:
        writer.writerow([entry['timestamp']-start,entry['weatherTime'],entry['poiTime'],entry['predictTime']])

