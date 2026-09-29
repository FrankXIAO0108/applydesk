import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {verifyDownload} from '../scripts/npm-runtime.mjs';
test('bootstrap refuses tampered archive and unsupported integrity algorithms',()=>{const bytes=Buffer.from('fixture archive'),integrity='sha512-'+createHash('sha512').update(bytes).digest('base64');assert.doesNotThrow(()=>verifyDownload(bytes,integrity));assert.throws(()=>verifyDownload(Buffer.from('changed archive'),integrity));assert.throws(()=>verifyDownload(bytes,'sha1-untrusted'));});
