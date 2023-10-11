/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import { onRequest } from 'firebase-functions/v2/https'
import * as logger from 'firebase-functions/logger'
import { Client as NotionClient } from '@notionhq/client'
import { messagingApi, WebhookEvent } from '@line/bot-sdk'
import { shuffleArray } from './util'
import { DatabaseObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import { setGlobalOptions } from 'firebase-functions/v2'

setGlobalOptions({ maxInstances: 3 })

const lineClient = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN as string,
})
const notionClient = new NotionClient({
  auth: process.env.NOTION_SECRET,
})

export const lineWebhook = onRequest(
  {
    secrets: ['LINE_CHANNEL_ACCESS_TOKEN', 'NOTION_SECRET', 'NOTION_ENGLISH_FLASH_DATABASE_ID'],
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).end()
      return
    }

    logger.info('LINE Webhook invoked!', { structuredData: true })

    let replyMessage = ''
    const events = request.body.events as WebhookEvent[]
    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'text') {
        const notionResponse = await notionClient.databases.query({
          database_id: process.env.NOTION_ENGLISH_FLASH_DATABASE_ID as string,
        })

        const shuffledArray = shuffleArray(notionResponse.results as DatabaseObjectResponse[])
        const selectedRecords = shuffledArray.slice(0, 3)
        replyMessage = createMessage(selectedRecords)
        await sendTextReply(event.replyToken, replyMessage)
      }
    }

    response.status(200).send(replyMessage)
  }
)

const createMessage = (records: any[]): string => {
  return records
    .map((record) => {
      const wordPhrase = record.properties['word/phrase'].title
        .map((title: { text: { content: string } }) => title.text.content)
        .join('')
      logger.info(`Word/Phrase: ${wordPhrase}`, { structuredData: true })

      const selectedType = record.properties['type'].select.name
      logger.info(`Selected Type: ${selectedType}`, { structuredData: true })

      let result = ''
      switch (selectedType) {
        case 'word': {
          const meaning = joinRichTexts(record.properties['meaning'].rich_text)
          const example = joinRichTexts(record.properties['example'].rich_text)
          logger.info(`example rich_text: ${JSON.stringify(record.properties['example'].rich_text)}`, {
            structuredData: true,
          })
          result = `${wordPhrase}\n\n${meaning}\n\nExample:\n${example}`
          break
        }
        case 'pronunciation': {
          const sound = joinRichTexts(record.properties['sound'].rich_text)
          result = `${wordPhrase}\n\nSound:\n${sound}`
          break
        }
        case 'phrase': {
          const meaning = joinRichTexts(record.properties['meaning'].rich_text)
          result = `${wordPhrase}\n\n${meaning}`
          break
        }
        case 'tips': {
          const meaning = joinRichTexts(record.properties['meaning'].rich_text)
          result = `${wordPhrase}\n\n${meaning}`
          break
        }
      }

      logger.info(`Message Result: ${result}`, { structuredData: true })
      return result.trim()
    })
    .join('\n\n---------\n')
}

const joinRichTexts = (richTexts: any[]): string => {
  return richTexts
    .map((richText) => {
      return richText.plain_text
    })
    .join('')
}

const sendTextReply = async (replyToken: string, message: string) => {
  return lineClient.replyMessage({
    replyToken: replyToken,
    messages: [
      {
        type: 'text',
        text: message,
      },
    ],
  })
}
