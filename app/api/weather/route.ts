import { NextResponse } from 'next/server';
import type { AreaWeather, WeatherBundle, WeatherRisk } from '@/types/weather';
import { MANAGEMENT_AREAS } from '@/lib/management-areas';

export const dynamic = 'force-dynamic';

const AREAS = MANAGEMENT_AREAS;

function riskFor(area:Omit<AreaWeather,'risk'>):WeatherRisk {
  if (area.thunderProbability >= 40 || area.precipitation24h >= 30 || area.maxGustKmh >= 55) return 'red';
  if (area.thunderProbability >= 20 || area.precipitationProbability >= 70 || area.precipitation24h >= 10 || area.maxGustKmh >= 40 || area.maxTemperature24h >= 35) return 'yellow';
  return 'green';
}

async function getArea(area:(typeof AREAS)[number], userAgent:string):Promise<AreaWeather> {
  const endpoint = `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${area.lat}&lon=${area.lon}`;
  const response = await fetch(endpoint, { headers:{'User-Agent':userAgent}, cache:'no-store' });
  if (!response.ok) throw new Error(`MET Norway ${response.status}`);
  const json = await response.json();
  const series = (json?.properties?.timeseries ?? []).slice(0,24);
  if (!series.length) throw new Error('Không có chuỗi dự báo');
  const first = series[0];
  const temps = series.map((x:any)=>Number(x?.data?.instant?.details?.air_temperature)).filter(Number.isFinite);
  const winds = series.map((x:any)=>Number(x?.data?.instant?.details?.wind_speed)).filter(Number.isFinite);
  const gusts = series.map((x:any)=>Number(x?.data?.instant?.details?.wind_speed_of_gust)).filter(Number.isFinite);
  const oneHour = series.map((x:any)=>x?.data?.next_1_hours?.details ?? x?.data?.next_6_hours?.details ?? {});
  const precipitation = oneHour.map((x:any)=>Number(x?.precipitation_amount)).filter(Number.isFinite);
  const rainProb = oneHour.map((x:any)=>Number(x?.probability_of_precipitation)).filter(Number.isFinite);
  const thunderProb = oneHour.map((x:any)=>Number(x?.probability_of_thunder)).filter(Number.isFinite);
  const base = {
    ...area,
    temperature:Number(first?.data?.instant?.details?.air_temperature ?? 0),
    maxTemperature24h:Math.max(...temps,0),
    precipitation24h:precipitation.reduce((a:number,b:number)=>a+b,0),
    precipitationProbability:Math.max(...rainProb,0),
    thunderProbability:Math.max(...thunderProb,0),
    maxWindKmh:Math.max(...winds,0)*3.6,
    maxGustKmh:Math.max(...gusts,0)*3.6,
    symbol:first?.data?.next_1_hours?.summary?.symbol_code ?? first?.data?.next_6_hours?.summary?.symbol_code ?? 'unknown',
  };
  return { ...base, risk:riskFor(base) };
}

export async function GET() {
  const userAgent = process.env.WEATHER_USER_AGENT;
  if (!userAgent) {
    const result:WeatherBundle = { ok:false, live:false, provider:'MET Norway Locationforecast', updatedAt:new Date().toISOString(), areas:[], overallRisk:'green', message:'Thiếu WEATHER_USER_AGENT. Hãy cấu hình tên app và email liên hệ để dùng nguồn thời tiết trực tiếp.' };
    return NextResponse.json(result, { status:200, headers:{'Cache-Control':'no-store'} });
  }
  try {
    const areas = await Promise.all(AREAS.map((area)=>getArea(area,userAgent)));
    const overallRisk = areas.some((x)=>x.risk==='red') ? 'red' : areas.some((x)=>x.risk==='yellow') ? 'yellow' : 'green';
    const result:WeatherBundle = { ok:true, live:true, provider:'MET Norway Locationforecast', updatedAt:new Date().toISOString(), areas, overallRisk };
    return NextResponse.json(result, { headers:{'Cache-Control':'public, s-maxage=1800, stale-while-revalidate=3600'} });
  } catch (error) {
    const result:WeatherBundle = { ok:false, live:false, provider:'MET Norway Locationforecast', updatedAt:new Date().toISOString(), areas:[], overallRisk:'green', message:String(error) };
    return NextResponse.json(result, { status:200, headers:{'Cache-Control':'no-store'} });
  }
}
