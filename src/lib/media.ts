/** Browser-only normalization of public portfolio photos.
 * We never upload the original source file or carry its EXIF/IPTC/XMP metadata.
 */
const MAX_SOURCE_BYTES=5*1024*1024;
const MAX_PIXELS=25_000_000;
const MAX_EDGE=1920;
const SUPPORTED=new Set(["image/jpeg","image/png","image/webp"]);

export function validatePortfolioSource(file:Pick<File,"size"|"type">):void{
  if(!SUPPORTED.has(file.type)||file.size<=0||file.size>MAX_SOURCE_BYTES)
    throw new Error("Use imagem JPEG, PNG ou WebP de até 5 MiB.");
}
export function fitPortfolioDimensions(width:number,height:number):{width:number;height:number}{
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||
    width*height>MAX_PIXELS)throw new Error("Imagem inválida ou com resolução excessiva.");
  const factor=Math.min(1,MAX_EDGE/Math.max(width,height));
  return {width:Math.max(1,Math.round(width*factor)),height:Math.max(1,Math.round(height*factor))};
}
export async function normalizePortfolioImage(file:File):Promise<Blob>{
  validatePortfolioSource(file);
  if(typeof createImageBitmap!=="function")throw new Error("Este navegador não oferece decodificação segura de imagem.");
  const bitmap=await createImageBitmap(file,{imageOrientation:"from-image"});
  try{
    const dimensions=fitPortfolioDimensions(bitmap.width,bitmap.height);
    const canvas=document.createElement("canvas");
    canvas.width=dimensions.width;
    canvas.height=dimensions.height;
    const context=canvas.getContext("2d");
    if(!context)throw new Error("Canvas de imagem indisponível.");
    context.drawImage(bitmap,0,0,dimensions.width,dimensions.height);
    const blob=await new Promise<Blob>((resolve,reject)=>{
      canvas.toBlob(result=>{
        if(result?.type==="image/webp"&&result.size>0&&result.size<=MAX_SOURCE_BYTES)resolve(result);
        else reject(new Error("Falha ao converter imagem WebP com segurança."));
      },"image/webp",0.86);
    });
    return blob;
  }finally{bitmap.close();}
}
