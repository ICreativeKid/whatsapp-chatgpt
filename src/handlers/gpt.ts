import os from "os";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { Message, MessageMedia } from "whatsapp-web.js";
import { chatgpt } from "../providers/openai";
import * as cli from "../cli/ui";
import config, { IConfig } from "../config";


// TTS
import { ttsRequest as speechTTSRequest } from "../providers/speech";
import { ttsRequest as awsTTSRequest } from "../providers/aws";
import { TTSMode } from "../types/tts-mode";

// Moderation
import { moderateIncomingPrompt } from "./moderation";
import { userPhone } from "..";
import MessageType from "chatgpt-official/dist/enums/message-type";

// Mapping from number to last conversation id
const conversations = {};


const handleMessageGPT = async (message: Message, prompt: string, userConfig: IConfig) => {
	console.log('UserConfig:', userConfig.prePrompt);
		
	try {
		// Get last conversation
		const lastConversationId = conversations[message.from];

		cli.print(`[GPT] Received prompt from ${message.from}: ${prompt}`);

		// Prompt Moderation
		if (userConfig.promptModerationEnabled) {
			try {
				await moderateIncomingPrompt(prompt, userConfig);
			} catch (error: any) {
				message.reply(error.message);
				return;
			}
		}

		const start = Date.now();

		// Check if we have a conversation with the user
		let response: string;
		if (lastConversationId) {
			// Handle message with previous conversation
			response = await chatgpt.ask(prompt, lastConversationId);
		} else {
			// Create new conversation
			const convId = randomUUID();
			const conv = chatgpt.addConversation(convId);

			// Set conversation
			conversations[message.from] = conv.id;

			cli.print(`[GPT] New conversation for ${message.from} (ID: ${conv.id})`);

			// Pre prompt
			if (userConfig.prePrompt != null && userConfig.prePrompt.trim() != "") {
				cli.print(`[GPT] Pre prompt: ${userConfig.prePrompt}`);
				const prePromptResponse = await chatgpt.ask(userConfig.prePrompt, conv.id);
				cli.print("[GPT] Pre prompt response: " + prePromptResponse);
			}

			// Handle message with new conversation
			response = await chatgpt.ask(prompt, conv.id);
		}

		const end = Date.now() - start;

		cli.print(`[GPT] Answer to ${message.from}: ${response}  | OpenAI request took ${end}ms)`);


		// TTS reply (Default: disabled)
		if (userConfig.ttsEnabled) {
			sendVoiceMessageReply(message, response, userConfig);
			return;
		}

		if (!userConfig.ttsEnabled && !userConfig.authorizedCommand && message.type === 'ptt') {
			sendVoiceMessageReply(message, response, userConfig);
			return;
		}

		// Default: Text reply
		message.reply(response);
	} catch (error: any) {
		console.error("An error occured", error);
		message.reply(
			"*Um erro ocorreu/An error occured*\n\n"+
			"💬 _Aguarde uns pouco e tente novamente_\n\n💬 _Please wait a little while and try again_\n\n\t(" + error.message + ")");
	}
};

const handleDeleteConversation = async (message: Message, userConfig) => {
	// Delete conversation
	delete conversations[message.from];

	// Reply
	message.reply(
		"💬 _Contexto da conversa foi resetado_\n\n"+
		"💬 _The conversation context has been reset_");
};

async function sendVoiceMessageReply(message: Message, gptTextResponse: string, userConfig: IConfig) { // Adicione userConfig como um novo parâmetro
	var logTAG = "[TTS]";
	var ttsRequest = async function (): Promise<Buffer | null> {
		return await speechTTSRequest(gptTextResponse, userConfig);
	};

	switch (userConfig.ttsMode) { // Substitua config por userConfig
		case TTSMode.SpeechAPI:
			logTAG = "[SpeechAPI]";
			ttsRequest = async function (): Promise<Buffer | null> {
				return await speechTTSRequest(gptTextResponse, userConfig);
			};
			break;

		case TTSMode.AWSPolly:
			logTAG = "[AWSPolly]";
			ttsRequest = async function (): Promise<Buffer | null> {
				return await awsTTSRequest(gptTextResponse, userConfig);
			};
			break;

		default:
			logTAG = "[SpeechAPI]";
			ttsRequest = async function (): Promise<Buffer | null> {
				return await speechTTSRequest(gptTextResponse, userConfig);
			};
			break;
	}

	// Get audio buffer
	cli.print(`${logTAG} Generating audio from GPT response "${gptTextResponse}"...`);
	const audioBuffer = await ttsRequest();

	// Check if audio buffer is valid
	if (audioBuffer == null || audioBuffer.length == 0) {
		message.reply(`${logTAG} \n\n💬_Não foi possível gerar o áudio, aguarde um pouco e tente novamente_\n\n💬 _Unable to generate audio. Please wait a moment and try again_`);
		return;
	}

	cli.print(`${logTAG} Audio generated!`);

	// Get temp folder and file path
	const tempFolder = os.tmpdir();
	const tempFilePath = path.join(tempFolder, randomUUID() + ".opus");

	// Save buffer to temp file
	fs.writeFileSync(tempFilePath, audioBuffer);

	// Send audio
	const messageMedia = new MessageMedia("audio/ogg; codecs=opus", audioBuffer.toString("base64"));
	message.reply(messageMedia);

	// Delete temp file
	fs.unlinkSync(tempFilePath);
}

export { handleMessageGPT, handleDeleteConversation };
