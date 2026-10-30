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
