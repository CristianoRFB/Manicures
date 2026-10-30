/** Optional manual operational limits; blank inherits approved plan. */
export function parseManualLimit(value:string):number|undefined{
  const normalized=value.trim();
  if(!normalized)return undefined;
  if(!/^[0-9]{1,4}$/.test(normalized))
    throw new Error("Limite inválido: use inteiro de 0 a 9999.");
  const amount=Number(normalized);
  if(!Number.isSafeInteger(amount)||amount<0||amount>9999)
    throw new Error("Limite manual fora do intervalo.");
  return amount;
}
