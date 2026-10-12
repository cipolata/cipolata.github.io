const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');

const ROOT = __dirname;
const PDF_DIR = path.join(ROOT, 'Pdf');
const MINIGAME_DIR = path.join(ROOT, 'Minigames');
const QUESTION_MEDIA_DIR = path.join(ROOT, 'QuestionMedia');
const TILE_SETTINGS_FILE = path.join(MINIGAME_DIR, 'tile-settings.json');
const PORT = Number(process.env.PORT) || 4173;
const MAX_PDF_SIZE = 50 * 1024 * 1024;
const MAX_MINIGAME_SIZE = 10 * 1024 * 1024;
const MAX_QUESTION_MEDIA_SIZE = 100 * 1024 * 1024;
const PDF_FILENAME_PATTERN = /^category-[1-6]-question-[1-5]-(question|answer)\.pdf$/;
const MINIGAME_FILENAME_PATTERN = /^category-[1-6]-question-[1-5]\.html$/;
const QUESTION_MEDIA_FILENAME_PATTERN = /^category-[1-6]-question-[1-5]-(video\.mp4|audio\.mp3)$/;
const TILE_TYPES = new Set(['question', 'minigame', 'joker']);
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

async function readRequestBody(request, maxSize) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxSize) {
      const error = new Error('Request body exceeds size limit');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function validateTileSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const settings = {};
  for (const [key, setting] of Object.entries(value)) {
    if (!/^([0-5]):([0-4])$/.test(key) || !setting || !TILE_TYPES.has(setting.type)) {
      return null;
    }
    const cleanSetting = { type: setting.type };
    for (const textField of ['questionText', 'answerText']) {
      if (setting[textField] !== undefined) {
        if (typeof setting[textField] !== 'string' || setting[textField].length > 10000) {
          return null;
        }
        cleanSetting[textField] = setting[textField];
      }
    }
    if (setting.jokerBonus !== undefined || setting.type === 'joker') {
      if (!Number.isInteger(setting.jokerBonus) || setting.jokerBonus < 1 || setting.jokerBonus > 100000) {
        return null;
      }
      cleanSetting.jokerBonus = setting.jokerBonus;
    }
    if (setting.minigameUploaded !== undefined || setting.type === 'minigame') {
      if (setting.minigameUploaded !== undefined && typeof setting.minigameUploaded !== 'boolean') {
        return null;
      }
      cleanSetting.minigameUploaded = setting.minigameUploaded === true;
    }
    settings[key] = cleanSetting;
  }
  return settings;
}

async function handleTileSettingsApi(request, response) {
  if (request.method === 'GET') {
    try {
      const settings = JSON.parse(await fs.promises.readFile(TILE_SETTINGS_FILE, 'utf8'));
      sendJson(response, 200, settings);
    } catch (error) {
      if (error.code === 'ENOENT') {
        sendJson(response, 200, {});
      } else {
        throw error;
      }
    }
    return;
  }
  if (request.method !== 'PUT') {
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }
  let settings;
  try {
    settings = validateTileSettings(JSON.parse((await readRequestBody(request, 1024 * 1024)).toString('utf8')));
  } catch (error) {
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: 'Invalid settings JSON' });
      return;
    }
    throw error;
  }
  if (!settings) {
    sendJson(response, 400, { error: 'Invalid tile settings' });
    return;
  }
  const temporaryPath = TILE_SETTINGS_FILE + '.' + crypto.randomUUID() + '.tmp';
  try {
    await fs.promises.writeFile(temporaryPath, JSON.stringify(settings, null, 2));
    await fs.promises.rename(temporaryPath, TILE_SETTINGS_FILE);
    sendJson(response, 200, settings);
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true });
    throw error;
  }
}

function getMinigameFilename(pathname) {
  const match = pathname.match(/^\/api\/minigames\/([^/]+)$/);
  if (!match) {
    return null;
  }
  let filename;
  try {
    filename = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return MINIGAME_FILENAME_PATTERN.test(filename) ? filename : null;
}

async function handleMinigameApi(request, response, pathname) {
  const filename = getMinigameFilename(pathname);
  if (!filename) {
    sendJson(response, 404, { error: 'Minigame endpoint not found' });
    return;
  }
  const destination = path.join(MINIGAME_DIR, filename);
  if (request.method === 'DELETE') {
    try {
      await fs.promises.unlink(destination);
      response.writeHead(204);
      response.end();
    } catch (error) {
      if (error.code === 'ENOENT') {
        sendJson(response, 404, { error: 'Minigame not found' });
      } else {
        throw error;
      }
    }
    return;
  }
  if (request.method !== 'PUT') {
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }
  if (!/^text\/html(?:;|$)/i.test(request.headers['content-type'] || '')) {
    sendJson(response, 415, { error: 'Expected an HTML upload' });
    return;
  }
  const body = await readRequestBody(request, MAX_MINIGAME_SIZE);
  const temporaryPath = path.join(MINIGAME_DIR, '.' + crypto.randomUUID() + '.tmp');
  try {
    await fs.promises.writeFile(temporaryPath, body);
    await fs.promises.rename(temporaryPath, destination);
    sendJson(response, 200, { filename });
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true });
    throw error;
  }
}

