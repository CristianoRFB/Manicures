import {defineConfig,devices} from "@playwright/test";

export default defineConfig({
  testDir:"./tests/browser",
  testMatch:"*.spec.ts",
  timeout:30_000,
  retries:1,
  fullyParallel:false,
  reporter:[["list"],["html",{outputFolder:"qa-report",open:"never"}]],
  use:{baseURL:"http://127.0.0.1:5173",trace:"retain-on-failure",screenshot:"only-on-failure"},
  projects:[
    {name:"desktop-chromium",use:{...devices["Desktop Chrome"],viewport:{width:1440,height:900}}},
    {name:"mobile-chromium",use:{...devices["iPhone 13"],browserName:"chromium"}},
  ],
  webServer:{
    command:"npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
    url:"http://127.0.0.1:5173",
    reuseExistingServer:false,
    timeout:60_000,
    env:{...process.env,VITE_DEMO_MODE:"true",VITE_USE_FIREBASE_EMULATORS:"false",
      VITE_FIREBASE_API_KEY:"",VITE_FIREBASE_AUTH_DOMAIN:"",
      VITE_FIREBASE_PROJECT_ID:"",VITE_FIREBASE_APP_ID:""},
  },
});
