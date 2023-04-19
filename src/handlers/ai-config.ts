import { Message } from "whatsapp-web.js";
import { aiConfigTarget, aiConfigTypes, aiConfigValues, IAiConfig } from "../types/ai-config";
import { dalleImageSize } from "../types/dalle-config";
import {IConfig} from "../config";

const aiConfig: IAiConfig = {
	dalle: {
		size: dalleImageSize["512x512"]
	}

};

const handleMessageAIConfig = async (message: Message, prompt: any, userConfig: IConfig) => {
	try {
		console.log("[AI-Config] Received prompt from " + message.from + ": " + prompt);

		const args: string[] = prompt.split(" ");

		/*
			!config
			!config help
		*/
		if (args.length == 1 || prompt === "ajuda") {
			let helpMessage = "Comandos disponíveis:\n";
			for (let target in aiConfigTarget) {
				for (let type in aiConfigTypes[target]) {
					helpMessage += `\t.config ${target} ${type} <valor>\n\n\tajuste ${target} ${type} para <valor>\n`;
				}
			}
			helpMessage += "\nValores disponíveis:\n";
			for (let target in aiConfigTarget) {
				for (let type in aiConfigTypes[target]) {
					helpMessage += `\t${target} ${type}: ${Object.keys(aiConfigValues[target][type]).join(", ")}\n`;
				}
			}
			message.reply(helpMessage);
			return;
		}

		

		// !config <target> <type> <value>
		if (args.length !== 3) {
			message.reply(
				"Número de argumentos inválidos, por favor use o seguinte formato: <IA> <Parâmetro> <Valor> ou digite .config ajuda para mais informações."
			);
			return;
		}

		const target: string = args[0];
		const type: string = args[1];
		const value: string = args[2];

		if (!(target in aiConfigTarget)) {
			message.reply("IA inválida, por favor use algum dos seguintes " + Object.keys(aiConfigTarget).join(", "));
			return;
		}

		if (!(type in aiConfigTypes[target])) {
			message.reply("Parâmetro inválido, por favor siga algum dos seguintes: " + Object.keys(aiConfigTypes[target]).join(", "));
			return;
		}

		if (!(value in aiConfigValues[target][type])) {
			message.reply("Valor inválido, por favor siga algum dos seguintes: " + Object.keys(aiConfigValues[target][type]).join(", "));
			return;
		}

		aiConfig[target][type] = value;

		message.reply("Configurado com Sucesso! " + target + " " + type + " para " + value);
	} catch (error: any) {
		console.error("An error occured", error);
		message.reply("Um erro ocorreu, por favor contate o suporte. (" + error.message + ")");
	}
};

export { aiConfig, handleMessageAIConfig };
