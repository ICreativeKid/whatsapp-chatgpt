import process from "process";
import {Client, MessageMedia} from "whatsapp-web.js"
import { TranscriptionMode } from "./types/transcription-mode";
import { TTSMode } from "./types/tts-mode";
import { AWSPollyEngine } from "./types/aws-polly-engine";
import fs from "fs";
import * as sqlite3 from "sqlite3";
import { open } from "sqlite";
import ytdl from 'ytdl-core';
import TikTokScraper from 'tiktok-scraper';
import fetch from 'node-fetch';
import axios from 'axios';
import tmp from 'tmp';
import  Instagram  from 'instagram-web-api';

// Environment variables
import dotenv from 'dotenv';

const dbPromise = open({ filename: "configs.db", driver: sqlite3.Database });
(async () => {
	const db = await dbPromise;
	await db.exec(`
	CREATE TABLE IF NOT EXISTS user_configs (
		phone TEXT PRIMARY KEY,
		openAIAPIKey TEXT,
		openAIModel TEXT,
		dalleSize TEXT,
		maxModelTokens INTEGER,
		prePrompt TEXT,
		dalleModel TEXT,
		replicateAPI TEXT,
		prefixEnabled INTEGER,
		prefixSkippedForMe INTEGER,
		gptPrefix TEXT,
		dallePrefix TEXT,
		resetPrefix TEXT,
		aiConfigPrefix TEXT,
		groupchatsEnabled INTEGER,
		promptModerationEnabled INTEGER,
		promptModerationBlacklistedCategories TEXT,
		awsAccessKeyId TEXT,
		awsSecretAccessKey TEXT,
		awsRegion TEXT,
		awsPollyVoiceId TEXT,
		awsPollyEngine TEXT,
		speechServerUrl TEXT,
		whisperServerUrl TEXT,
		openAIServerUrl TEXT,
		whisperApiKey TEXT,
		ttsEnabled INTEGER,
		ttsMode TEXT,
		transcriptionEnabled INTEGER,
		transcriptionMode TEXT,
		transcriptionLanguage TEXT,
		userInteractions INTEGER,
		authorized INTEGER,
		limitedInteractions INTEGER,
		urlShorten TEXT,
		isFirstTime INTEGER,
		authorizedCommand INTEGER
	  );
	  
	`);
  })();

dotenv.config();

// Config Interface
export interface IConfig {
	// OpenAI
	openAIAPIKey: string;
	openAIModel: string;
	dalleSize: string;
	maxModelTokens: number;
	prePrompt?: string;
	dalleModel: string;
	replicateAPI: string;

	// Prefix
	prefixEnabled: boolean;
	prefixSkippedForMe: boolean;
	gptPrefix: string;
	dallePrefix: string;
	resetPrefix: string;
	aiConfigPrefix: string;

	// Groupchats
	groupchatsEnabled: boolean;

	// Prompt Moderation
	promptModerationEnabled: boolean;
	promptModerationBlacklistedCategories: string[];

	// AWS
	awsAccessKeyId: string;
	awsSecretAccessKey: string;
	awsRegion: string;
	awsPollyVoiceId: string;
	awsPollyEngine: AWSPollyEngine;

	// Voice transcription & Text-to-Speech
	speechServerUrl: string;
	whisperServerUrl: string;
	openAIServerUrl: string;
	whisperApiKey: string;
	ttsEnabled: boolean;
	ttsMode: TTSMode;
	transcriptionEnabled: boolean;
	transcriptionMode: TranscriptionMode;
	transcriptionLanguage: string;

	// user configs
	userInteractions: number;
	authorized: boolean;
	limitedInteractions: number;
	phone?: string;

	//other configs
	urlShorten: string;
	isFirstTime: boolean;
	authorizedCommand: boolean;
	langChainPrefix: string;
	searchTool: boolean;


}

