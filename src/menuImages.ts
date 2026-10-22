import { cloud } from './cloud';

const DB_NAME='urban-casero-menu-images',STORE='images';
function openDb(){return new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)})}
async function localPut(key:string,blob:Blob){const db=await openDb();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(blob,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});db.close()}
async function localGet(key:string){const db=await openDb();const result=await new Promise<Blob|undefined>((resolve,reject)=>{const r=db.transaction(STORE).objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();return result}
async function localDelete(key:string){const db=await openDb();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});db.close()}

export async function compressMenuImage(file:File):Promise<Blob>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Choose a JPG, PNG, or WebP image.');
 if(file.size>12*1024*1024)throw Error('Image must be 12 MB or smaller.');
 const bitmap=await createImageBitmap(file),scale=Math.min(1,1400/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
 const context=canvas.getContext('2d');if(!context)throw Error('This browser cannot process the selected image.');
 context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',0.82));
 if(!blob)throw Error('Could not prepare this image. Try another file.');
 if(blob.size>1_500_000)throw Error('Compressed image is still too large. Choose a smaller image.');return blob;
}
export async function saveMenuImage(file:File,businessId:string,itemId:string,cloudMode:boolean){
 const blob=await compressMenuImage(file);
 if(cloudMode){if(!businessId)throw Error('Choose a shared business before uploading images.');return cloud.uploadMenuImage(businessId,itemId,blob)}
 const key=crypto.randomUUID();await localPut(key,blob);return `local://${key}`;
}
export async function removeMenuImage(source:string,cloudMode:boolean){
 if(source.startsWith('storage://')&&cloudMode)return cloud.deleteMenuImage(source);
 if(source.startsWith('local://'))return localDelete(source.slice(8));
}
const urlCache=new Map<string,{url:string;expiresAt:number}>();
export async function resolveMenuImage(source:string,cloudMode:boolean){
 if(!source||source.startsWith('data:')||/^https?:\/\//i.test(source))return source;
 const cached=urlCache.get(source);if(cached&&cached.expiresAt>Date.now())return cached.url;
 let url='';if(source.startsWith('storage://')&&cloudMode)url=await cloud.menuImageUrl(source);
 else if(source.startsWith('local://')){const blob=await localGet(source.slice(8));if(blob)url=URL.createObjectURL(blob)}
 if(url)urlCache.set(source,{url,expiresAt:Date.now()+(source.startsWith('storage://')?50*60*1000:24*60*60*1000)});return url;
}
