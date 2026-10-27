/** Aceita BRL digitado sem separador de milhar, usando vírgula ou ponto decimal. */
export function parseBRLToCents(raw:string):number {
  const normalized=raw.trim();
  if (!/^\d{1,7}(?:[.,]\d{1,2})?$/.test(normalized))
    throw new Error("Preço inválido; informe reais e centavos, por exemplo 49,90.");
  const [reais,centavos=""] = normalized.replace(",",".").split(".");
  const value=Number(reais)*100+Number(centavos.padEnd(2,"0"));
  if(!Number.isSafeInteger(value)||value<0)
    throw new Error("Preço inválido.");
  return value;
}
