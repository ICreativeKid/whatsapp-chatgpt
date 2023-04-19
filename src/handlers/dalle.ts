import { MessageMedia } from "whatsapp-web.js";
import { openai } from "../providers/openai";
import { aiConfig } from "../handlers/ai-config";
import { CreateImageRequestSizeEnum } from "openai";
import midjourney from "midjourney-client";
import config, { IConfig } from "../config";
import * as cli from "../cli/ui";
import Replicate from "replicate";
import fetch from "node-fetch";


// Moderation
import { moderateIncomingPrompt } from "./moderation";

const handleMessageDALLE = async (client: any, message: any, prompt: any, userConfig: IConfig) => {


	try {
		const start = Date.now();
		cli.print(`[DALL-E] Received prompt from ${message.from}: ${prompt}`);
		client.sendMessage(message.from, '⏳ _loading..._')
		// Prompt Moderation
		if (userConfig.promptModerationEnabled) {
			try {
				await moderateIncomingPrompt(prompt, userConfig);
			} catch (error: any) {
				message.reply(error.message);
				return;
			}
		}



		// Send the prompt to the API
		const response = await openai.createImage({
			prompt: prompt,
			n: 1,
			size: userConfig.dalleSize as CreateImageRequestSizeEnum,
			response_format: "b64_json"
		});

		const end = Date.now() - start;

		const base64 = response.data.data[0].b64_json as string;
		const image = new MessageMedia("image/jpeg", base64, "image.jpg");

		cli.print(`[DALL-E] Answer to ${message.from} | OpenAI request took ${end}ms`);

		const caption = {
			caption: '```by 🖼 DALLE```',
		  };
		client.sendMessage(message.from, image, caption);

	} catch (error: any) {
		console.error("An error occured", error);
		message.reply(
			"*Um erro ocorreu/An error occured*\n\n💬 _Aguarde uns pouco e tente novamente_\n\n💬 _Please wait a little while and try again_\n\n\t (" + error.message + ")");
	}
};

const handleMessageStableDiffusion = async (client: any, message: any, prompt: string, userConfig: IConfig  ) => {
	try {
		const start = Date.now();
		cli.print(`[Stable Diffusion] Received prompt from ${message.from}: ${prompt}`);
		client.sendMessage(message.from, '⏳ _loading..._')

		// Verificação e moderação do prompt
		if (userConfig.promptModerationEnabled) {
		  try {
			await moderateIncomingPrompt(prompt, userConfig);
		  } catch (error: any) {
			message.reply(error.message);
			return;
		  }
		}
	
		// Autenticação e inicialização do cliente Replicate
		const token = userConfig.replicateAPI || process.env.REPLICATE_API_TOKEN;
		if (!token || typeof token !== "string") {
		  throw new Error("REPLICATE_API_TOKEN não está definido.");
		}
		const replicate = new Replicate({ auth: token });
	
		// Execução do modelo
		const response = await replicate.run(
		  "stability-ai/stable-diffusion:db21e45d3f7023abc2a46ee38a23973f6dce16bb082a930b0c49861f96d1e5bf",
		  { input: { prompt: prompt } }
		);
	
		const end = Date.now() - start;
	
		const imageURI = response[0] as string;
		const imageResponse = await fetch(imageURI);
		const arrayBuffer = await imageResponse.arrayBuffer();
		const imageBuffer = Buffer.from(arrayBuffer);
		const image = new MessageMedia("image/jpeg", imageBuffer.toString("base64"), "image.jpg");


		
	
		cli.print(`[Stable Diffusion] Answer to ${message.from} | Replicate request took ${end}ms`);
	
		const caption = {
			caption: '```by 🖼 Stable Diffusion```',
		  };
		client.sendMessage(message.from, image, caption);

	  } catch (error: any) {
		console.error("An error occurred", error);
		message.reply(
		  "*Um erro ocorreu/An error occured*\n\n💬 _Aguarde um pouco e tente novamente_\n\n💬 _Please wait a little while and try again_\n\n\t (" + error.message + ")"
		);
	  }
	};

	const handleMessageMidJourney = async (client: any, message: any, prompt: string, userConfig: IConfig  ) => {
		try {
			const start = Date.now();
			cli.print(`[Mid Journey] Received prompt from ${message.from}: ${prompt}`);
			client.sendMessage(message.from, '⏳ _loading..._')
	
			// Verificação e moderação do prompt
			if (userConfig.promptModerationEnabled) {
				try {
					await moderateIncomingPrompt(prompt, userConfig);
				} catch (error: any) {
					message.reply(error.message);
					return;
				}
			}
	
			// Execução do modelo
			const imageURI = await midjourney(prompt);
	
			if (!imageURI) {
				throw new Error("No image URL found in the response");
			}
	
			const end = Date.now() - start;
	
			const imageResponse = await fetch(imageURI);
			const arrayBuffer = await imageResponse.arrayBuffer();
			const imageBuffer = Buffer.from(arrayBuffer);
			const image = new MessageMedia("image/jpeg", imageBuffer.toString("base64"), "image.jpg");
	
			cli.print(`[Mid Journey] Answer to ${message.from} | Midjourney request took ${end}ms`);
	
			const caption = {
				caption: '```by 🖼 Mid Journey```',
			};
			client.sendMessage(message.from, image, caption);
	
		} catch (error: any) {
			console.error("An error occurred", error);
			message.reply(
				"*Um erro ocorreu/An error occured*\n\n💬 _Aguarde um pouco e tente novamente_\n\n💬 _Please wait a little while and try again_\n\n\t (" + error.message + ")"
			);
		}
	};
	  
	  export { handleMessageDALLE, handleMessageStableDiffusion, handleMessageMidJourney };