function getQuestionMediaFilename(pathname) {
  const match = pathname.match(/^\/api\/question-media\/([^/]+)$/);
  if (!match) {
    return null;
  }
  let filename;
  try {
    filename = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return QUESTION_MEDIA_FILENAME_PATTERN.test(filename) ? filename : null;
}

async function handleQuestionMediaApi(request, response, pathname) {
  if (pathname === '/api/question-media' && request.method === 'GET') {
    const entries = await fs.promises.readdir(QUESTION_MEDIA_DIR, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && QUESTION_MEDIA_FILENAME_PATTERN.test(entry.name))
      .map((entry) => entry.name);
    sendJson(response, 200, { files });
    return;
  }

  const filename = getQuestionMediaFilename(pathname);
  if (!filename) {
    sendJson(response, 404, { error: 'Question media endpoint not found' });
    return;
  }
  const destination = path.join(QUESTION_MEDIA_DIR, filename);
  if (request.method === 'DELETE') {
    try {
      await fs.promises.unlink(destination);
      response.writeHead(204);
      response.end();
    } catch (error) {
      if (error.code === 'ENOENT') {
        sendJson(response, 404, { error: 'Media file not found' });
      } else {
        throw error;
      }
    }
    return;
  }

  if (request.method !== 'PUT' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, PUT, POST, DELETE');
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }
  const expectedType = filename.endsWith('.mp4') ? 'video/mp4' : 'audio/mpeg';
  if (request.headers['content-type'] !== expectedType) {
    sendJson(response, 415, { error: 'Unexpected media content type' });
    return;
  }
  const body = await readRequestBody(request, MAX_QUESTION_MEDIA_SIZE);
  const temporaryPath = path.join(QUESTION_MEDIA_DIR, '.' + crypto.randomUUID() + '.tmp');
  try {
    await fs.promises.writeFile(temporaryPath, body);
    await fs.promises.rename(temporaryPath, destination);
    sendJson(response, 200, { filename });
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true });
    throw error;
  }
}

function getPdfFilename(pathname) {
  const match = pathname.match(/^\/api\/pdfs\/([^/]+)$/);
  if (!match) {
    return null;
  }
  let filename;
  try {
    filename = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return PDF_FILENAME_PATTERN.test(filename) ? filename : null;
}

async function handlePdfApi(request, response, pathname) {
  if (pathname === '/api/pdfs' && request.method === 'GET') {
    const entries = await fs.promises.readdir(PDF_DIR, { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && PDF_FILENAME_PATTERN.test(entry.name))
      .map((entry) => entry.name);
    sendJson(response, 200, { files });
    return;
  }

  const filename = getPdfFilename(pathname);
  if (!filename) {
    sendJson(response, 404, { error: 'PDF endpoint not found' });
    return;
  }

  const destination = path.join(PDF_DIR, filename);
  if (request.method === 'DELETE') {
    try {
      await fs.promises.unlink(destination);
      response.writeHead(204);
      response.end();
    } catch (error) {
      if (error.code === 'ENOENT') {
        sendJson(response, 404, { error: 'PDF not found' });
      } else {
        throw error;
      }
    }
    return;
  }

  if (request.method !== 'PUT' && request.method !== 'POST') {
    response.setHeader('Allow', 'GET, PUT, POST, DELETE');
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }
  if (request.headers['content-type'] !== 'application/pdf') {
    sendJson(response, 415, { error: 'Expected an application/pdf upload' });
    return;
  }
  if (Number(request.headers['content-length']) > MAX_PDF_SIZE) {
    sendJson(response, 413, { error: 'PDF exceeds the 50 MB limit' });
    request.resume();
    return;
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_PDF_SIZE) {
      sendJson(response, 413, { error: 'PDF exceeds the 50 MB limit' });
      request.resume();
      return;
    }
    chunks.push(chunk);
  }

  const temporaryPath = path.join(PDF_DIR, '.' + crypto.randomUUID() + '.tmp');
  try {
    await fs.promises.writeFile(temporaryPath, Buffer.concat(chunks));
    await fs.promises.rename(temporaryPath, destination);
    sendJson(response, 200, { filename });
  } catch (error) {
    await fs.promises.rm(temporaryPath, { force: true });
    throw error;
  }
}

async function serveStatic(request, response, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'Method not allowed' });
    return;
  }

  const decodedPath = decodeURIComponent(pathname);
  const requestedPath = decodedPath === '/' ? '/index.html' : decodedPath;
  const filePath = path.resolve(ROOT, '.' + requestedPath);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    sendJson(response, 403, { error: 'Forbidden' });
    return;
  }

  let stat;
  try {
    stat = await fs.promises.stat(filePath);
    if (stat.isDirectory()) {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }
  } catch (error) {
    if (error.code === 'ENOENT') {
      sendJson(response, 404, { error: 'Not found' });
      return;
    }
    throw error;
  }

  response.writeHead(200, {
    'Content-Length': stat.size,
    'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  fs.createReadStream(filePath).pipe(response);
}

async function handleRequest(request, response) {
  let pathname;
  try {
    pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    if (pathname === '/api/tile-settings') {
      await handleTileSettingsApi(request, response);
      return;
    }
    if (pathname === '/api/question-media' || pathname.startsWith('/api/question-media/')) {
      await handleQuestionMediaApi(request, response, pathname);
      return;
    }
    if (pathname.startsWith('/api/minigames')) {
      await handleMinigameApi(request, response, pathname);
      return;
    }
    if (pathname.startsWith('/api/pdfs')) {
      await handlePdfApi(request, response, pathname);
      return;
    }
    await serveStatic(request, response, pathname);
  } catch (error) {
    if (!response.headersSent) {
      sendJson(response, error.statusCode || 500, { error: error.statusCode === 413 ? error.message : 'Server error' });
    } else {
      response.destroy(error);
    }
    console.error(error);
  }
}

fs.mkdirSync(PDF_DIR, { recursive: true });
fs.mkdirSync(MINIGAME_DIR, { recursive: true });
fs.mkdirSync(QUESTION_MEDIA_DIR, { recursive: true });
http.createServer(handleRequest).listen(PORT, '127.0.0.1', () => {
  console.log('Jeopardy server running at http://127.0.0.1:' + PORT);
});