// Config
const defaultConfig: IConfig = {
	openAIAPIKey: process.env.OPENAI_API_KEY || "", // Default: ""
	openAIModel: process.env.OPENAI_GPT_MODEL || "gpt-3.5-turbo", // Default: gpt-3.5-turbo
	dalleSize: process.env.OPENAI_GPT_SIZE || "256x256", // Default: 256x256
	maxModelTokens: getEnvMaxModelTokens(), // Default: 4096
	prePrompt: process.env.PRE_PROMPT, // Default: undefined
	dalleModel: process.env.DALLE_MODEL || "DALLE",
	replicateAPI: process.env.REPLICATE_API_TOKEN || "",

	// Prefix
	prefixEnabled: getEnvBooleanWithDefault("PREFIX_ENABLED", true), // Default: true
	prefixSkippedForMe: getEnvBooleanWithDefault("PREFIX_SKIPPED_FOR_ME", true), // Default: true
	gptPrefix: process.env.GPT_PREFIX || ".gpt", // Default: .gpt
	dallePrefix: process.env.DALLE_PREFIX || ".dalle", // Default: .dalle
	resetPrefix: process.env.RESET_PREFIX || ".reset", // Default: .reset
	aiConfigPrefix: process.env.AI_CONFIG_PREFIX || ".config", // Default: .config

	// Groupchats
	groupchatsEnabled: getEnvBooleanWithDefault("GROUPCHATS_ENABLED", false), // Default: false

	// Prompt Moderation
	promptModerationEnabled: getEnvBooleanWithDefault("PROMPT_MODERATION_ENABLED", false), // Default: false
	promptModerationBlacklistedCategories: getEnvPromptModerationBlacklistedCategories(), // Default: ["hate", "hate/threatening", "self-harm", "sexual", "sexual/minors", "violence", "violence/graphic"]

	// AWS
	awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "", // Default: ""
	awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "", // Default: ""
	awsRegion: process.env.AWS_REGION || "", // Default: ""
	awsPollyVoiceId: process.env.AWS_POLLY_VOICE_ID || "", // Default: "Joanna"
	awsPollyEngine: getEnvAWSPollyVoiceEngine(), // Default: standard

	// Speech API, Default: https://speech-service.verlekar.com
	speechServerUrl: process.env.SPEECH_API_URL || "https://speech-service.verlekar.com",
	whisperServerUrl: process.env.WHISPER_API_URL || "https://transcribe.whisperapi.com",
	openAIServerUrl: process.env.OPENAI_API_URL || "https://api.openai.com/v1/audio/transcriptions",
	whisperApiKey: process.env.WHISPER_API_KEY || "", // Default: ""

	// Text-to-Speech
	ttsEnabled: getEnvBooleanWithDefault("TTS_ENABLED", false), // Default: false
	ttsMode: getEnvTTSMode(), // Default: speech-api

	// Transcription
	transcriptionEnabled: getEnvBooleanWithDefault("TRANSCRIPTION_ENABLED", false), // Default: false
	transcriptionMode: getEnvTranscriptionMode(), // Default: local
	transcriptionLanguage: process.env.TRANSCRIPTION_LANGUAGE || "" ,// Default: null

	// user usage
	userInteractions: 0,
	authorized: false,
	limitedInteractions: 10,

	//other configs
	urlShorten: "bitly",
	isFirstTime: true,
	authorizedCommand: false,
	langChainPrefix: process.env.LANGCHAIN_PREFIX || "!lang", // Default: !lang
	searchTool: false


};

/**
 * Get the max model tokens from the environment variable
 * @returns The max model tokens from the environment variable or 4096
 */
function getEnvMaxModelTokens() {
	const envValue = process.env.MAX_MODEL_TOKENS;
	if (envValue == undefined || envValue == "") {
		return 4096;
	}

	return parseInt(envValue);
}


/**
 * Get an environment variable as a boolean with a default value
 * @param key The environment variable key
 * @param defaultValue The default value
 * @returns The value of the environment variable or the default value
 */
function getEnvBooleanWithDefault(key: string, defaultValue: boolean): boolean {
	const envValue = process.env[key]?.toLowerCase();
	if (envValue == undefined || envValue == "") {
		return defaultValue;
	}

	return envValue == "true";
}

/**
 * Get the blacklist categories for prompt moderation from the environment variable
 * @returns Blacklisted categories for prompt moderation
 */
