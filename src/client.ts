// whatsappClient.ts
import { Client } from 'whatsapp-web.js';
import { LocalAuth } from 'whatsapp-web.js';
import constants from './constants';

const client = new Client({
  puppeteer: {
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ["--no-sandbox"]
  },
  authStrategy: new LocalAuth({
    clientId: undefined,
    dataPath: constants.sessionPath
  })
});

export default client;
