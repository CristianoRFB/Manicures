/** Storage provider boundary. All production calls target Google Cloud Storage JSON API.
 * Emulator mode is local-only; no generic remote host or untrusted URL is accepted.
 */
export interface MediaStorageEnv {
  FIREBASE_PROJECT_ID:string;
  FIREBASE_STORAGE_BUCKET?:string;
  FIREBASE_STORAGE_EMULATOR_HOST?:string;
}
export interface StoredObject {
  name:string;
  generation:string;
  size:number;
  contentType:string;
  metadata:Record<string,string>;
  crc32c?:string;
}
export interface StorageInventoryStats {
  objectCount:number;totalBytes:number;
  persistentCount:number;persistentBytes:number;
  legacyCount:number;legacyBytes:number;
  otherCount:number;otherBytes:number;
}
export function summarizeStoragePage(objects:StoredObject[]):StorageInventoryStats{
  const totals:StorageInventoryStats={objectCount:0,totalBytes:0,
    persistentCount:0,persistentBytes:0,legacyCount:0,legacyBytes:0,
    otherCount:0,otherBytes:0};
  for(const object of objects){
    if(!Number.isSafeInteger(object.size)||object.size<0||
      !Number.isSafeInteger(totals.totalBytes+object.size))
      throw new Error("Tamanho de Storage inválido ou acima de precisão segura.");
    totals.objectCount++;totals.totalBytes+=object.size;
    const persistent=object.metadata.mediaClass==="PERSISTENT_BUSINESS"&&
      object.metadata.metadataPolicy==="reencoded_no_exif";
    const legacy=object.metadata.mediaClass===undefined||
      object.metadata.mediaClass==="UNKNOWN_LEGACY"||
      !object.metadata.metadataPolicy;
    if(persistent){totals.persistentCount++;totals.persistentBytes+=object.size;}
    else if(legacy){totals.legacyCount++;totals.legacyBytes+=object.size;}
    else{totals.otherCount++;totals.otherBytes+=object.size;}
  }
  return totals;
}
export interface InventoryPage {
  objects:StoredObject[];
  nextPageToken:string|null;
}
/** Bounded, resumable inventory. Does not measure egress or cloud billing.
 * Storage list() pages are capped to avoid runtime exhaustion or unbounded spend.
 * A new checkpoint cursor always belongs to the caller's already authorised prefix.
 */
