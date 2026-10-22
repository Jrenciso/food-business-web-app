import { useEffect, useState } from 'react';
import { resolveMenuImage } from './menuImages';
export default function MenuItemImage({source,cloudMode,label,className='',fallback='',style}:{source?:string;cloudMode:boolean;label:string;className?:string;fallback?:string;style?:React.CSSProperties}){
 const [url,setUrl]=useState('');
 useEffect(()=>{let live=true;setUrl('');if(source)void resolveMenuImage(source,cloudMode).then(value=>{if(live)setUrl(value)}).catch(()=>{if(live)setUrl('')});return()=>{live=false}},[source,cloudMode]);
 return <div className={className} style={style}>{url?<img src={url} alt={label} onError={()=>setUrl('')}/>:<span aria-label={`${label} image unavailable`}>{fallback||label.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()}</span>}</div>
}
