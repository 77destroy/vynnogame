'use strict';

const fs = require('fs');
const path = require('path');
const { defaultDb, writeDb, DB_PATH, ensureDb } = require('./db');

ensureDb();
writeDb(defaultDb());
console.log('База сброшена:', DB_PATH);
