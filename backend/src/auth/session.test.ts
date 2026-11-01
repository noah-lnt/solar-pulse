import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSession } from './session';

test('reads the session cookie among others', () => {
  assert.equal(readSession('theme=dark; solarpulse_session=abc.def=; other=1'), 'abc.def=');
});

test('missing header or cookie gives null', () => {
  assert.equal(readSession(undefined), null);
  assert.equal(readSession('theme=dark'), null);
  assert.equal(readSession('solarpulse_session_old=x'), null);
});
