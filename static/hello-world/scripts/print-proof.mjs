import {chromium} from '@playwright/test';
const b=await chromium.launch();
try {
 const context=await b.newContext();const page=await context.newPage();
 await page.goto('http://127.0.0.1:3000/#Prevention%20Plan');
 await page.getByRole('button',{name:'Approve local demo plan'}).click();
 await page.getByRole('button',{name:'Confirm',exact:true}).click();
 await page.getByRole('button',{name:'Simulate execution'}).click();
 await page.getByRole('button',{name:'Open Prevention Passport'}).click();
 await page.getByRole('heading',{name:'AUTH-142',exact:true}).waitFor();
 await page.pdf({path:'../../output/pdf/anticipate-demo-passport.pdf',format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:true,headerTemplate:'<span></span>',footerTemplate:'<div style="font-size:9px;width:100%;text-align:center">DEMO DATA - fictional local report | <span class="pageNumber"></span> / <span class="totalPages"></span></div>'});
} finally {await b.close()}
