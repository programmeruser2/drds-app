import {
  Text,
  SafeAreaView,
  StyleSheet,
  Button,
  TextInput,
} from 'react-native';
import { useState } from 'react';
// You can import supported modules from npm
import { Card } from 'react-native-paper';

// or any files within the Snack
import AssetExample from './components/AssetExample';

import RiskIndicator from './components/RiskIndicator';
import * as Location from 'expo-location';
import { fetchWeatherApi } from 'openmeteo';
import { getCalendars } from 'expo-localization';
import * as FileSystem from 'expo-file-system';
import { InferenceSession, Tensor } from "onnxruntime-react-native";
const { timeZone } = getCalendars()[0];
//if ()
let modelDownloaded=null;
let inferenceSession=null;
let log = [];
let currBlock = {};
async function getWeather(lat, long) {
  const start = performance.now();
  //console.log(timeZone, lat, long);
  //console.log('ok',getCalendars()[0]);
  const params = {
    latitude: lat,
    longitude: long,
    current: [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'precipitation',
      'weather_code',
      'pressure_msl',
      'wind_speed_10m',
    ],
    minutely_15: ['precipitation', 'visibility'],
    temperature_unit: 'fahrenheit',
    wind_speed_unit: 'mph',
    precipitation_unit: 'inch',
    timeformat: 'unixtime',
    timezone: timeZone,
    past_minutely_15: 0,
    forecast_minutely_15: 1,
  };
  const url = 'https://api.open-meteo.com/v1/forecast';
  const responses = await fetchWeatherApi(url, params);

  // Helper function to form time ranges
  const range = (start: number, stop: number, step: number) =>
    Array.from({ length: (stop - start) / step }, (_, i) => start + i * step);

  // Process first location. Add a for-loop for multiple locations or weather models
  const response = responses[0];

  // Attributes for timezone and location
  const utcOffsetSeconds = response.utcOffsetSeconds();
  const timezone = response.timezone();
  const timezoneAbbreviation = response.timezoneAbbreviation();
  const latitude = response.latitude();
  const longitude = response.longitude();

  const current = response.current();
  const minutely15 = response.minutely15();

  // Note: The order of weather variables in the URL query and the indices below need to match!
  let weatherData = {
    current: {
      time: new Date((Number(current.time()) + utcOffsetSeconds) * 1000),
      temperature2m: current.variables(0).value(),
      relativeHumidity2m: current.variables(1).value(),
      apparentTemperature: current.variables(2).value(),
      isDay: current.variables(3).value(),
      precipitation: current.variables(4).value(),
      weatherCode: current.variables(5).value(),
      pressureMsl: current.variables(6).value(),
      windSpeed10m: current.variables(7).value(),
    },
    minutely15: {
      time: range(
        Number(minutely15.time()),
        Number(minutely15.timeEnd()),
        minutely15.interval()
      ).map((t) => new Date((t + utcOffsetSeconds) * 1000)),
      precipitation: minutely15.variables(0).valuesArray(),
      visibility: minutely15.variables(1).valuesArray(),
    },
  };
  weatherData.current.precipitation = weatherData.minutely15.precipitation[0];
  weatherData.current.visibility = weatherData.minutely15.visibility[0];
  weatherData = weatherData.current;
  weatherData.pressureMsl *= 0.02952998057228;
  weatherData.visibility *= 0.000621371;
  const end = performance.now();
  console.log('Weather TIme', end-start);
  currBlock.weatherTime=end-start;
  return weatherData;
  // `weatherData` now contains a simple structure with arrays for datetime and weather data
  /*for (let i = 0; i < weatherData.minutely15.time.length; i++) {
    console.log(
      weatherData.minutely15.time[i].toISOString(),
      weatherData.minutely15.precipitation[i],
      weatherData.minutely15.visibility[i]
    );
  }*/
}
const overpassQueries=[
  ['traffic_calming','bump','Bump'],
  ['highway','crossing','Crossing'],
  ['highway','give_way','Give_Way'],
  ['junction','Junction'],
  ['noexit','yes','No_Exit'],
  ['railway','Railway'],
  ['junction','roundabout','Roundabout'],
  ['highway','stop','Stop'],
  ['traffic_calming','Traffic_Calming'],
  ['highway','traffic_signals','Traffic_Signal'],
  ['highway','turning_loop','Turning_Loop'],
  ['railway','station','Station'],
  ['amenity','Amenity']
]
async function getPOIs(lat,long) {
  const start=performance.now();
  let body = '';
  let radius = 50.0
  for (const query of overpassQueries) {
    if (query.length==2) {
      body+=`node[${query[0]}](around:${radius},${lat},${long});\n`;
    } else {
      body+=`node[${query[0]}=${query[1]}](around:${radius},${lat},${long});\n`
    }
  }
  const finalquery = `
            [timeout:2]
            [out:json];
            
              (${body});
            out;
        `
    //console.log(finalquery);
  const result = await fetch(
    "https://overpass-api.de/api/interpreter",
    {
        method: "POST",
        // The body contains the query
        // to understand the query language see "The Programmatic Query Language" on
        // https://wiki.openstreetmap.org/wiki/Overpass_API#The_Programmatic_Query_Language_(OverpassQL)
        body: "data="+ encodeURIComponent(finalquery) // removed traffic_calming=bump,railway,and junction=roundabout bc overlap
    },
  ).then(
      (data)=>data.json()
  ).then(res=>res.elements)
  //return result;
  //console.log(result)
  const poi = {};
  for (const tag of overpassQueries) {
    poi[tag[tag.length-1]]=false;
  }
  for (const element of result) {
    for (const tag of overpassQueries) {
      if ((tag.length==2&&element.tags.hasOwnProperty(tag[0]))||(tag.length==3&&element.tags[tag[0]]==tag[1])) {
        poi[tag[tag.length-1]] = true;
      } //else {
        //poi[tag[tag.length-1]] = false;
      //}
    }
  }
  //console.log('poi',poi);
  const end = performance.now()
  console.log('POI time',end-start);
  currBlock.poiTime=end-start;
  return poi;
}

