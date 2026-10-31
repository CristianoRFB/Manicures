import {test,expect} from "@playwright/test";
import {mkdirSync} from "node:fs";
import {join} from "node:path";

const folder=join("qa-evidence","screenshots");
test.beforeAll(()=>mkdirSync(folder,{recursive:true}));

async function logIn(page:import("@playwright/test").Page,email:string){
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("Demo123!Demo123!");
  await page.getByRole("button",{name:"Entrar",exact:true}).click();
}

test("owner A opens its own studio and cannot administer tenant B",async({page},info)=>{
  await page.goto("/app/demo");
  await expect(page.getByRole("heading",{name:"Painel do tenant"})).toBeVisible();
  await logIn(page,"owner-a@example.test");
  await expect(page.getByRole("heading",{name:/Studio Demo Nails A/})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Serviços"})).toBeVisible();
  await page.screenshot({path:join(folder,info.project.name+"-tenant-admin.png"),fullPage:true});
  await page.goto("/app/demo-b");
  await expect(page.getByText("ACESSO NEGADO")).toBeVisible();
  await page.screenshot({path:join(folder,info.project.name+"-tenant-b-denied.png"),fullPage:true});
});

test("platform owner sees tenant inventory and settings but does not change production data",async({page},info)=>{
  await page.goto("/platform");
  await expect(page.getByRole("heading",{name:"Administração da plataforma"})).toBeVisible();
  await logIn(page,"platform@example.test");
  await expect(page.getByRole("heading",{name:"Tenants"})).toBeVisible();
  await expect(page.getByText(/Studio Demo Nails A/).first()).toBeVisible();
  await expect(page.getByText(/Ateliê Demo B/).first()).toBeVisible();
  await expect(page.getByRole("heading",{name:"Atribuição manual de plano"})).toBeVisible();
  await page.screenshot({path:join(folder,info.project.name+"-platform.png"),fullPage:true});
});

test("invalid Firebase login never exposes raw SDK errors to studio owners",async({page})=>{
  await page.goto("/app/demo");
  await expect(page.getByRole("heading",{name:"Painel do tenant"})).toBeVisible();
  await page.getByLabel("E-mail").fill("owner-a@example.test");
  await page.getByLabel("Senha").fill("senha-incorreta-123");
  await page.getByRole("button",{name:"Entrar",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("Não foi possível entrar.");
  await expect(page.getByRole("alert")).not.toContainText("Firebase");
  await expect(page.getByRole("alert")).not.toContainText("auth/");
  await expect(page.getByRole("button",{name:"Entrar",exact:true})).toBeEnabled();
});

test("customer invalid login stays private and does not identify an account",async({page})=>{
  await page.goto("/customer/demo");
  await expect(page.getByRole("heading",{name:/Minha agenda/})).toBeVisible();
  await page.getByLabel("E-mail").fill("owner-a@example.test");
  await page.getByLabel("Senha").fill("senha-incorreta-123");
  await page.getByRole("button",{name:"Entrar",exact:true}).click();
  await expect(page.getByRole("alert")).toContainText("Não foi possível entrar.");
  await expect(page.getByRole("alert")).not.toContainText("Firebase");
  await expect(page.getByRole("button",{name:"Entrar",exact:true})).toBeEnabled();
});

test("verified customer is recognized as linked after account confirmation",async({page},info)=>{
  const {initializeApp,deleteApp}=await import("firebase-admin/app");
  const {getAuth}=await import("firebase-admin/auth");
  const {getFirestore}=await import("firebase-admin/firestore");
  const key=info.project.name.replace(/[^a-zA-Z0-9-]/g,"-");
  const uid="verified-customer-"+key;
  const email="verified-customer-"+key+"@example.test";
  const app=initializeApp({projectId:"manicure-demo"},"customer-confirmation-"+key);
  const auth=getAuth(app),db=getFirestore(app);
  try {
    await auth.createUser({uid,email,password:"Demo123!Demo123!",emailVerified:false});
    await db.doc("memberships/tenant-demo-a_"+uid).set({
      tenantId:"tenant-demo-a",userId:uid,role:"customer",
      customerId:uid,status:"active",
    });
    await page.goto("/customer/demo");
    await expect(page.getByRole("heading",{name:/Minha agenda/})).toBeVisible();
    await logIn(page,email);
    await expect(page.getByRole("heading",{name:"Confirme seu e-mail"})).toBeVisible();
    await auth.updateUser(uid,{emailVerified:true});
    await page.getByRole("button",{name:"Verificar e-mail"}).click();
    await expect(page.getByText("E-mail confirmado.")).toBeVisible();
    await expect(page.getByRole("heading",{name:"Meus agendamentos"})).toBeVisible();
    await page.goto("/demo/book");
    await expect(page.getByText("Reserva vinculada à sua conta de cliente verificada.")).toBeVisible();
  }finally{
    await db.doc("memberships/tenant-demo-a_"+uid).delete().catch(()=>{});
    await auth.deleteUser(uid).catch(()=>{});
    await deleteApp(app);
  }
});
