import { useEffect, useMemo, useRef, useState } from 'react';
import { cloud, type RiderLocation } from './cloud';
import { useApp } from './AppContext';
import { dateTime } from './data';
import { moduleEnabled } from './operations';

export default function RiderTracking() {
 const { cloudMode, cloudBusinessId, role, user, data } = useApp();
 const trackingEnabled=moduleEnabled(data,'riderTracking');
 const [sharing,setSharing] = useState(false);
 const [paused,setPaused] = useState(false);
 const [locations,setLocations] = useState<RiderLocation[]>([]);
 const [chosen,setChosen] = useState('');
 const [locationError,setLocationError] = useState('');
 const lastSent = useRef<{latitude:number;longitude:number;at:number}|null>(null);
 const assigned = useMemo(() => data.orders.filter(o => o.riderId===user.id && o.type==='delivery' &&
  !['Completed','Cancelled'].includes(o.status)).sort((a,b)=>{
   const priority:Record<string,number>={'Out for delivery':0,'Picked up':1,'Ready':2,'Preparing':3,'New':4};
   return (priority[a.status]??5)-(priority[b.status]??5)||a.createdAt.localeCompare(b.createdAt);
  })[0], [data.orders,user.id]);
 const assignedCount = useMemo(() => data.orders.filter(o => o.riderId===user.id && o.type==='delivery' &&
  !['Completed','Cancelled'].includes(o.status)).length, [data.orders,user.id]);

 useEffect(() => {
  if (!trackingEnabled || !cloudMode || role !== 'owner' || !cloudBusinessId) return;
  let mounted = true;
  const load = () => void cloud.riderLocations(cloudBusinessId).then(rows => { if(mounted)setLocations(rows); }).catch(() => {});
  load();const timer = window.setInterval(load,15000);
  return () => { mounted=false;window.clearInterval(timer); };
 }, [trackingEnabled,cloudMode,role,cloudBusinessId]);

 useEffect(() => {
  if (!trackingEnabled || !cloudMode || role !== 'rider' || !cloudBusinessId) return;
  if (paused) {
   setSharing(false);
   const markPaused=()=>void cloud.setRiderSharing(cloudBusinessId,false).catch(e=>setLocationError(e instanceof Error?e.message:'Could not pause location sharing.'));
   markPaused();const timer=window.setInterval(markPaused,30000);
   return ()=>window.clearInterval(timer);
  }
  if (!navigator.geolocation) {
   setSharing(false);setLocationError('This device or browser does not support location sharing.');
   void cloud.setRiderSharing(cloudBusinessId,false);
   return;
  }
  let live = true;
  setLocationError('');
  void cloud.setRiderSharing(cloudBusinessId,true).then(()=>{if(live)setSharing(true)}).catch(e=>{
   if(live){setSharing(false);setLocationError(e instanceof Error?e.message:'Could not start location sharing.')}
  });
  const update = (position:GeolocationPosition) => {
   if (!live) return;
   setSharing(true);setLocationError('');
   const { latitude,longitude,accuracy } = position.coords;
   const last = lastSent.current;
   const moved = !last || Math.hypot((latitude-last.latitude)*111000,(longitude-last.longitude)*111000) > 25;
   if(!moved && last && Date.now()-last.at<30000) return;
   void cloud.setRiderLocation(cloudBusinessId,assigned?.id||null,latitude,longitude,accuracy).then(() => {
    const at=Date.now();lastSent.current = { latitude,longitude,at };
   }).catch(e => { if(live)setLocationError(e instanceof Error ? e.message : 'Location update failed.'); });
  };
  const onError = (error:GeolocationPositionError) => {
   if(!live)return;
   if(error.code===error.PERMISSION_DENIED){
    setSharing(false);setLocationError('Location permission is off. Allow it in browser settings, then turn location sharing on.');
    setPaused(true);void cloud.setRiderSharing(cloudBusinessId,false);
   } else setLocationError('Waiting for a location signal. Keep this page open and try moving to an area with a clear signal.');
  };
  const watch=navigator.geolocation.watchPosition(update,onError,{enableHighAccuracy:true,maximumAge:10000,timeout:20000});
  const timer=window.setInterval(()=>navigator.geolocation.getCurrentPosition(update,onError,{enableHighAccuracy:true,maximumAge:10000,timeout:20000}),30000);
  return () => { live=false;navigator.geolocation.clearWatch(watch);window.clearInterval(timer); };
 }, [trackingEnabled,paused,cloudMode,role,cloudBusinessId,assigned?.id]);

 if(!cloudMode||!trackingEnabled)return null;
 if(role==='rider')return <div className="surface tracking-panel rider-tracking-panel"><div className="rider-tracking-heading"><h3>Delivery location</h3><button type="button" role="switch" aria-checked={sharing} aria-label="Share location with owner" className={`location-toggle ${sharing?'is-on':''}`} onClick={()=>setPaused(value=>!value)}><span className="location-toggle-knob"/><span>{sharing?'On':'Off'}</span></button></div>
  <div className="rider-assigned-count"><span>Assigned tickets</span><strong>{assignedCount}</strong></div>
  {locationError&&<p className="muted rider-location-error">{locationError}</p>}
  </div>;
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
