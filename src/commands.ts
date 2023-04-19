import axios from 'axios';
import gifFrames from 'gif-frames';
import replicate from 'node-replicate';
import is from 'is-url'
import moment from 'moment'
import path from 'path'
import fs from 'fs'
import ytdl from 'ytdl-core';
import { createCanvas } from 'canvas'
import { TTSMode } from "./types/tts-mode";
import { MessageMedia, Client, MessageTypes } from "whatsapp-web.js";
import { setTTSEnabled, 
	setTranscriptionEnabled, 
	setPrefixEnabled, 
	getUserConfig, 
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
  setPlatforUrl,
  setTranscriptionMode,
  shortenLinkEncurtador,
  shortenLinkBitly,
  shortenLinkCuttly,
  setImgModel,
  authorizedUserCommand,
	isAuthorizedCommand,
  setSearchTool
  
	
 } from "./config"
 import dotenv from 'dotenv';
 import { handleMessageDALLE, handleMessageStableDiffusion, handleMessageMidJourney } from "./handlers/dalle";

const WEATHERSTACK_API_KEY = '2af8ca562b5cb161953ed749d7d8e3a6';


//command to generate stickers  !sticker
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
ffmpeg.setFfmpegPath(ffmpegPath.path);
import * as FileType from 'file-type';
import { TranscriptionMode } from './types/transcription-mode';


export async function generateStickerFromMedia(message, sender, client) {
  try {
    let media: MessageMedia | null = null;

    const validUrlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w\.-]*)*\/?$/;

    if (validUrlPattern.test(message.body)) {
      try {
          const { data } = await axios.get(message.body, { responseType: 'arraybuffer' });
          const returnedB64 = Buffer.from(data);
          const fileType = await FileType.fileTypeFromBuffer(returnedB64);
          let mimeType;

          if (fileType) {
              mimeType = fileType.mime;
              if (fileType.ext === 'gif') {
                  mimeType = 'image/gif';
              }
              media = new MessageMedia(mimeType, returnedB64.toString('base64'), `image.${fileType.ext}`);
          } else {
              throw new Error("💬 _Não foi possível identificar o tipo de arquivo_\n\n💬 _It was not possible to identify the file type_");
          }
      } catch (e) {
          throw new Error("💬 _Não foi possível baixar a imagem da URL_\n\n💬 _It was not possible to download the image from the URL.\n\n" + e.message);
      }
    } else if (message.type === MessageTypes.TEXT) {
      const stickerText = message.body.trim();
      if (stickerText.length > 40) {
        throw new Error("💬 _O texto é muito longo para criar um sticker_\n\n💬 _The text is too long to create a sticker_");
      }
      const base64Image = await createTransparentImage(stickerText);
      media = new MessageMedia("image/png", base64Image.split(',')[1], "sticker.png");
    } else if (message.type === MessageTypes.IMAGE || message.type === MessageTypes.VIDEO || message.type === MessageTypes.STICKER) {
        try {
            media = await message.downloadMedia();
        } catch (e) {
            throw new Error("💬 _Houve algum erro ao tentar processar a mídia_\n\n💬 _There was an error while trying to process the media_");
        }
    } else {
        const chat = await client.getChatById(message.id.remote);
        await chat.sendSeen();
        return;
    }

    if (media) {
        await client.sendMessage(sender, "⏳ _loading..._");
        await client.sendMessage(sender, media, {
            sendMediaAsSticker: true,
            stickerIsAnimated: media.mimetype === "image/gif",
            stickerName: 'ZAPIA .stk command',
            stickerAuthor: '@zapia.bot'
        });
    } else {
        throw new Error("💬 _Não foi possível gerar um sticker_\n\n💬 _It was not possible to generate a sticker_");
    }
  } catch (e) {
      console.log(e);
      message.reply("💬 _Houve algum erro ao tentar processar o sticker_\n\n💬 _There was an error while trying to process the sticker\n\n" + e.message);
      return;
  }
}


