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
  await expect(page.getByRole("heading",{name:"Novo agendamento"})).toBeVisible();
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

// Regression: dates are local-calendar days, not UTC strings, and a stale slot cannot submit.
test("booking date guard, accessible slot state and navigation skip link", async ({page}) => {
  await page.goto("/demo/book");
  await expect(page.locator("main#main-content")).toHaveCount(1);
  await expect(page.getByRole("link",{name:"Ir para o conteúdo"})).toHaveAttribute("href","#main-content");
  const dateInput=page.getByLabel("Data");
  const localToday=await page.evaluate(()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");});
  await expect(dateInput).toHaveAttribute("min",localToday);
  const action=page.getByRole("button",{name:"Solicitar agendamento"});
  await expect(action).toBeDisabled();
  const firstSlot=page.getByRole("button",{name:/Selecionar horário/}).first();
  await expect(firstSlot).toBeVisible();
  await firstSlot.click();
  await expect(firstSlot).toHaveAttribute("aria-pressed","true");
  await expect(action).toBeEnabled();
  await dateInput.fill("2099-01-02");
  await expect(action).toBeDisabled();
  await expect(page.locator("button.slot[aria-pressed='true']")).toHaveCount(0);
  await dateInput.fill("2020-01-01");
  await expect(page.getByRole("alert")).toContainText("Selecione uma data atual ou futura");
  await expect(action).toBeDisabled();
});
