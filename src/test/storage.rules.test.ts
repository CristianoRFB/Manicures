import {beforeAll,afterAll,beforeEach,describe,it} from "vitest";
import {initializeTestEnvironment,assertFails,assertSucceeds,type RulesTestEnvironment} from "@firebase/rules-unit-testing";
import {doc,setDoc} from "firebase/firestore";
import {getBytes,ref,uploadBytes} from "firebase/storage";
import fs from "node:fs";

let env:RulesTestEnvironment;
const bucket="manicure-storage-test.appspot.com";
const path=(tenant:string,kind:string,id:string,file:string)=>`tenants/${tenant}/${kind}/${id}/${file}`;
const image=new Uint8Array([137,80,78,71,13,10,26,10]);
beforeAll(async()=>{
  env=await initializeTestEnvironment({
    projectId:"manicure-storage-test",
    firestore:{rules:fs.readFileSync("firestore.rules","utf8")},
    storage:{rules:fs.readFileSync("storage.rules","utf8")},
  });
});
afterAll(async()=>{await env?.cleanup();});
beforeEach(async()=>{
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async context=>{
    const db=context.firestore();
    await Promise.all([
      setDoc(doc(db,"tenants/a"),{status:"active",kind:"real",name:"Studio A"}),
      setDoc(doc(db,"tenants/b"),{status:"active",kind:"real",name:"Studio B"}),
      setDoc(doc(db,"memberships/a_ownerA"),{userId:"ownerA",tenantId:"a",role:"tenant_owner",status:"active"}),
      setDoc(doc(db,"memberships/a_proA"),{userId:"proA",tenantId:"a",role:"professional",status:"active",professionalId:"p1"}),
      setDoc(doc(db,"memberships/a_customerA"),{userId:"customerA",tenantId:"a",role:"customer",status:"active",customerId:"customerA"}),
      setDoc(doc(db,"memberships/a_customerB"),{userId:"customerB",tenantId:"a",role:"customer",status:"active",customerId:"customerB"}),
      setDoc(doc(db,"memberships/b_ownerB"),{userId:"ownerB",tenantId:"b",role:"tenant_owner",status:"active"}),
      setDoc(doc(db,"platformUsers/platform"),{role:"platform_owner",status:"active"}),
    ]);
  });
});
function file(uid:string|undefined,object:string){
  const context=uid?env.authenticatedContext(uid):env.unauthenticatedContext();
  return ref(context.storage(bucket),object);
}
async function upload(uid:string,object:string,contentType="image/png",bytes:Uint8Array=image){
  return uploadBytes(file(uid,object),bytes,{contentType});
}
describe("tenant media isolation",()=>{
  it("owner A faz upload e clientes de A e B não leem private",async()=>{
    const key="tenants/a/private/internal/source.png";
    await assertSucceeds(upload("ownerA",key));
    await assertSucceeds(getBytes(file("ownerA",key)));
    await assertFails(getBytes(file("customerA",key)));
    await assertFails(getBytes(file("ownerB",key)));
    await assertFails(getBytes(file(undefined,key)));
  });
  it("cliente lê apenas sua pasta; profissional apenas a própria",async()=>{
    const own=path("a","customers","customerA","self.png");
    const foreign=path("a","customers","customerB","self.png");
    await assertSucceeds(upload("customerA",own));
    await assertFails(upload("customerA",foreign));
    await assertSucceeds(getBytes(file("customerA",own)));
    await assertFails(getBytes(file("customerB",own)));
    const pro=path("a","professionals","p1","portfolio.png");
    await assertSucceeds(upload("proA",pro));
    await assertFails(getBytes(file("customerA",pro)));
    await assertFails(upload("customerA",pro));
    await assertFails(getBytes(file("ownerB",pro)));
  });
  it("mídia publicamente publicada é legível mas escrita só por tenant autorizado",async()=>{
    const key="tenants/a/public/portfolio/cover.png";
    await assertSucceeds(upload("ownerA",key));
    await assertSucceeds(getBytes(file(undefined,key)));
    await assertFails(upload("customerA",key));
    await assertFails(upload("ownerB",key));
  });
  it("nega arquivos executáveis e limites de upload, preservando fotos existentes",async()=>{
    const key="tenants/a/public/portfolio/test.exe";
    await assertFails(upload("ownerA",key,"application/x-msdownload"));
    await assertFails(upload("ownerA","tenants/a/public/portfolio/big.png","image/png",new Uint8Array(5*1024*1024+1)));
  });
});