async function createTransparentImage(text, fontSize = 32) {
  const canvas = createCanvas(512, 512);
  const ctx = canvas.getContext('2d');

  ctx.font = `${fontSize}px Arial`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const textWidth = ctx.measureText(text).width;
  const textHeight = fontSize;

  ctx.fillStyle = 'rgba(255, 255, 255, 0)';
  ctx.fillRect(0, 0, 512, 512);

  ctx.fillStyle = 'black';
  ctx.fillText(text, 256, 256 - textHeight / 5);

  const buffer = canvas.toBuffer('image/png');

  return `data:image/png;base64,${buffer.toString('base64')}`;
}



export async function downloadVideoYT(client, message, url) {
  try {
    console.log(url)
    if (!ytdl.validateURL(url)) {
      message.reply('❌ URL vídeo inválido/invalid');
      return;
    }

    await client.sendMessage(message.from, '📥 YT downloading...');

    const info = await ytdl.getInfo(url);

    const videoDuration = parseInt(info.videoDetails.lengthSeconds, 10) * 1000;
    if (videoDuration > 300000) {
      message.reply(
        '❌ _O vídeo excede o limite de 5 minutos. Por favor, tente um vídeo menor_\n\n'+
        '❌ _The video exceeds the 5 minute limit. Please try a smaller video_');
      return;
    }
    const fileExt = '.mp4';
    const filename = `video_${Date.now()}${fileExt}`;
    const filePath = path.join(__dirname, 'downloads', filename);

    let lastPercentageSent = 0;

    const stream = ytdl(url, { filter: 'audioandvideo' });
    stream.on('progress', (_, downloaded, total) => {
      const percent = (downloaded / total) * 100;
      console.log(`Progresso do download: ${percent.toFixed(2)}%`);

      if (percent >= 25 && lastPercentageSent < 25) {
        lastPercentageSent = 25;
        client.sendMessage(message.from, `📥 YT downloading... *25%*`);
      } else if (percent >= 50 && lastPercentageSent < 50) {
        lastPercentageSent = 50;
        client.sendMessage(message.from, `📥 YT downloading... *50%*`);
      } else if (percent >= 75 && lastPercentageSent < 75) {
        lastPercentageSent = 75;
        client.sendMessage(message.from, `📥 YT downloading... *75%*`);
      }


    });

    const msg =
      '*Title  :*\n' +
      '```' +
      info.videoDetails.title +
      '```\n\n' +
      '🙋‍♂️ *Author :*\n  ' +
      '```' +
      info.videoDetails.author.name +
      '```\n\n' +
      '🎥 *Views  :*  ' +
      '```' +
      info.videoDetails.viewCount +
      '```\n' +
      '👍 *Likes   :*  ' +
      '```' +
      info.videoDetails.likes +
      '```\n' +
      '👎 *Dislikes   :*  ' +
      info.videoDetails.dislikes +
      '```';


    const mediaBlob = fs.createWriteStream(filePath);
    stream.pipe(mediaBlob);

    mediaBlob.on('finish', async () => {
      const media = MessageMedia.fromFilePath(filePath);
      await client.sendMessage(message.from, media, { caption: msg });
      fs.unlinkSync(filePath);
    });

  } catch (error) {
    console.error(error);
    message.reply('❌ Ocorreu um erro ao baixar o vídeo. Tente novamente mais tarde.');
  }
}




