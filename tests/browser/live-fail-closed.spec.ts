import {test,expect} from "@playwright/test";

test("without Firebase, a live build never falls back to synthetic studios",async({page})=>{
  await page.goto("/");
  await expect(page.getByRole("heading",{name:"Agendamento para profissionais de unhas"})).toBeVisible();
  await expect(page.getByRole("link",{name:"Conhecer DEMO"})).toHaveCount(0);
  await expect(page.getByText(/cobrança automática indisponível/i)).toBeVisible();
  await page.goto("/demo");
  await expect(page.getByRole("alert")).toContainText("Firebase não configurado.");
  await expect(page.getByText("Manicure clássica")).toHaveCount(0);
  await page.goto("/demo/book");
  await expect(page.getByRole("alert")).toContainText("Firebase não configurado.");
  await expect(page.getByRole("button",{name:"Solicitar agendamento"})).toHaveCount(0);
});
