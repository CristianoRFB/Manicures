import {defineConfig,devices} from "@playwright/test";

export default defineConfig({
  testDir:"./tests/browser",
  testMatch:"authenticated-demo.spec.ts",
  timeout:35_000,
  retries:1,
  fullyParallel:false,
  reporter:[["list"],["html",{outputFolder:"qa-report-auth",open:"never"}]],
  use:{baseURL:"http://127.0.0.1:5173",trace:"retain-on-failure",screenshot:"only-on-failure"},
  projects:[
    {name:"desktop-auth",use:{...devices["Desktop Chrome"],viewport:{width:1440,height:900}}},
    {name:"mobile-auth",use:{...devices["iPhone 13"],browserName:"chromium"}},
  ],
  webServer:{
    command:"npm run dev -- --host 127.0.0.1 --port 5173 --strictPort",
    url:"http://127.0.0.1:5173",
    reuseExistingServer:false,timeout:60_000,
    env:{...process.env,
      VITE_DEMO_MODE:"false",VITE_USE_FIREBASE_EMULATORS:"true",
      VITE_FIREBASE_API_KEY:"synthetic-key",VITE_FIREBASE_AUTH_DOMAIN:"manicure-demo.firebaseapp.com",
      VITE_FIREBASE_PROJECT_ID:"manicure-demo",VITE_FIREBASE_STORAGE_BUCKET:"manicure-demo.appspot.com",
      VITE_FIREBASE_MESSAGING_SENDER_ID:"123456",VITE_FIREBASE_APP_ID:"1:123456:web:synthetic",
      VITE_BOOKING_API_BASE_URL:"http://127.0.0.1:8787",
    },
  },
});
