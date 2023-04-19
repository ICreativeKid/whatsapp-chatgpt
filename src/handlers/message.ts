import { Message, Client } from "whatsapp-web.js";
import { startsWithIgnoreCase } from "../utils";
import { createImageAI, weatherHandler, downloadVideoYT } from '../commands';
import { userPhone } from '../index'
import  client  from '../client'
import { addInteractions, setPrePrompt } from "../config";
import { generateStickerFromMedia, shortenLink } from "../commands";
import { handleMessageLangChain } from "../handlers/langchain";


import fs from "fs";
import { fetchGptResponse } from "../autogpt"

// Config & Constants
import config, { IConfig } from "../config";

// CLI
import * as cli from "../cli/ui";

// ChatGPT & DALLE
import { handleMessageGPT, handleDeleteConversation } from "../handlers/gpt";
import { handleMessageDALLE } from "../handlers/dalle";
import { handleMessageAIConfig } from "../handlers/ai-config";

// Speech API & Whisper
import { TranscriptionMode } from "../types/transcription-mode";
import { transcribeRequest } from "../providers/speech";
import { transcribeAudioLocal } from "../providers/whisper-local";
import { transcribeWhisperApi } from "../providers/whisper-api";
import { transcribeOpenAI } from "../providers/openai";

// For deciding to ignore old messages
import { botReadyTimestamp } from "../index";
import knowledgeBase from "../knowledge_base"



function searchKnowledgeBase(messageText) {
	const validCommands = [
		".menu",
		".gpt",
		".img",
		".txt",
		".stk",
		".clm",
		".rst",
		".stt",
		".bot",
		".spk",
		".url",
		".urs",
		".ppt",
		".pin",
		".sub",
		".lgn"
	  ];
	  const messageStartsWithCommand = validCommands.some((command) =>
	  messageText.startsWith(command)
	);
  
	if (messageText.startsWith(".") && !messageStartsWithCommand) {
	  return knowledgeBase["comandos incorretos / wrong commands"];
	}
	const messageWords = messageText.split(' ');
  
	for (const [question, answer] of Object.entries(knowledgeBase)) {
	  const questionWords = question.split(' ');
	  const matches = questionWords.filter(word => messageWords.includes(word));
	  if (matches.length / questionWords.length > 0.6) { // Ajuste esse valor de acordo com a precisão desejada
		return answer;
	  }
	}
  
	return null;
  }

