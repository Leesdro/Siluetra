import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { prepareBrowser, browserLaunchOptions, cache } from './browser.mjs';
const executable=await prepareBrowser(), env=browserLaunchOptions(executable).env;
const {default:config}=await import('../playwright.config.mjs');
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const walk=d=>readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
if(process.platform!=='linux') throw Error('Canonical visual environment must be Linux; native browser is for functional debugging');
const record={
 image:'mcr.microsoft.com/playwright:v1.64.0-noble@sha256:bc72a8df40831ded821e3cbc79c318c21b44d6e51dff9fd89ace7a8249c5b462',
 node:process.version, os:readFileSync('/etc/os-release','utf8'),
 chromium:execFileSync(executable,['--version'],{env,encoding:'utf8'}).trim(),chromiumSha256:hash(executable),
 playwright:JSON.parse(readFileSync('node_modules/@playwright/test/package.json')).version,
 libraries:execFileSync('dpkg-query',['-W','libfontconfig1','libfreetype6'],{encoding:'utf8'}).trim(),
 fonts:walk(path.join(cache,'fonts')).filter(f=>/\.ttf$/.test(f)).sort().map(file=>({file:path.relative(cache,file),sha256:hash(file)})),
 fallback:execFileSync('fc-match',['-f','%{family}\n','sans-serif'],{env,encoding:'utf8'}).trim(),
 dpr:config.use.deviceScaleFactor, locale:config.use.locale,timezone:config.use.timezoneId,maxDiffPixelRatio:config.expect.toHaveScreenshot.maxDiffPixelRatio,threshold:config.expect.toHaveScreenshot.threshold
};
mkdirSync('qa/results',{recursive:true});writeFileSync('qa/results/environment.json',JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record,null,2));

const approved=JSON.parse(readFileSync('qa/baselines/environment.json','utf8'));
for(const [key,value] of Object.entries(approved)) assert.deepEqual(record[key],value,`Visual environment drift: ${key}; reproduce and review before changing provenance/baselines`);
