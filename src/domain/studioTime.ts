/** Resolve a studio civil time to a unique instant (no implicit offset guessing).
 * Nonexistent and ambiguous DST times must fail closed.
 */
export function studioLocalInstant(local: string, timeZone: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):00$/.exec(local);
  if (!match) return null;
  const [year,month,day,hour,minute] = match.slice(1).map(Number);
  const naive = Date.UTC(year,month-1,day,hour,minute,0);
  if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0,19)!==local) return null;
  try {
    const formatter=new Intl.DateTimeFormat("en-GB",{
      timeZone,year:"numeric",month:"2-digit",day:"2-digit",
      hour:"2-digit",minute:"2-digit",hourCycle:"h23",
    });
    const partsAt=(instant:number)=>{
      const values=Object.fromEntries(formatter.formatToParts(new Date(instant))
        .map(part=>[part.type,part.value]));
      return [Number(values.year),Number(values.month),Number(values.day),
        Number(values.hour),Number(values.minute)];
    };
    const candidates=new Set<number>();
    for(const sampleHours of [-36,-24,-12,0,12,24,36]){
      const sample=naive+sampleHours*3600000;
      const [y,m,d,h,min]=partsAt(sample);
      const offset=Date.UTC(y,m-1,d,h,min)-sample;
      const candidate=naive-offset;
      const [cy,cm,cd,ch,cmin]=partsAt(candidate);
      if(cy===year&&cm===month&&cd===day&&ch===hour&&cmin===minute)
        candidates.add(candidate);
    }
    return candidates.size===1?[...candidates][0]:null;
  }catch{return null;}
}

/** Compute real duration, lead time and horizon; never subtract local clock labels. */
export function validStudioBookingInterval(input:{
  startsAt:string;endsAt:string;durationMin:number;timeZone:string;
  nowMs:number;bookingHorizonDays:number;minLeadMinutes:number;
}):boolean{
  const {startsAt,endsAt,durationMin,timeZone,nowMs,bookingHorizonDays,minLeadMinutes}=input;
  if(!Number.isFinite(nowMs)||!Number.isSafeInteger(durationMin)||durationMin<=0||durationMin>480||
    !Number.isSafeInteger(bookingHorizonDays)||bookingHorizonDays<=0||bookingHorizonDays>365||
    !Number.isSafeInteger(minLeadMinutes)||minLeadMinutes<0||minLeadMinutes>525600)return false;
  const start=studioLocalInstant(startsAt,timeZone);
  const end=studioLocalInstant(endsAt,timeZone);
  if(start===null||end===null||end-start!==durationMin*60000)return false;
  const lead=start-nowMs;
  return lead>=minLeadMinutes*60000&&lead<=bookingHorizonDays*86400000;
}
