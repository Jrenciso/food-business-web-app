import { useEffect, useMemo, useRef, useState } from 'react';
import { cloud, type RiderLocation } from './cloud';
import { useApp } from './AppContext';
import { dateTime } from './data';

export default function RiderTracking() {
 const { cloudMode, cloudBusinessId, role, user, data } = useApp();
 const [sharing,setSharing] = useState(false);
 const [paused,setPaused] = useState(false);
 const [permission,setPermission] = useState<'asking'|'granted'|'denied'|'unavailable'>('asking');
 const [lastUpdate,setLastUpdate] = useState('');
 const [locations,setLocations] = useState<RiderLocation[]>([]);
 const [chosen,setChosen] = useState('');
 const [locationError,setLocationError] = useState('');
 const lastSent = useRef<{latitude:number;longitude:number;at:number}|null>(null);
 const assigned = useMemo(() => data.orders.filter(o => o.riderId===user.id && o.type==='delivery' &&
  !['Completed','Cancelled'].includes(o.status)).sort((a,b)=>{
   const priority:Record<string,number>={'Out for delivery':0,'Picked up':1,'Ready':2,'Preparing':3,'New':4};
   return (priority[a.status]??5)-(priority[b.status]??5)||a.createdAt.localeCompare(b.createdAt);
  })[0], [data.orders,user.id]);

 useEffect(() => {
  if (!cloudMode || role !== 'owner' || !cloudBusinessId) return;
  let mounted = true;
  const load = () => void cloud.riderLocations(cloudBusinessId).then(rows => { if(mounted)setLocations(rows); }).catch(() => {});
  load();const timer = window.setInterval(load,15000);
  return () => { mounted=false;window.clearInterval(timer); };
 }, [cloudMode,role,cloudBusinessId]);

 useEffect(() => {
  if (!cloudMode || role !== 'rider' || !cloudBusinessId) return;
  if (paused) {
   setSharing(false);
   const markPaused=()=>void cloud.setRiderSharing(cloudBusinessId,false).catch(e=>setLocationError(e instanceof Error?e.message:'Could not pause location sharing.'));
   markPaused();const timer=window.setInterval(markPaused,30000);
   return ()=>window.clearInterval(timer);
  }
  if (!navigator.geolocation) {
   setPermission('unavailable');setSharing(false);setLocationError('This device or browser does not support location sharing.');
   void cloud.setRiderSharing(cloudBusinessId,false);
   return;
  }
  let live = true;
  setPermission('asking');setLocationError('');
  void cloud.setRiderSharing(cloudBusinessId,true).then(()=>{if(live)setSharing(true)}).catch(e=>{
   if(live){setSharing(false);setLocationError(e instanceof Error?e.message:'Could not start location sharing.')}
  });
  const update = (position:GeolocationPosition) => {
   if (!live) return;
   setPermission('granted');setSharing(true);setLocationError('');
   const { latitude,longitude,accuracy } = position.coords;
   const last = lastSent.current;
   const moved = !last || Math.hypot((latitude-last.latitude)*111000,(longitude-last.longitude)*111000) > 25;
   if(!moved && last && Date.now()-last.at<30000) return;
   void cloud.setRiderLocation(cloudBusinessId,assigned?.id||null,latitude,longitude,accuracy).then(() => {
    const at=Date.now();lastSent.current = { latitude,longitude,at };setLastUpdate(new Date(at).toISOString());
   }).catch(e => { if(live)setLocationError(e instanceof Error ? e.message : 'Location update failed.'); });
  };
  const onError = (error:GeolocationPositionError) => {
   if(!live)return;
   if(error.code===error.PERMISSION_DENIED){
    setPermission('denied');setSharing(false);setLocationError('Location permission is off. Allow it in browser settings, then tap Resume sharing.');
    setPaused(true);void cloud.setRiderSharing(cloudBusinessId,false);
   } else setLocationError('Waiting for a location signal. Keep this page open and try moving to an area with a clear signal.');
  };
  const watch=navigator.geolocation.watchPosition(update,onError,{enableHighAccuracy:true,maximumAge:10000,timeout:20000});
  const timer=window.setInterval(()=>navigator.geolocation.getCurrentPosition(update,onError,{enableHighAccuracy:true,maximumAge:10000,timeout:20000}),30000);
  return () => { live=false;navigator.geolocation.clearWatch(watch);window.clearInterval(timer); };
 }, [paused,cloudMode,role,cloudBusinessId,assigned?.id]);

 if(!cloudMode)return null;
 if(role==='rider')return <div className="surface tracking-panel"><h3>Delivery location</h3>
  <p className="sharing-indicator"><span className={`sharing-dot ${sharing?'on':'off'}`}/>{sharing?'Sharing location with the owner':paused?'Sharing paused':permission==='denied'?'Permission needed':permission==='asking'?'Requesting location permission…':'Location not available'}</p>
  <p className="muted">Your location helps the owner coordinate deliveries and is shared only during your signed-in work session. You can pause it any time. Mobile browsers may stop updates when this page is closed, suspended, or the device restricts location. Sharing resumes when you return to this page.</p>
  {assigned&&<p>Assigned ticket: <strong>#{assigned.number}</strong> · {assigned.status}</p>}
  <p className="muted">Last location update: {lastUpdate?dateTime(lastUpdate,data.settings.timezone):'Waiting for first location'}</p>
  {locationError&&<p className="muted">{locationError}</p>}
  <button className={sharing?'outline':'primary'} onClick={()=>setPaused(value=>!value)}>{paused||permission==='denied'?'Resume sharing':'Pause sharing'}</button></div>;
 if(role!=='owner')return null;
 const current = locations.find(row => row.employeeId === chosen) || locations[0];
 const now = Date.now();
 return <div className="surface tracking-panel"><h3>Rider location status</h3>
  <p className="muted">The owner view shows active rider profiles. Coordinates are stored only while available; positions older than 10 minutes expire.</p>
  {locations.length?<><div className="rider-location-list">{locations.map(row => {
   const order = row.orderId?data.orders.find(ticket => ticket.id === row.orderId):undefined;
   const locationStale = !!row.updatedAt && now - Date.parse(row.updatedAt) > 120000;
   const sessionStale = !row.sessionSeenAt || now - Date.parse(row.sessionSeenAt) > 120000;
   const label = row.status==='paused'&&!sessionStale?'Sharing paused':sessionStale?'Offline / stale':row.latitude===null?'Waiting for location':locationStale?'Location stale':'Sharing';
   return <button key={row.employeeId} className="outline" onClick={() => setChosen(row.employeeId)}>
    <strong>{row.name||'Rider'}</strong> · {label} · ticket {order?`#${order.number}`:'—'}
    <small>{row.updatedAt?`Last location ${dateTime(row.updatedAt,data.settings.timezone)}`:'No location received'}{row.accuracy===null?'':` · ±${Math.round(row.accuracy)} m`}</small>
   </button>;
  })}</div>{current?.status!=='offline'&&current?.latitude!==null&&current?.latitude!==undefined&&current.longitude!==null&&current.longitude!==undefined&&<div className="rider-map"><iframe title={`Current location for ${current.name}`} loading="lazy"
   src={`https://www.openstreetmap.org/export/embed.html?bbox=${current.longitude-.006}%2C${current.latitude-.004}%2C${current.longitude+.006}%2C${current.latitude+.004}&layer=mapnik&marker=${current.latitude}%2C${current.longitude}`}/>
   <a href={`https://www.google.com/maps/search/?api=1&query=${current.latitude}%2C${current.longitude}`} target="_blank" rel="noreferrer">Open in map app</a></div>}</>:
   <p className="muted">No active rider profiles.</p>}</div>;
}
