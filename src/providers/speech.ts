import { userConfigs, userPhone } from "..";
import config, { IConfig } from "../config";

/**
 * @param text The sentence to be converted to speech
 * @returns Audio buffer
 */
async function ttsRequest(text: string, userConfig: IConfig): Promise<Buffer | null> {
	const url = userConfig.speechServerUrl + "/tts";
  
	const options = {
	  method: "POST",
	  headers: {
		"Content-Type": "application/json"
	  },
	  body: JSON.stringify({
		text
	  })
	};
  
	try {
	  const response = await fetch(url, options);
	  if (!response.ok) {
		throw new Error(`Server responded with status: ${response.status}`);
	  }
	  const audioBuffer = await response.arrayBuffer();
	  return Buffer.from(audioBuffer);
	} catch (error) {
	  console.error("An error occured (TTS request)", error);
	  return null;
	}
  }

/**
 * @param audioBlob The audio blob to be transcribed
 * @returns Response: { text: string, language: string }
 */
async function transcribeRequest(audioBlob: Blob): Promise<{ text: string; language: string }> {
	const url = userConfigs.speechServerUrl[userPhone] + "/transcribe";
  
	const formData = new FormData();
	formData.append("audio", audioBlob);
  
	const options = {
	  method: "POST",
	  body: formData
	};
  
	try {
	  const response = await fetch(url, options);
	  if (!response.ok) {
		throw new Error(`Server responded with status: ${response.status}`);
	  }
	  const contentType = response.headers.get("Content-Type");
	  if (!contentType || !contentType.includes("application/json")) {
		throw new Error("Unexpected response format");
	  }
	  const transcription = await response.json();
	  return transcription;
	} catch (error) {
	  console.error("An error occured (transcribe request)", error);
	  throw error;
	}
  }
  
  export { ttsRequest, transcribeRequest };
