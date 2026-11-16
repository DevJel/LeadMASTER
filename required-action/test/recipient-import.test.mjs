import {test} from 'node:test';import assert from 'node:assert/strict';import {extractRecipientEmails} from '../src/recipient-import.mjs';
test('finds and deduplicates emails while ignoring names in messy CSV and text',()=>{
 const input='Full Name, Email\n"Doe, Jane", "Jane+test@Example.COM"\nOther;BOB@example.org; note\nJane+test@example.com\nName <third@example.net>.';
 assert.deepEqual(extractRecipientEmails(input),['jane+test@example.com','bob@example.org','third@example.net']);
});
test('ignores invalid local parts and domains rather than extracting fragments',()=>{
 const input='bad..dots@example.com a@bad..host x@@example.org üser@example.com person@-bad.com x@a.invalid_foo x@a.123';
 assert.deepEqual(extractRecipientEmails(input),[]);
});
test('accepts conservative aliases and hyphenated domains',()=>{
 assert.deepEqual(extractRecipientEmails('A_B+tag@sub-domain.example and test.o\'clock@example.co.uk'),['a_b+tag@sub-domain.example',"test.o'clock@example.co.uk"]);
});
