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

test("late booking response cannot leak tenant A receipt into tenant B",async({page})=>{
  let pending:import("@playwright/test").Route|undefined;
  await page.route("**/api/availability?*",route=>{
    const url=new URL(route.request().url());
    const date=url.searchParams.get("date")??"2026-11-04";
    return route.fulfill({status:200,contentType:"application/json",
      headers:{"access-control-allow-origin":"http://127.0.0.1:5173"},
      body:JSON.stringify({slots:[date+"T14:00:00"],date,timezone:"America/Sao_Paulo"})});
  });
  await page.route("**/api/bookings",route=>{pending=route;});
  await page.goto("/demo/book");
  await expect(page.getByRole("option",{name:"Manicure clássica"})).toBeAttached();
  await page.getByRole("button",{name:"Selecionar horário 14:00"}).click();
  await page.getByLabel("Nome").fill("Cliente Teste");
  await page.getByLabel("Telefone").fill("11912345678");
  await page.getByRole("button",{name:"Solicitar agendamento"}).click();
  await expect.poll(()=>Boolean(pending)).toBe(true);
  // SPA navigation keeps the same BookingPage component and invalidates old async state.
  await page.evaluate(()=>{
    window.history.pushState({}, "", "/demo-b/book");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page).toHaveURL(/\/demo-b\/book$/);
  const submitted=pending!.request().postDataJSON() as {startsAt:string;tenantId:string;
    serviceId:string;professionalId:string};
  expect(submitted.tenantId).toBe("tenant-demo-a");
  const end=new Date(Date.parse(submitted.startsAt+"Z")+3600000).toISOString().slice(0,19);
  await pending!.fulfill({status:201,contentType:"application/json",
    headers:{"access-control-allow-origin":"http://127.0.0.1:5173"},
    body:JSON.stringify({appointment:{
      id:"12345678-1234-1234-1234-123456789abc",...submitted,endsAt:end,
      status:"pending",durationSnapshotMin:60,priceSnapshotCents:4000}})});
  // Release the deliberately stalled Worker request before waiting for
  // the second studio's Firestore resources to load.
  await expect(page.getByRole("option",{name:"Pedicure B"})).toBeAttached({timeout:15000});
  await expect(page.getByLabel("Comprovante da solicitação")).toHaveCount(0);
  await expect(page.getByText("Agendamento confirmado para solicitação.")).toHaveCount(0);
  await expect(page.getByLabel("Nome")).toHaveValue("");
  await expect(page.getByLabel("Telefone")).toHaveValue("");
});