// Handles message
async function handleIncomingMessage(message: any, userConfig: IConfig) {

    const messageText = message.body.toLowerCase();
    const messageType = message.type;
	console.log('Menssagem recebida', messageText);

    //if (userConfig.openAIModel === 'auto-gpt') {
       // console.log('Entrou no auto-gpt');
        //try {
            //const gptResponse = await fetchGptResponse(messageText);
            //console.log(`Resposta do GPT: ${gptResponse}`);
            // Enviar a resposta do GPT para o usuário
            // Substitua o método sendMessage pelo método correto para o seu cliente
           // await client.sendMessage(userPhone, gptResponse);
       // } catch (error) {
           // console.error('Error:', error.message);
       // }
   // }

  
   if (!userConfig.authorizedCommand && message.body.startsWith('.')) {
		const msg = 
		"💬 Você não tem permissão suficiente para realizar comandos ao BOT, faça um upgrade de assinatura para habilitar essa função\nhttps://bit.ly/40yn1gM\n\n"+
		"💬 You do not have sufficient permissions to perform commands on the BOT, upgrade your subscription to enable this feature\nhttps://bit.ly/40yn1gM"
		client.sendMessage(userPhone, msg)
		return
   }

	if(userConfig.searchTool == true){
		const msg = "⏳ _loading..._"
		client.sendMessage(userPhone, msg)
		await handleMessageLangChain(message, message.body);
		addInteractions(userConfig, 1, userPhone);
		return;
	}

	if (/^(obtenha clima de|como esta o clima em|omo esta o clima em|previsao do tempo em|previsão do tempo em|como esta o tempo em|get weather in|what is the weather like in|weather forecast in) .+/i.test(messageText)) {
		const location = messageText.replace(/^(obtenha clima de|como esta o clima em|omo esta o clima em|previsao do tempo em|previsão do tempo em|como esta o tempo em|get weather in|what is the weather like in|weather forecast in) /i, '');
		await weatherHandler(location, message, client);
		addInteractions(userConfig, 1, userPhone);
		return;
	}

	if (/^(defina um prompt de|prompt|pré prompt|pre prompt|haja como|seja um|seja como|set a prompt of|prompt|pre prompt|be like|be as).+/i.test(messageText)) {
		const prompt = messageText.replace(/^(defina um prompt de|prompt|pré prompt|pre prompt|haja como|seja um|seja como|set a prompt of|prompt|pre prompt|be like|be as) /i, '');
		setPrePrompt(userConfig, prompt, userPhone);
		message.reply(`Prompt:\n*"${prompt}"*\n\n💬 _Utilize *.rst* ou peça pra resetar o contexto da conversa pro pre prompt funcionar_`+
		`\n\n💬 _Use *.rst* or ask to reset the conversation context for the pre prompt to work_`);
		return;
    }

	if (/^(limpe o prompt|resete o prompt|haja normal|haja normalmente|volte ao normal|prompt limpo|prompt vazio|sem prompt|sem prepromt|resete pre prompt|limpe pre prompt|clear the prompt|reset the prompt|go back to normal|back to normal|empty prompt|no prompt|reset pre prompt).+/i.test(messageText)) {
		const prompt = undefined
		setPrePrompt(userConfig, prompt, userPhone);
		message.reply(
			`💬 _Prompt sem pré-configuração_\n💬 _Unconfigured prompt set_\n\n*<vazio/empty>*`);
		return;
	}
	  

	if (/^(https?:\/\/)?((www|m)\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com|shorts\.com)\/.+$/i.test(messageText)) {
		await downloadVideoYT(messageText, message.from, client);
		addInteractions(userConfig, 1, userPhone);
		return;
	}

	if (messageType === 'image' || messageType === 'video' || /^https?:\/\/.+(\.jpg|\.jpeg|\.png|\.gif)$/.test(messageText)) {
		await generateStickerFromMedia(message, message.from, client);
		addInteractions(userConfig, 1, userPhone);
		return

	} else if (/^https?:\/\/.+/.test(messageText)){
	  	shortenLink(client, message, messageText, userConfig);
	 	addInteractions(userConfig, 1, userPhone)
		return
	} 

	if (messageType === 'document') {
        message.reply(
			"💬 _Desculpe, não consigo visualizar arquivos. Por favor, envie uma mensagem de texto_\n\n"+
			"💬 _Sorry, I am unable to view files. Please send a text message_");
			return
	    }
	
	if (messageType === 'audio' && userConfig.ttsEnabled === false) {
		message.reply( 
			'💬 _você receberá a reposta em texto, caso queria receber audio ative com comando *.spk*_\n\n'+
			'💬 _you will receive the response in text. If you want to receive audio, activate it with the command *.spk*_'
		)
		return
	}

	const knowledgeBaseAnswer = searchKnowledgeBase(messageText);
	if (knowledgeBaseAnswer) {
		// Envie a resposta da base de conhecimento e retorne para não processar o restante do código
		message.reply(knowledgeBaseAnswer);
		return;
	  }

	  const imageKeywords = /^(me cria uma imagem|me crie uma imagem|crie uma imagem de|cria uma imagem de|crie a imagem de|cria a imagem de|cria imagem de|crie imagem de|imagem de|desenhe|desenho|image|draw|create an image|create a draw|create the image|elabore uma imagem|elabore uma foto|cria imagem|crie imagem)/i;
	  if (imageKeywords.test(message.body)) {
		  // Chame a função com o prompt apropriado
		  const prompt = message.body.replace(imageKeywords, "").trim();
		  createImageAI(client, message, prompt, userConfig);
		  addInteractions(userConfig, 1, userPhone)
		  return;
	  }
	
	let messageString = message.body;

	const msg = "⏳ _loading..._"
	client.sendMessage(userPhone, msg)
	addInteractions(userConfig, 1, userPhone)

	// Prevent handling old messages
	if (message.timestamp != null) {
		const messageTimestamp = new Date(message.timestamp * 1000);

		// If startTimestamp is null, the bot is not ready yet
		if (botReadyTimestamp == null) {
			message.reply("⏱ Començando / Starting...");
			cli.print("Ignoring message because bot is not ready yet: " + messageString);
			return;
		}

		// Ignore messages that are sent before the bot is started
		if (messageTimestamp < botReadyTimestamp) {
			message.reply("⏱ Començando / Starting...");
			cli.print("Ignoring old message: " + messageString);
			return;
		}
	}

	// Ignore groupchats if disabled
	if ((await message.getChat()).isGroup && !userConfig.groupchatsEnabled) return;

	// Verifica se a mensagem não começa com o prefixo e se o prefixo está habilitado
	if (userConfig.prefixEnabled && !message.hasMedia && !startsWithIgnoreCase(messageString, userConfig.gptPrefix) && !startsWithIgnoreCase(messageString, userConfig.dallePrefix)) {
		message.reply(
			`⚠️ Prefix 👉 🟢ON ⚠️\n\n`+
			`Por favor, inicie a mensagem com:\n`+
			`_Please begin your message with_\n\n`+
			`*${userConfig.gptPrefix}*\n`+
			`*${userConfig.dallePrefix}*\n\n`+
			`Ou desabilite o uso do prefixo para que suas mensagens sejam entregues`+
			` diretamente ao GPT usando o comando *.pfx*\n\n`+
			`_Or disable the use of the prefix so that your messages are delivered directly to GPT with the command *.pfx*_`
		);
		return;
	}
	
	// Transcribe audio
	if (message.hasMedia) {
		const media = await message.downloadMedia();

		// Ignore non-audio media
		if (!media || !media.mimetype.startsWith("audio/")) return;

		// Check if transcription is enabled (Default: false)
		if (!userConfig.transcriptionEnabled) {
			message.reply(
				"⚠️ *Audio recebido/received* ⚠️\n\n💬 _Porém, a transcrição está desabilitada. Ative para usar essa função com comando *.txt*_\n\n"+
				"💬 _However, transcription is currently disabled. Enable it to use this function with the command *.txt*_");
			cli.print("[Transcription] Received voice messsage but voice transcription is disabled.");
			return;
		}

		// Convert media to base64 string
		const mediaBuffer = Buffer.from(media.data, "base64");

		// Transcribe locally or with Speech API
		cli.print(`[Transcription] Transcribing audio with "${userConfig.transcriptionMode}" mode...`);

		let res;
		switch (userConfig.transcriptionMode) {
			case TranscriptionMode.Local:
				res = await transcribeAudioLocal(mediaBuffer);
				break;
			case TranscriptionMode.OpenAI:
				res = await transcribeOpenAI(mediaBuffer, userConfig);
				break;
			case TranscriptionMode.WhisperAPI:
				res = await transcribeWhisperApi(new Blob([mediaBuffer]));
				break;
			case TranscriptionMode.SpeechAPI:
				res = await transcribeRequest(new Blob([mediaBuffer]));
				break;
			default:
				
				cli.print(`[Transcription] Unsupported transcription mode: ${userConfig.transcriptionMode}`);
		}
		const { text: transcribedText, language: transcribedLanguage } = res;

		// Check transcription is null (error)
		if (transcribedText == null) {
			message.reply(
				"💬 _Desculpe, não consegui entender o que você disse_\n\n"+
				"💬 _I'm sorry, I couldn't understand what you said_");
			return;
		}

		// Check transcription is empty (silent voice message)
		if (transcribedText.length == 0) {
			message.reply(
				"💬 _Desculpe, não consegui entender o que você disse_\n\n"+
				"💬 _I'm sorry, I couldn't understand what you said_");
			return;
		}

		// Log transcription
		cli.print(`[Transcription] Transcription response: ${transcribedText} (_language_: ${transcribedLanguage})`);

		// Reply with transcription
		const reply = 
		`_Você disse/You said_:\n\n`+
		`💬 ${transcribedText}${transcribedLanguage ? " \n\n *(_Language_: " + transcribedLanguage + ")* " : ""}`;
		message.reply(reply);

		// Handle message GPT
		await handleMessageGPT(message, transcribedText, userConfig);
		return;
	}

	// Clear conversation context (!clear)
	if (startsWithIgnoreCase(messageString, userConfig.resetPrefix)) {
		await handleDeleteConversation(message, userConfig);
		return;
	}

	// AiConfig (!config <args>)
	if (startsWithIgnoreCase(messageString, userConfig.aiConfigPrefix)) {
		const prompt = messageString.substring(userConfig.aiConfigPrefix.length + 1);
		await handleMessageAIConfig(message, prompt, userConfig);
		return;
	}

	// GPT (only <prompt>)

	const selfNotedMessage = message.fromMe && message.hasQuotedMsg === false && message.from === message.to;

	// GPT (.gpt <prompt>)
	if (startsWithIgnoreCase(messageString, userConfig.gptPrefix)) {
		const prompt = messageString.substring(userConfig.gptPrefix.length + 1);
		await handleMessageGPT(message, prompt, userConfig);
		return;
	}

	// GPT (.lgn <prompt>)
	if (startsWithIgnoreCase(messageString, userConfig.langChainPrefix)) {
		const prompt = messageString.substring(userConfig.langChainPrefix.length + 1);
		await handleMessageLangChain(message, prompt);
		return;
	}

	// DALLE (.dalle <prompt>)
	if (startsWithIgnoreCase(messageString, userConfig.dallePrefix)) {
		const prompt = messageString.substring(userConfig.dallePrefix.length + 1);
		await handleMessageDALLE(Client, message, prompt, userConfig);
		return;
	}

	if (!userConfig.prefixEnabled || (userConfig.prefixSkippedForMe && selfNotedMessage)) {
		await handleMessageGPT(message, messageString, userConfig);
		return;
	}
}

export { handleIncomingMessage };