async function predict(...args) {
  //return 1;
  console.log('cool', inferenceSession);
  if (inferenceSession===null) {
    console.log('making inference session');
    try {
      console.log('inside the block')
      //throw new Error('fooo');
      const start=performance.now();
      inferenceSession=await InferenceSession.create(FileSystem.documentDirectory+'model_pruned20_fixed.onnx');
      const end = performance.now();
      console.log('done',end-start);
      currBlock.modelLoadTime=end-start;
      console.log('inferenceSession',inferenceSession)
    } catch (err) {
      console.log('something went wrong');
      console.log('error',err);
    }
    console.log('reached the end?')
    //console.log(inferenceSession);
  }
  console.log(inferenceSession);
  console.log('hi')
  if (args.length!==22) {
    console.error('wrong args length');
    return 'NA';
  }
  const start = performance.now();
  const data = new Float32Array(args);
  console.log(data)
  const tensor = new Tensor('float32', data, [1,22]);
  const result = await inferenceSession.run({input:tensor});
  const end = performance.now();
  console.log('result', result, end-start);
  currBlock.predictTime=end-start;
  return Number(result.label.cpuData['0']);
  //return 1;
}
let running = false;
export default function App() {
  //setInterval(() => {console.log('update')}, 1000);
  const [risk, setRisk] = useState('NA');
  const [data, setData] = useState('');
  const [buttonText,setButtonText]=useState('Start');
  /*setInterval(async () => {
    setRisk(predict());
  }, 10*1000);*/
  let granted = false;
  let downloading=false;
  //let running = false;
  //let [running, setRunning] = useState(false);
  const startPrediction = async (fromTimeout) => {
    console.log('pressed',fromTimeout,running,buttonText);
    if (fromTimeout&&!running) {
      //setRunning(false);
      running = false;
      console.log('running set to',running);
      return;
    }
    if (buttonText=='Stop' && !fromTimeout) {
      console.log('changing running state to')
      //setRunning(false);
      running = false;
      console.log(running)
      if (downloading) {
        setButtonText('Still Downloading')
        return;
      }
      setButtonText('Start');
      return;
    } 
    //setRunning(true);
    running = true;
    console.log('set running to',running)
    console.log('running',running)
    if (!granted) {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setData('Permission to access location was denied');
        return;
      }
      granted = true;
    }
    console.log('predicting');
    setData('predicting');
    currBlock.timestamp = Date.now();
    setButtonText('Stop');
    if (modelDownloaded==null) {
      modelDownloaded=(await FileSystem.getInfoAsync(FileSystem.documentDirectory + 'model_pruned20_fixed.onnx')).exists;
    }
    if (!modelDownloaded) {
      //setButtonText('Downloading...');
      setData('Downloading...')
      downloading=true;
      try {
        const {uri}=FileSystem.downloadAsync('https://cdn.glitch.global/d4431d45-b514-4d67-b140-26a71ff793a2/sklearn_production_pruned20_fixed.onnx', FileSystem.documentDirectory + 'model_pruned20_fixed.onnx');
      } catch (err) {
        setData(err.text);
        setButtonText('Start');
        return;
      }
      downloading=false;
      modelDownloaded=true;
    }
    //update weather every 10 minutes
    //map data every time?
    //Geolocation.getCurrentPosition(info=>setData(JSON.stringify(info)),err=>setData(err.message));
    const location = await Location.getCurrentPositionAsync({});
    currBlock.location=location;
    let weatherData;
    const lat = location.coords.latitude;
    const long = location.coords.longitude;
    //console.log('pre weather')
    try {
      weatherData = await getWeather(
        lat,
        long
      );
    } catch (err) {
      console.log(err);
    }
    currBlock.weatherData=weatherData;
    //console.log('pre poi');
    let pois;
    try {
    pois = await getPOIs(lat,long);} catch (err) {console.log(err);}
    console.log(pois);
    currBlock.pois = pois;
    const dataDisplay = JSON.stringify(location) + '\n' + JSON.stringify(weatherData) + '\n' + JSON.stringify(pois);
    setData(dataDisplay);
    console.log(JSON.stringify(weatherData));
    console.log('foo');
    try{
      console.log('test')
      //setRisk(await predict(27866.0,37.9,35.5,97,29.63,7.0,3.5,0.03,0,0,0,0,0,0,0,0,0,0,0,1,0,0));
      const now = new Date();
      const diff = new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0);
      const elapsed=Math.round((now-diff)/1000);
      setRisk(await predict(elapsed, weatherData.temperature2m, weatherData.apparentTemperature, weatherData.relativeHumidity2m, weatherData.pressureMsl, weatherData.visibility,weatherData.windSpeed10m, weatherData.precipitation,pois.Bump,pois.Crossing,pois.Give_Way,pois.Junction,pois.No_Exit,pois.Railway,pois.Roundabout,pois.Stop,pois.Traffic_Calming,pois.Traffic_Signal,pois.Turning_Loop,weatherData.isDay,pois.Station,pois.Amenity))
      console.log('ok');
      //setData('ok')
    } catch(err) {
      console.error(err);
      setData('not ok '+err.text);
    }
    log.push(currBlock)
    currBlock={};
    console.log('running',running)
    setData(dataDisplay+'\n'+'finished run '+(log.length).toString()+'\n');
    setTimeout(() => startPrediction(true), 6*1000);
  };
  const clearLogs = () => {
    log = [];
    setData(data+'\ncleared')
    setRisk('NA');
  };
  const saveLog = async () => {
    await FileSystem.writeAsStringAsync(FileSystem.documentDirectory+'drds_log_'+Date.now()+'.txt', JSON.stringify(log));
    setData(data+'\nsaved');
  }
  const clearInfo = () => {setData('');};
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.paragraph}>DRDS App</Text>
      <Button onPress={() => startPrediction(false)} title={buttonText} />
      <Button onPress={clearLogs} title="Clear Logs"/>
      <Button onPress={saveLog} title="Save Logs"/>
      <Button onPress={clearInfo} title="Clear Info"/>
      <Text>{data}</Text>
      <RiskIndicator risk={risk} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
    padding: 8,
  },
  paragraph: {
    margin: 24,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
