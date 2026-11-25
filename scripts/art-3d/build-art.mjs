import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { openBrowser } from './browser.mjs';

const root=new URL('../../src/assets/3d/',import.meta.url);
const coverOnly=process.argv.includes('--cover');
if(!coverOnly)await prepareTexturesAndModels();
async function prepareTexturesAndModels(){
  await import('./build-models.mjs');
  await import('./build-rocks.mjs');
  // Retain painted tufts at a readable scale. Smooth the source grain and lift its shadows.
  await sharp(fileURLToPath(new URL('../../docs/3d/meadow-source.png',import.meta.url)))
    .resize(512,512).blur(.73).modulate({saturation:.67,brightness:1.19})
    .linear([.62,.66,.58],[84,92,72]).webp({quality:86}).toFile(fileURLToPath(new URL('meadow.webp',root)));
  const atlas=sharp(fileURLToPath(new URL('../../docs/3d/material-source.png',import.meta.url)));
  const {width,height}=await atlas.metadata(), half=Math.floor(Math.min(width,height)/2);
  await atlas.extract({left:0,top:height-half,width:half,height:half}).resize(512).blur(.7).modulate({saturation:.74}).linear(.78,43).webp({quality:85}).toFile(fileURLToPath(new URL('granite.webp',root)));
  await sharp(fileURLToPath(new URL('../../docs/3d/material-source.png',import.meta.url)))
    .extract({left:width-half,top:0,width:half,height:Math.floor(half/3)}).resize(480,160).blur(.65).modulate({saturation:.85}).linear(.87,28)
    .webp({quality:83}).toFile(fileURLToPath(new URL('cedar.webp',root)));
}
const session=await openBrowser();
try{
  const page=await session.browser.newPage();
  await page.goto(session.url+'/__wildgrid_art');
  const jobs=await page.evaluate(async()=>{window.studio=await import('/scripts/art-3d/studio.ts');return window.studio.jobs;});
  async function save(directory,name,bytes){
    const dir=new URL(directory+'/',root);await mkdir(dir,{recursive:true});
    await sharp(Buffer.from(bytes,'base64')).webp({quality:89,alphaQuality:100}).toFile(fileURLToPath(new URL(name+'.webp',dir)));
  }
  if(!coverOnly){
    for(const job of jobs)await save('icons',job.id+'-'+job.rotation+(job.plan?'-plan':''),await page.evaluate(job=>window.studio.icon(job),job));
    for(const name of ['home',...Array.from({length:4},(_,i)=>'chapter-'+i),...Array.from({length:60},(_,i)=>'day-'+(i+1))])
      await save('scenes',name,await page.evaluate(id=>window.studio.scenery(id),name));
  }
  const frames=[],count=48;
  for(let i=0;i<count;i++){
    const bytes=await page.evaluate(phase=>window.studio.scenery('home',phase),i/count);
    frames.push(await sharp(Buffer.from(bytes,'base64')).ensureAlpha().raw().toBuffer());
  }
  await sharp(Buffer.concat(frames),{raw:{width:720,height:468*count,pageHeight:468,channels:4}})
    .webp({quality:84,loop:0,delay:Array(count).fill(90)}).toFile(fileURLToPath(new URL('scenes/home-motion.webp',root)));
  console.log(`Rendered ${count} frames for the looping camp cover.`);
}finally{await session.close();}
