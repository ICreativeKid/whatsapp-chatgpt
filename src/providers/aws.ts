const AWS = require("aws-sdk");
import { IConfig } from "../config";

/**
 * @param text The sentence to be converted to speech
 * @returns Audio buffer
 */
async function ttsRequest(text: string, userConfig: IConfig): Promise<Buffer | null> {
	const polly = new AWS.Polly({
		credentials: new AWS.Credentials(userConfig.awsAccessKeyId, userConfig.awsSecretAccessKey),
		region: userConfig.awsRegion
	});

	const params = {
		OutputFormat: "mp3",
		Text: text,
		Engine: userConfig.awsPollyEngine,
		VoiceId: userConfig.awsPollyVoiceId
	};

	try {
		const data = await polly.synthesizeSpeech(params).promise();
		if (data.AudioStream instanceof Buffer) {
			return data.AudioStream;
		}
		return null;
	} catch (error) {
		console.error("An error occured (TTS request)", error);
		return null;
	}
}

export { ttsRequest };
