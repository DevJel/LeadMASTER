import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sesConfigurationHealth } from '../src/ses-smtp.mjs';
const env={SES_SMTP_HOST:'email-smtp.ap-southeast-2.amazonaws.com',SES_SMTP_USERNAME:'test-user',SES_SMTP_PASSWORD:'test-password',SES_FROM_EMAIL:'noreply@leadmaster.jelvan.pro'};
test('valid mail configuration passes without exposing its contents',async()=>{
 const health=await sesConfigurationHealth(env);assert.deepEqual(health,{smtpConfigured:true,fromConfigured:true});assert.doesNotMatch(JSON.stringify(health),/test-user|test-password|noreply/);
});
test('missing, malformed or unreadable configuration fails closed',async()=>{
 for(const value of ['',undefined,'bad\r\nheader',{get:async()=>{throw Error('unavailable')}}])assert.equal((await sesConfigurationHealth({...env,SES_SMTP_PASSWORD:value})).smtpConfigured,false);
 for(const value of ['a@localhost','a@a..com','no spaces@example.com','a@example.com\r\nBcc:x@example.com',''])assert.equal((await sesConfigurationHealth({...env,SES_FROM_EMAIL:value})).fromConfigured,false,value);
 assert.equal((await sesConfigurationHealth({...env,SES_SMTP_HOST:'evil.example.com'})).smtpConfigured,false);
});
test('health endpoint returns only readiness flags and uses correct HTTP status',async()=>{
 const source=await readFile(new URL('../src/email-coordinator.mjs',import.meta.url),'utf8');
 const health=source.slice(source.indexOf("if(request.method==='GET'"),source.indexOf("if(request.method!=='POST')"));
 assert.match(health,/sesConfigurationHealth\(this.env\)/);assert.match(health,/status:healthy\?200:503/);assert.doesNotMatch(health,/SES_SMTP_PASSWORD\s*:/);
});