///command to give weather status  !clima
export async function weatherHandler(location: string, message: any, client: Client): Promise<string | undefined> {
    if (!location) {
        message.reply("Por favor, forneça uma localidade após *.clima* para que eu diga como ele está no local");
        return;
    }

    let weatherDescriptions = {
        'Partly cloudy': '🌤 Parcialmente nublado/Partly cloudy',
        'Overcast': '🌥 Nublado/Overcast',
        'Clear': '☀ Céu limpo/Clear',
        'Mist': '🌫 Nevoeiro/Mist',
        'Patchy rain possible': '☂ Possibilidade de chuva/Patchy rain possible',
        'Light rain': '🌦 Chuva leve/Light rain',
        'Moderate rain': '🌧 Chuva moderada/Moderate rain',
        'Heavy rain': '⛈ Chuva forte/Heavy rain',
        'Sunny': '🌞 Ensolarado/Sunny'
    }

    const apiUrl = `http://api.weatherstack.com/current?access_key=${WEATHERSTACK_API_KEY}&query=${location}&lang=pt`;

    try {
            const response = await axios.get(apiUrl);
            const data = response.data
            const currentData = data.current;
            currentData.weather_description = data.current.weather_descriptions[0];
            currentData.wind_speed = data.current.wind_speed;
            currentData.wind_degree = data.current.wind_degree;
            currentData.wind_dir = data.current.wind_dir;
            currentData.pressure = data.current.pressure;
            currentData.precip = data.current.precip;
            currentData.humidity = data.current.humidity;
            currentData.cloudcover = data.current.cloudcover;
            currentData.feelslike = data.current.feelslike;
            currentData.uv_index = data.current.uv_index;
            currentData.visibility = data.current.visibility;
            currentData.is_day = data.current.is_day;


            const weatherDescription = weatherDescriptions[currentData.weather_descriptions[0]];
            const messageText =
                    `Clima para/Climate to:\n*${location}*\n\n\n` +
                    `🌡 Temp.:\n *${currentData.temperature}ºC*\n\n` +
                    `💨 Vento/Wind (speed):\n *${currentData.wind_speed} km/h*\n\n` +
                    `💨 Vento/Wind (Direction):\n *${currentData.wind_dir}*\n\n` +
                    `💨 Vento/Wind (angle):\n *${currentData.wind_degree}º*\n\n` +
                    `💧 Chuva/Rain (chance):\n *${currentData.precip}%*\n\n` +
                    `💦 Humidade/Himidity:\n *${currentData.humidity}%*\n\n` +
                    `☁️ Nuvem/Cloud (cover):\n *${currentData.cloudcover}%*\n\n` +
                    `🔥 Sensação/Heat index:\n *${currentData.feelslike}ºC*\n\n` +
                    `☀ Ray UV:\n *${currentData.uv_index}*\n\n` +
                    `👀 Visibility:\n *${currentData.visibility} km*\n\n` +
                    `🌞 Dia claro/Sky day:\n *${currentData.is_day === 'yes' ? 'Sim/Yes' : 'Não/No'}*\n\n\n` +
                    `Tempo atual/Current climate:\n*${weatherDescription}*`;

                    client.sendMessage(message.from, messageText);
                    return;

                } catch(e) {

        await message.reply('Ocorreu um erro ao obter as informações meteorológicas. Por favor, tente novamente mais tarde.');
        return undefined;
    }
}




