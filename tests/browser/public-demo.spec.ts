import {test,expect} from "@playwright/test";
import {mkdirSync} from "node:fs";
import {join} from "node:path";

// These are actual screenshots of the running PUBLIC DEMO, not mockups,
// not deployed tenant/admin screens and never a representation of production.
const folder=join("qa-evidence","screenshots");
test.beforeAll(()=>mkdirSync(folder,{recursive:true}));

test("real homepage, tenant A/B isolation and public booking screen",async({page},info)=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Agendamento para profissionais de unhas"})).toBeVisible();
  await page.getByRole("link",{name:"Conhecer DEMO"}).click();
  await expect(page.getByRole("heading",{name:/Studio Demo Nails A/})).toBeVisible();
  await expect(page.getByText("Manicure clássica")).toBeVisible();
  await expect(page.getByText("Pedicure Demo B")).toHaveCount(0);
  await page.screenshot({path:join(folder,info.project.name+"-studio-a.png"),fullPage:true});
  await page.getByRole("link",{name:"Agendar agora"}).click();
  await expect(page).toHaveURL(/\/demo\/book$/);
  await expect(page.getByText(/demonstração somente visual/i)).toBeVisible();
  await page.screenshot({path:join(folder,info.project.name+"-booking.png"),fullPage:true});
  await page.goto("/demo-b");
  await expect(page.getByRole("heading",{name:/Ateliê Demo B/})).toBeVisible();
  await expect(page.getByText("Pedicure Demo B")).toBeVisible();
  await expect(page.getByText("Manicure clássica")).toHaveCount(0);
  await page.screenshot({path:join(folder,info.project.name+"-studio-b.png"),fullPage:true});
});

test("plans approved, no fictitious payment or implemented premium claims",async({page},info)=>{
  await page.goto("/pricing");
  await expect(page.getByRole("heading",{name:"Planos para cada tamanho de studio"})).toBeVisible();
  await expect(page.getByText(/49,90/).first()).toBeVisible();
  await expect(page.getByText(/79,90/).first()).toBeVisible();
  await expect(page.getByText(/119,90/).first()).toBeVisible();
  await expect(page.getByText(/cobrança automática.*ainda não estão disponíveis/i)).toBeVisible();
  await page.screenshot({path:join(folder,info.project.name+"-pricing.png"),fullPage:true});
});