function getEnvPromptModerationBlacklistedCategories(): string[] {
	const envValue = process.env.PROMPT_MODERATION_BLACKLISTED_CATEGORIES;
	if (envValue == undefined || envValue == "") {
		return ["hate", "hate/threatening", "self-harm", "sexual", "sexual/minors", "violence", "violence/graphic"];
	} else {
		return JSON.parse(envValue.replace(/'/g, '"'));
	}
}

/**
 * Get the transcription mode from the environment variable
 * @returns The transcription mode
 */
function getEnvTranscriptionMode(): TranscriptionMode {
	const envValue = process.env.TRANSCRIPTION_MODE?.toLowerCase();
	if (envValue == undefined || envValue == "") {
		return TranscriptionMode.Local;
	}

	return envValue as TranscriptionMode;
}

/**
 * Get the tss mode from the environment variable
 * @returns The tts mode
 */
function getEnvTTSMode(): TTSMode {
	const envValue = process.env.TTS_MODE?.toLowerCase();
	if (envValue == undefined || envValue == "") {
		return TTSMode.SpeechAPI;
	}

	return envValue as TTSMode;
}

/**
 * Get the AWS Polly voice engine from the environment variable
 * @returns The voice engine
 */
function getEnvAWSPollyVoiceEngine(): AWSPollyEngine {
	const envValue = process.env.AWS_POLLY_VOICE_ENGINE?.toLowerCase();
	if (envValue == undefined || envValue == "") {
		return AWSPollyEngine.Standard;
	}

	return envValue as AWSPollyEngine;
}


// Define setter functions

async function setTtsMode(config: IConfig, ttsMode: TTSMode, userPhone: string) {  
	const userConfig = await getUserConfig(userPhone);
	userConfig.ttsMode = ttsMode;
	await setUserConfig(userPhone, userConfig);
	config.ttsMode = ttsMode;
}

async function setFirstTime(config: IConfig, value: boolean, userPhone: string) {  
	const userConfig = await getUserConfig(userPhone);
	userConfig.isFirstTime = value;
	await setUserConfig(userPhone, userConfig);
	userConfig.isFirstTime = value;
}

async function setGptModel(config: IConfig, value: string, userPhone: string) {  
	const userConfig = await getUserConfig(userPhone);
	userConfig.openAIModel = value;
	await setUserConfig(userPhone, userConfig);
	config.openAIModel = value;
}

async function setSearchTool(config: IConfig, value: boolean, userPhone: string) {  
	const userConfig = await getUserConfig(userPhone);
	userConfig.searchTool = value;
	await setUserConfig(userPhone, userConfig);
	config.searchTool = value;
}

async function setImgModel(config: IConfig, value: string, userPhone: string) {  
	const userConfig = await getUserConfig(userPhone);
	userConfig.dalleModel = value;
	await setUserConfig(userPhone, userConfig);
	config.dalleModel = value;
}

async function setDalleSize(config: IConfig, value: string, userPhone: string) {
    const userConfig = await getUserConfig(userPhone);
    userConfig.dalleSize = value;
    await setUserConfig(userPhone, userConfig);
    config.dalleSize = value;
}

async function setTtsVoiceId(config: IConfig, value: string, userPhone: string) {  
	const userConfig = await getUserConfig(userPhone);
	userConfig.awsPollyVoiceId = value;
	await setUserConfig(userPhone, userConfig);
	config.awsPollyVoiceId = value;
}

async function setPrefixEnabled(config: IConfig, value: boolean, userPhone: string) {  
	const userConfig = await getUserConfig(userPhone);
	userConfig.prefixEnabled = value;
	await setUserConfig(userPhone, userConfig);
	config.prefixEnabled = value;
}

async function setTranscriptionEnabled(config: IConfig, value: boolean, userPhone: string) {
	const userConfig = await getUserConfig(userPhone);
	userConfig.transcriptionEnabled = value;
	await setUserConfig(userPhone, userConfig);
	config.transcriptionEnabled = value;
}

async function setTranscriptionMode(config: IConfig, value: TranscriptionMode, userPhone: string) {
	const userConfig = await getUserConfig(userPhone);
	userConfig.transcriptionMode = value;
	await setUserConfig(userPhone, userConfig);
	config.transcriptionMode = value;
}

async function setPrePrompt(config: IConfig, value: undefined, userPhone: string) {
	const userConfig = await getUserConfig(userPhone);
	userConfig.prePrompt = value;
	await setUserConfig(userPhone, userConfig);
	config.prePrompt = value;
}

async function setTTSEnabled(config: IConfig, value: boolean, userPhone: string) {
	const userConfig = await getUserConfig(userPhone);
	userConfig.ttsEnabled = value;
	await setUserConfig(userPhone, userConfig);
	config.ttsEnabled = value;
}

async function authorizedUser(config: IConfig, value: boolean, userPhone: string) {
	const userConfig = await getUserConfig(userPhone);
	userConfig.authorized = value;
	await setUserConfig(userPhone, userConfig);
	config.authorized = value;
}

async function authorizedUserCommand(config: IConfig, value: boolean, userPhone: string) {
	const userConfig = await getUserConfig(userPhone);
	userConfig.authorizedCommand = value;
	await setUserConfig(userPhone, userConfig);
	config.authorizedCommand = value;
}

async function isAuthorizedCommand(phoneNumber: string, config: any): Promise<boolean> {
	const userConfig = await getUserConfig(phoneNumber);
	return userConfig && userConfig.authorizedCommand === true;
 }
 

async function isAuthorized(phoneNumber: string, config: any): Promise<boolean> {
	const userConfig = await getUserConfig(phoneNumber);
	return userConfig && userConfig.authorized === true;
 }
 
 async function addInteractions(config: IConfig, value: number, userPhone: string) {
	const userConfig = await getUserConfig(userPhone);
	userConfig.userInteractions += value;
	await setUserConfig(userPhone, userConfig);
	config.userInteractions += value;
	}

async function resetInteractions(config: IConfig, value: number, userPhone: string) {
	const userConfig = await getUserConfig(userPhone);
	userConfig.userInteractions = 0;
	await setUserConfig(userPhone, userConfig);
	config.userInteractions = 0;

 }

 async function setLimitedInteractions(config: IConfig, value: number, userPhone: string) {
	const userConfig = await getUserConfig(userPhone);
	userConfig.limitedInteractions = value;
	await setUserConfig(userPhone, userConfig);
	config.limitedInteractions = value;
  }

async function setPlatforUrl(config: IConfig, value: string, userPhone: string) {
	const userConfig = await getUserConfig(userPhone);
	userConfig.urlShorten = value;
	await setUserConfig(userPhone, userConfig);
	config.urlShorten = value;
  }

 
  
  async function shortenLinkEncurtador(client, message, link) {
	try {
	  const response = await axios.post('https://api.encurtador.dev/encurtamentos', {
		url: link
	  });
	  let linkEncurtado = response.data.urlEncurtada;
  
	  // Verifica se o link encurtado já possui "http://" ou "https://"
	  if (!/^https?:\/\//i.test(linkEncurtado)) {
		linkEncurtado = 'http://' + linkEncurtado;
	  }
  
	  message.reply(`🔗 URL:\n\n${linkEncurtado}`);
	  return linkEncurtado;
	} catch (error) {
	  console.error(error);
	  message.reply(
		'💬 _Ocorreu um erro ao encurtar o link. Por favor, tente novamente mais tarde_\n\n'+
		'💬 _An error occurred while shortening the link. Please try again later_');
	  return null;
	}
  }
  
  async function shortenLinkBitly(client, message, link) {
	const bitlyAccessToken = 'f54745de98c5567929de5d0dffc937a82572d7fd'
	try {
	  const response = await axios.post(
		'https://api-ssl.bitly.com/v4/shorten',
		{
		  long_url: link,
		},
		{
		  headers: {
			Authorization: `Bearer ${bitlyAccessToken}`,
			'Content-Type': 'application/json',
		  },
		}
	  );
  
	  const linkEncurtado = response.data.link;
	  message.reply(`🔗 URL:\n\n${linkEncurtado}`);
	  return linkEncurtado;
	} catch (error) {
	  console.error(error);
		message.reply(
			'💬 _Ocorreu um erro ao encurtar o link. Por favor, tente novamente mais tarde_\n\n'+
			'💬 _An error occurred while shortening the link. Please try again later_');
	  return null;
	}
  }

  async function shortenLinkCuttly(client, message, link) {
	const cuttlyApiKey = '8839e0e42087b12132e3ae5da2f253acc1325'
	try {
		const response = await axios.get('https://cutt.ly/api/api.php', {
		  params: {
			key: cuttlyApiKey,
			short: link,
		  },
		});
	
		console.log('Cutt.ly full response:', response.data);
	
		const resultCode = response.data.url.status;
		if (resultCode === 7) {
		  const linkEncurtado = response.data.url.shortLink;
		  message.reply(`🔗 URL:\n\n${linkEncurtado}`);
		  return linkEncurtado;
		} else {
		  console.error('Cutt.ly error:', resultCode);
		  message.reply(
			'💬 _Ocorreu um erro ao encurtar o link. Por favor, tente novamente mais tarde_\n\n'+
			'💬 _An error occurred while shortening the link. Please try again later_');
		  return null;
		}
	  } catch (error) {
		console.error(error);
		message.reply(
			'Ocorreu um erro ao encurtar o link. Por favor, tente novamente mais tarde\n'+
			'_An error occurred while shortening the link. Please try again later_');
		return null;
	  }
	}



	async function getUserConfig(userPhone: string): Promise<IConfig> {
		const db = await dbPromise;
		const sql = 'SELECT * FROM user_configs WHERE phone = ?';
		const row = await db.get(sql, [userPhone]);
	  
		if (!row) {
		  return { ...defaultConfig, phone: userPhone };
		}
	  
		return {
		  ...row,
		  phone: userPhone,
		  prefixEnabled: row.prefixEnabled === 1,
		  prefixSkippedForMe: row.prefixSkippedForMe === 1,
		  groupchatsEnabled: row.groupchatsEnabled === 1,
		  promptModerationEnabled: row.promptModerationEnabled === 1,
		  promptModerationBlacklistedCategories: JSON.parse(row.promptModerationBlacklistedCategories),
		  ttsEnabled: row.ttsEnabled === 1,
		  transcriptionEnabled: row.transcriptionEnabled === 1,
		  authorized: row.authorized === 1,
		  isFirstTime: row.isFirstTime === 1,
		  
		};
	  }
	  

	  async function setUserConfig(userPhone: string, config: IConfig) {
		const db = await dbPromise;
		const sql = `
		INSERT OR REPLACE INTO user_configs (
			phone, openAIAPIKey, openAIModel, dalleSize, maxModelTokens, prePrompt, dalleModel, 
			replicateAPI, prefixEnabled, prefixSkippedForMe, gptPrefix, dallePrefix, resetPrefix, 
			aiConfigPrefix, groupchatsEnabled, promptModerationEnabled, 
			promptModerationBlacklistedCategories, awsAccessKeyId, awsSecretAccessKey, awsRegion, 
			awsPollyVoiceId, awsPollyEngine, speechServerUrl, whisperServerUrl, openAIServerUrl, 
			whisperApiKey, ttsEnabled, ttsMode, transcriptionEnabled, transcriptionMode, 
			transcriptionLanguage, userInteractions, authorized, limitedInteractions, urlShorten,
			isFirstTime, authorizedCommand, langChainPrefix, searchTool
		  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`;
		await db.run(sql, [
			userPhone, config.openAIAPIKey, config.openAIModel, config.dalleSize, config.maxModelTokens, 
			config.prePrompt, config.dalleModel, config.replicateAPI, config.prefixEnabled ? 1 : 0, 
			config.prefixSkippedForMe ? 1 : 0, config.gptPrefix, config.dallePrefix, config.resetPrefix, 
			config.aiConfigPrefix, config.groupchatsEnabled ? 1 : 0, config.promptModerationEnabled ? 1 : 0, 
			JSON.stringify(config.promptModerationBlacklistedCategories), config.awsAccessKeyId, 
			config.awsSecretAccessKey, config.awsRegion, config.awsPollyVoiceId, config.awsPollyEngine, 
			config.speechServerUrl, config.whisperServerUrl, config.openAIServerUrl, config.whisperApiKey, 
			config.ttsEnabled ? 1 : 0, config.ttsMode, config.transcriptionEnabled ? 1 : 0, 
			config.transcriptionMode, config.transcriptionLanguage, config.userInteractions, 
			config.authorized ? 1 : 0, config.limitedInteractions, config.urlShorten, 
			config.isFirstTime ? 1 : 0, config.authorizedCommand ? 1 : 0, config.langChainPrefix, config.searchTool
		]);
	  }

	  async function resetUserInteractions() {
		const db = await dbPromise;
		const sql = 'UPDATE user_configs SET userInteractions = 0';
		await db.run(sql);
	  }
	  
	  const cron = require('node-cron');
	  
	  // Agendar a execução da função para todos os dias à meia-noite
	  cron.schedule('0 0 * * *', resetUserInteractions);
	  
	  


export default defaultConfig;
export { 	
	setTTSEnabled, 
	setTranscriptionEnabled, 
	setPrefixEnabled, 
	getUserConfig, 
	setUserConfig, 
	authorizedUser,
	isAuthorized,
	addInteractions,
	resetInteractions,
	setPrePrompt,
	setLimitedInteractions,
	setTtsVoiceId,
	setTtsMode,
	setGptModel,
	setDalleSize,
	shortenLinkEncurtador,
	shortenLinkBitly,
	shortenLinkCuttly,
	setPlatforUrl,
	setTranscriptionMode,
	setImgModel,
	setFirstTime,
	authorizedUserCommand,
	isAuthorizedCommand,
	setSearchTool,
		
};