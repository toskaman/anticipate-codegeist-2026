import { test, expect } from '@playwright/test';
test('complete local demo journey without external mutations',async({page})=>{
 const mutations:string[]=[];page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()) && !r.url().startsWith('http://127.0.0.1')) mutations.push(r.url())});
 await page.goto('/');await expect(page.getByRole('heading',{name:'Mission Control',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Switch theme'}).click();await expect(page.locator('.app')).toHaveAttribute('data-theme','light');
 await page.getByRole('navigation').getByRole('button',{name:'Evidence Graph',exact:true}).click();await page.getByLabel('Evidence classification').selectOption('UNKNOWN');await expect(page.getByRole('button',{name:'Customer Support Integration UNKNOWN'})).toBeVisible();
 await page.getByLabel('Search dependencies').fill('no match');await expect(page.getByRole('status')).toContainText('No dependencies');
 await page.getByRole('navigation').getByRole('button',{name:'Scenario Lab',exact:true}).click();await page.getByLabel('Selected scenario').selectOption('A');await expect(page.getByText(/Checkout still calls v1/)).toBeVisible();await page.getByLabel('Selected scenario').selectOption('C');
 await page.getByRole('navigation').getByRole('button',{name:'Prevention Plan',exact:true}).click();await page.getByRole('button',{name:'Approve local demo plan'}).click();await page.getByRole('button',{name:'Confirm',exact:true}).click();await page.getByRole('button',{name:'Simulate execution'}).click();await page.getByRole('button',{name:'Open Prevention Passport'}).click();await expect(page.getByRole('heading',{name:'AUTH-142',exact:true})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export demo JSON'}).click();expect((await download).suggestedFilename()).toContain('DEMO');expect(mutations).toEqual([]);
});
for(const width of [1440,1024,390]) test(`responsive ${width}`,async({page})=>{await page.setViewportSize({width,height:1000});await page.goto('/');await expect(page.getByRole('heading',{name:'Mission Control',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`../../evidence/mission-${width}.png`,fullPage:true})});