export async function scanStoragePrefix(
  env:MediaStorageEnv,token:string,prefix:string,
  startPageToken?:string,maxPages=10,transport:typeof fetch=fetch,
):Promise<{metrics:StorageInventoryStats;pagesScanned:number;complete:boolean;nextPageToken:string|null}>{
  if(!/^tenants\/[A-Za-z0-9_-]{1,100}\/public\/portfolio\/$/.test(prefix))
    throw new Error("Inventário restrito a portfolio de tenant.");
  if(!Number.isInteger(maxPages)||maxPages<1||maxPages>20)
    throw new Error("Limite de páginas inválido.");
  if(startPageToken && startPageToken.length>1200)
    throw new Error("Cursor inválido.");
  const total:StorageInventoryStats={objectCount:0,totalBytes:0,
    persistentCount:0,persistentBytes:0,legacyCount:0,legacyBytes:0,otherCount:0,otherBytes:0};
  let tokenPage=startPageToken??"",pagesScanned=0;
  const seen=new Set<string>();
  do{
    if(tokenPage&&seen.has(tokenPage))throw new Error("Storage retornou cursor cíclico.");
    if(tokenPage)seen.add(tokenPage);
    const page=await listStoredObjects(env,token,prefix,tokenPage||undefined,transport);
    if(page.objects.some(item=>!item.name.startsWith(prefix)))
      throw new Error("Storage retornou objeto fora do tenant.");
    if(page.objects.length>100)throw new Error("Página excedeu 100 objetos.");
    const stats=summarizeStoragePage(page.objects);
    for(const k of Object.keys(total) as (keyof StorageInventoryStats)[]){
      const sum=total[k]+stats[k];
      if(!Number.isSafeInteger(sum))throw new Error("Soma de capacidade excedeu precisão.");
      total[k]=sum;
    }
    pagesScanned++;
    tokenPage=page.nextPageToken??"";
  }while(tokenPage&&pagesScanned<maxPages);
  return {metrics:total,pagesScanned,complete:!tokenPage,nextPageToken:tokenPage||null};
}
function bucketFor(env:MediaStorageEnv):string {
  const name=env.FIREBASE_STORAGE_BUCKET||
    (env.FIREBASE_STORAGE_EMULATOR_HOST?`${env.FIREBASE_PROJECT_ID}.appspot.com`:"");
  if(!/^[a-z0-9][a-z0-9._-]{2,220}$/.test(name)||name.includes(".."))
    throw new Error("FIREBASE_STORAGE_BUCKET não configurado ou inválido.");
  return name;
}
function provider(env:MediaStorageEnv,objectName?:string):string {
  const bucket=encodeURIComponent(bucketFor(env));
  const emulator=env.FIREBASE_STORAGE_EMULATOR_HOST;
  if(emulator){
    if(!/^(?:127\.0\.0\.1|localhost):\d{2,5}$/.test(emulator)||
      env.FIREBASE_PROJECT_ID!=="manicure-worker-test"&&env.FIREBASE_PROJECT_ID!=="manicure-demo")
      throw new Error("Storage Emulator permitido somente local e com projeto sintético.");
    const base=`http://${emulator}/v0/b/${bucket}/o`;
    return objectName===undefined?base:`${base}/${encodeURIComponent(objectName)}`;
  }
  const base=`https://storage.googleapis.com/storage/v1/b/${bucket}/o`;
  return objectName===undefined?base:`${base}/${encodeURIComponent(objectName)}`;
}
function parseObject(raw:unknown):StoredObject {
  const o=raw as Record<string,unknown>;
  const name=typeof o.name==="string"?o.name:"";
  const generation=typeof o.generation==="string"||typeof o.generation==="number"
    ?String(o.generation):"";
  const size=Number(o.size??NaN);
  if(!name||!/^[1-9]\d{0,24}$/.test(generation)||
    !Number.isSafeInteger(size)||size<0)
    throw new Error("Resposta de Storage sem nome, geração ou tamanho válidos.");
  const source=o.metadata&&typeof o.metadata==="object"?o.metadata as Record<string,unknown>:{};
  const metadata:Record<string,string>={};
  for(const [key,value] of Object.entries(source))
    if(typeof value==="string")metadata[key]=value;
  return {name,generation,size,metadata,
    contentType:typeof o.contentType==="string"?o.contentType:"",
    ...(typeof o.crc32c==="string"?{crc32c:o.crc32c}:{})};
}
function headers(token:string):Record<string,string>{
  return token?{authorization:`Bearer ${token}`}:{};
}
export async function getStoredObject(env:MediaStorageEnv,token:string,
  objectName:string,transport:typeof fetch=fetch):Promise<StoredObject|null>{
  const response=await transport(provider(env,objectName),{headers:headers(token)});
  if(response.status===404)return null;
  if(!response.ok)throw new Error(`Storage metadata HTTP ${response.status}`);
  return parseObject(await response.json());
}
export async function deleteStoredGeneration(env:MediaStorageEnv,token:string,
  objectName:string,generation:string,transport:typeof fetch=fetch):Promise<"deleted"|"missing"|"conflict">{
  if(!/^[1-9]\d{0,24}$/.test(generation))throw new Error("Geração inválida.");
  const url=provider(env,objectName)+`?ifGenerationMatch=${encodeURIComponent(generation)}`;
  const response=await transport(url,{method:"DELETE",headers:headers(token)});
  if(response.ok)return "deleted";
  if(response.status===404)return "missing";
  if(response.status===409||response.status===412)return "conflict";
  throw new Error(`Storage DELETE HTTP ${response.status}`);
}
export async function listStoredObjects(env:MediaStorageEnv,token:string,
  prefix:string,pageToken?:string,transport:typeof fetch=fetch):Promise<InventoryPage>{
  const query=new URLSearchParams({prefix,maxResults:"100"});
  if(pageToken)query.set("pageToken",pageToken);
  const response=await transport(provider(env)+`?${query}`,{headers:headers(token)});
  if(!response.ok)throw new Error(`Storage inventory HTTP ${response.status}`);
  const data=await response.json() as {items?:unknown[];nextPageToken?:string};
  const objects=(data.items??[]).map(parseObject);
  return {objects,nextPageToken:data.nextPageToken??null};
}