export function handleBotOptions(userConfig, userPhone, buttonText, message) {
    if (buttonText === 'gpt-3.5-turbo') {
      setGptModel(userConfig, 'gpt-3.5-turbo', userPhone);
      message.reply('🤖 GPT: *gpt-3.5-turbo* set');
    } else if (buttonText === 'gpt-4') {
      setGptModel(userConfig, 'gpt-4', userPhone);
      message.reply('🤖 GPT: *gpt-4* set');
    } else if (buttonText === 'auto-gpt') {
      setGptModel(userConfig, 'auto-gpt', userPhone);
      message.reply('🤖 GPT: *auto-gpt* set');
    } else if (buttonText === 'gpt online') {
      setSearchTool(userConfig, true, userPhone);
      message.reply('🤖 GPT *Online*');
    } else if (buttonText === 'gpt offline') {
      setSearchTool(userConfig, false, userPhone);
      message.reply('🤖 GPT *Offline*');
    } else if (buttonText === 'DALLE') {
      setImgModel(userConfig, 'DALLE', userPhone);
      message.reply('📸 IMG: *DALLE* set');
    } else if (buttonText === 'Stable Diffusion') {
      setImgModel(userConfig, 'Stable Diffusion', userPhone);
      message.reply('📸 IMG: *Stable Diffusion* set');
    } else if (buttonText === 'Mid Journey') {
      setImgModel(userConfig, 'Mid Journey', userPhone);
      message.reply('📸 IMG: *Mid Journey* set');
    } else if (buttonText === 'back/voltar') {
      message.reply(`🕹 cancelado/canceled`)
    } 
  }

  setImgModel

  export function handleSpkOptions(userConfig, userPhone, buttonText, message) {
    if (buttonText === 'ON') {
        setTTSEnabled(userConfig, true, userPhone);
      message.reply('🟢 *ON*');
    } else if (buttonText === 'OFF') {
        setTTSEnabled(userConfig, false, userPhone);
      message.reply('🔴 *OFF*');
    } else if (buttonText === 'voz masculina (pt-BR)') {
        setTtsVoiceId(userConfig, 'Ricardo', userPhone);
      message.reply('🗣 *Ricardo* (pt-BR) ativado*');
    } else if (buttonText === 'voz feminina (pt-BR)') {
        setTtsVoiceId(userConfig, 'Vitoria', userPhone);
      message.reply('🗣 *Vitoria* (pt-BR) ativado');
    } else if (buttonText === 'male voice (en-US)') {
        setTtsVoiceId(userConfig, 'Kevin', userPhone);
      message.reply('🗣 *Kevin* (en-US) set');
    } else if (buttonText === 'female voice (en-US)') {
        setTtsVoiceId(userConfig, 'Kimberly', userPhone);
        message.reply('🗣 *Kimberly* (en-US) set');
    } else if (buttonText === 'modo speech-api') {
        setTtsMode(userConfig, TTSMode.AWSPolly, userPhone);
        message.reply('🔈 *Speech-API* set');
    } else if (buttonText === 'modo aws-polly') {
        setTtsMode(userConfig, TTSMode.SpeechAPI, userPhone);
        message.reply('🔈 *Speech-API* set');
    } else if (buttonText === 'back/voltar') {
        message.reply(`🕹 cancelado/canceled`)
    } 
  }

  export function handleAdmOptions(userConfig, userPhone, buttonText, message) {
    if (buttonText === 'ON VIP') {
      authorizedUser(userConfig, true, userPhone);
      message.reply(`VIP adicionado ao número *${userPhone}*`);
    } else if (buttonText === 'OFF VIP') {
      authorizedUser(userConfig, false, userPhone);
      message.reply(`VIP removido ao número *${userPhone}*`);
    } else if (buttonText === 'ON CMD') {
      authorizedUserCommand(userConfig, true, userPhone);
      message.reply(`CMD adicionado ao número *${userPhone}*`);
    } else if (buttonText === 'OFF CMD') {
      authorizedUserCommand(userConfig, false, userPhone);
      message.reply(`CMD removido ao número *${userPhone}*`);
    } else if (buttonText === 'definir 50 msg') {
      setLimitedInteractions(userConfig, 50, userPhone);
      message.reply(`Limite 50 msg definido ao número *${userPhone}*`);
    } else if (buttonText === 'definir 250 msg') {
      setLimitedInteractions(userConfig, 250, userPhone);
      message.reply(`Limite 250 msg definido ao número *${userPhone}*`);
    } else if (buttonText === 'definir 500 msg') {
      setLimitedInteractions(userConfig, 500, userPhone);
      message.reply(`Limite 500 msg definido ao número *${userPhone}*`);
    } else if (buttonText === 'definir 0 msg') {
      setLimitedInteractions(userConfig, 0, userPhone);
        message.reply(`Limite 0 msg definido ao número *${userPhone}*`);
    } else if (buttonText === 'resetar interações') {
      resetInteractions(userConfig, 0, userPhone);
        message.reply(`Interações resetadas para *${userPhone}*`);
    } else if (buttonText === '+ 50 msg') {
      const addCredit =+ 50;
      setLimitedInteractions(userConfig, addCredit, userPhone);
        message.reply(`adicionado + 50 msg ao número *${userPhone}*`);
    } else if (buttonText === 'back/voltar') {
      message.reply(`🕹 cancelado/canceled`)
    } 
  }

  export function handleUrlOptions(userConfig, userPhone, buttonText, message) {
    if (buttonText === 'linkdev') {
      setPlatforUrl(userConfig, 'linkdev', userPhone);
      message.reply(`🛠 *linkdev* set`);
    } else if (buttonText === 'bitly') {
      setPlatforUrl(userConfig, 'bitly', userPhone);
      message.reply(`🛠 *bitly* set`);
    } else if (buttonText === 'cuttly') {
      setPlatforUrl(userConfig, 'cuttly', userPhone);
      message.reply(`🛠 *cuttly* set`);
    } else if (buttonText === 'back/voltar') {
      message.reply(`🕹 cancelado/canceled`)
    } 
  }

 export function shortenLink(client, message, link, userConfig) {
    switch (userConfig.urlShorten) {
      case 'linkdev':
        return shortenLinkEncurtador(client, message, link);
      case 'bitly':
        return shortenLinkBitly(client, message, link);
      case 'cuttly':
        return shortenLinkCuttly(client, message, link);
      default:
        message.reply(
          'O serviço de encurtamento de URL não é suportado. Por favor, verifique a configuração.\n' +
            '_The URL shortening service is not supported. Please check the configuration._'
        );
        return null;
    }
  }

  export function handleSubOptions(userConfig, userPhone, buttonText, message) {
    if (buttonText === '💲 VIP Plan - ∞ unlimited') {
       message.reply(`https://bit.ly/40yn1gM`);
    } else if (buttonText === '💲 Basic Plan - ∞ unlimited') {
      message.reply(`https://bit.ly/3mHds0a`);
    } else if (buttonText === '💲 PIX/Donate, contato') {
      message.reply(`19998790929`);
    } else if (buttonText === 'gerir plano/manage plan') {
      message.reply(`https://bit.ly/3JYfUqM`)
    } else if (buttonText === 'back/voltar') {
      message.reply(`🕹 cancelado/canceled`)
  }
  
  }
  
  export function handleTxtOptions(userConfig, userPhone, buttonText, message) {
    if (buttonText === 'ON') {
      setTranscriptionEnabled(userConfig, true, userPhone);
      message.reply('🟢 *ON*');
    } else if (buttonText === 'OFF') {
      setTranscriptionEnabled(userConfig, false, userPhone);
      message.reply('🔴 *OFF*');
    } else if (buttonText === 'speech-api') {
      setTranscriptionMode(userConfig, TranscriptionMode.SpeechAPI, userPhone);
      message.reply('✍ *speech-api* set');
    } else if (buttonText === 'whisper-api') {
      setTranscriptionMode(userConfig, TranscriptionMode.WhisperAPI, userPhone);
      message.reply('✍ *whisper-api* set');
    } else if (buttonText === 'openai') {
      setTranscriptionMode(userConfig, TranscriptionMode.OpenAI, userPhone);
      message.reply('✍ *openai* set');
    } else if (buttonText === 'back/voltar') {
      message.reply(`🕹 cancelado/canceled`)
    }
  }

  export function createImageAI(client, message, prompt, userConfig) {
    switch (userConfig.dalleModel) {
      case 'DALLE':
        return handleMessageDALLE(client, message, prompt, userConfig);
      case 'Stable Diffusion':
        return handleMessageStableDiffusion(client, message, prompt, userConfig);
      case 'Mid Journey':
        return handleMessageMidJourney(client, message, prompt, userConfig);
    }
  }

  