export type WeatherRisk = 'green' | 'yellow' | 'red';

export type AreaWeather = {
  id:string;
  name:string;
  lat:number;
  lon:number;
  temperature:number;
  maxTemperature24h:number;
  precipitation24h:number;
  precipitationProbability:number;
  thunderProbability:number;
  maxWindKmh:number;
  maxGustKmh:number;
  symbol:string;
  risk:WeatherRisk;
};

export type WeatherBundle = {
  ok:boolean;
  live:boolean;
  provider:string;
  updatedAt:string;
  areas:AreaWeather[];
  overallRisk:WeatherRisk;
  message?:string;
};
