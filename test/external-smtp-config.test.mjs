import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateExternalSmtpConfig,encryptSmtpCredentials,decryptSmtpCredentials} from '../src/external-smtp-config.mjs';
const value={name:'Sales',email:'sender@example.com',server:'smtp.example.com',username:'user',password:'secret'};
const key=Buffer.alloc(32,23).toString('base64');
test('validates required fields and defaults to authenticated STARTTLS',()=>{
 const r=validateExternalSmtpConfig(value);assert.equal(r.port,587);assert.equal(r.security,'starttls');assert.equal(r.server,'smtp.example.com');
 assert.equal(validateExternalSmtpConfig({...value,port:465,security:'tls'}).port,465);
 for(const input of [{...value,password:''},{...value,email:'bad'}, {...value,port:25,security:'starttls'}, {...value,port:587,security:'plain'}, {...value,foo:'x'}])assert.throws(()=>validateExternalSmtpConfig(input));
});
test('rejects unsafe-looking servers and header injection without claiming DNS protection',()=>{
 for(const server of ['localhost','127.0.0.1','smtp.local','x.internal','x.test','https://smtp.example.com','smtp.example.com:587','smtp.example.com\r\nAUTH','[::1]','example.com.'])assert.throws(()=>validateExternalSmtpConfig({...value,server}),server);
 assert.throws(()=>validateExternalSmtpConfig({...value,name:'Name\r\nHeader: bad'}));
});
test('encrypts credentials with random nonces and account-and-connection binding',async()=>{
 const a=await encryptSmtpCredentials(value,key,'account-a','connection-a'),b=await encryptSmtpCredentials(value,key,'account-a','connection-a');
 assert.notEqual(a.iv,b.iv);assert.ok(!JSON.stringify(a).includes(value.password));
 assert.deepEqual(await decryptSmtpCredentials(a,key,'account-a','connection-a'),{username:'user',password:'secret'});
 for(const [account,connection] of [['account-b','connection-a'],['account-a','connection-b']])await assert.rejects(decryptSmtpCredentials(a,key,account,connection),/unavailable/);
});
test('rejects missing keys and modified ciphertext',async()=>{
 await assert.rejects(encryptSmtpCredentials(value,'','account-a','connection-a'),/unavailable/);
 const result=await encryptSmtpCredentials(value,key,'account-a','connection-a');const bytes=Buffer.from(result.ciphertext,'base64');bytes[0]^=1;result.ciphertext=bytes.toString('base64');
 await assert.rejects(decryptSmtpCredentials(result,key,'account-a','connection-a'),/unavailable/);
});
