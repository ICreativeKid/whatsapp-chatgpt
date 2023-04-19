import { userConfigs, userPhone } from "..";
import config from "../config";
import {IConfig} from "../config";
import dotenv from 'dotenv';
import { getUserConfig } from '../config'


let userConfig = await getUserConfig(userPhone)

async function transcribeWhisperApi(audioBlob: Blob): Promise<{ text: string; language: string }> {
	const url = userConfig.whisperServerUrl;
	const api = process.env.WHISPER_API_KEY
	
	// FormData
	const formData = new FormData();
	formData.append("file", audioBlob);
	formData.append("diarization", "false");
	formData.append("numSpeakers", "1");
	formData.append("fileType", "ogg");
	if (userConfigs.transcriptionLanguage) {
		formData.append("language", userConfig.transcriptionLanguage);
	}
	formData.append("task", "transcribe");

	const headers = new Headers();
	headers.append("Authorization", `Bearer ${api}`);

	// Request options
	const options = {
		method: "POST",
		body: formData,
		headers
	};

	const response = await fetch(url, options);
	const transcription = await response.json();
	return transcription;
}

export { transcribeWhisperApi };
