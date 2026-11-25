import { chromium } from 'playwright-core';
import { createServer } from 'vite';

// Use an isolated localhost origin and throwaway browser profile for both studio and QA.
export async function openBrowser() {
  const server=await createServer({server:{host:'127.0.0.1',port:0,open:false},logLevel:'error'});
  server.middlewares.use('/__wildgrid_art',(_req,res)=>{res.setHeader('Content-Type','text/html');res.end('<html><body style="margin:0"></body></html>');});
  await server.listen();
  try {
    const browser=await chromium.launch({channel:process.env.WILDGRID_BROWSER_CHANNEL||'chrome',headless:true,
      args:['--enable-unsafe-swiftshader','--disable-background-timer-throttling']});
    return {browser,url:server.resolvedUrls.local[0].replace(/\/$/,''),close:async()=>{await browser.close();await server.close();}};
  }catch(error){await server.close();throw error;}
}
