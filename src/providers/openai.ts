import fs from "fs";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { ChatGPT } from "chatgpt-official";
import ffmpeg from "fluent-ffmpeg";
import { Configuration, OpenAIApi } from "openai";
import { blobFromSync, File } from "fetch-blob/from.js";
import config, {getUserConfig, IConfig} from "../config";
import { userConfigs, userPhone } from "..";

let userConfig = await getUserConfig(userPhone)

  let options = {
	
	temperature: 0.7, // OpenAI parameter
	max_tokens: userConfig.maxModelTokens, // OpenAI parameter [Max response size by tokens]
	top_p: 0.9, // OpenAI parameter
	frequency_penalty: 0, // OpenAI parameter
	presence_penalty: 0, // OpenAI parameter
	model: userConfig.openAIModel // OpenAI model
};
  
export const chatgpt = new ChatGPT(userConfig.openAIAPIKey, options); // Note: options is optional

// OpenAI Client (DALL-E)
export const openai = new OpenAIApi(
	new Configuration({
		apiKey: userConfig.openAIAPIKey
	})
);


export async function transcribeOpenAI(audioBuffer: Buffer, userConfig: IConfig): Promise<{ text: string; language: string }> {
	const url = userConfig.openAIServerUrl;
	let language = "";

	const tempdir = os.tmpdir();
	const oggPath = path.join(tempdir, randomUUID() + ".ogg");
	const wavFilename = randomUUID() + ".wav";
	const wavPath = path.join(tempdir, wavFilename);
	fs.writeFileSync(oggPath, audioBuffer);
	try {
		await convertOggToWav(oggPath, wavPath);
	} catch (e) {
		fs.unlinkSync(oggPath);
		return {
			text: "",
			language
		};
	}

	// FormData
	const formData = new FormData();
	formData.append("file", new File([blobFromSync(wavPath)], wavFilename, { type: "audio/wav" }));
	formData.append("model", "whisper-1");
	if (userConfig.transcriptionLanguage) {
		formData.append("language", userConfig.transcriptionLanguage);
		language = userConfig.transcriptionLanguage;
	}

	const headers = new Headers();
	headers.append("Authorization", `Bearer ${userConfig.openAIAPIKey}`);

	// Request options
	const options = {
		method: "POST",
		body: formData,
		headers
	};

	let response;
	try {
		response = await fetch(url, options);
	} catch (e) {
		console.error(e);
	} finally {
		fs.unlinkSync(oggPath);
		fs.unlinkSync(wavPath);
	}

	if (!response || response.status != 200) {
		console.error(response);
		return {
			text: "",
			language: language
		};
	}

	const transcription = await response.json();
	return {
		text: transcription.text,
		language
	};
}

async function convertOggToWav(oggPath: string, wavPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		ffmpeg(oggPath)
			.toFormat("wav")
			.outputOptions("-acodec pcm_s16le")
			.output(wavPath)
			.on("end", () => resolve())
			.on("error", (err) => reject(err))
			.run();
	});
}