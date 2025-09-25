// WhatsApp (QR login) ↔ OpenAI relay — Node.js

import 'dotenv/config'
import express from 'express'
import pkg from 'whatsapp-web.js'
const { Client, LocalAuth, MessageMedia } = pkg
import qrcodeTerminal from 'qrcode-terminal'
import QRCode from 'qrcode'
import OpenAI from 'openai'
import fs from 'fs'

// --- Config ---
const PORT = process.env.PORT || 3000
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const OWNER_NUMBER = process.env.OWNER_NUMBER || '' // ej. 5217220000000

// ======== INSTRUCCIONES DEL BOT (prompt del asistente) ========
const INSTRUCCIONES_BOT = `
Trabajas en una Gestoría llamada "CONSULTORIAVIRTUAL". Eres un bot de servicio al cliente cuya misión es aclarar dudas para tramitar la licencia de conducir del estado de Guerrero.
De forma proactiva, prioriza siempre mostrar las "respuestas rápidas" 1, 2 y 3 (en ese orden) cuando el cliente pida información general. Si el cliente pregunta por algo específico, usa la sección correspondiente.

[1] INFO INICIAL
¡Hola! Gracias por escribir a Consultoría Virtual.
Te acompañamos paso a paso en el proceso para obtener tu documento de conducción del estado de Guerrero.
- El servicio incluye entrega sin costo adicional dentro del país.
- El documento es expedido por autoridades estatales y puede verificarse en línea.
- El proceso de pago se realiza únicamente después de recibir tu documento en casa.
La entrega puede demorar entre 1 y 2 días hábiles según tu zona. Una vez recibido, cuentas con 48 horas para confirmar el pago.
Si deseas conocer detalles como tipos de licencia, vigencias y requisitos, responde con la palabra "costos".

[2] COSTOS Y VIGENCIAS
Pagas únicamente después de recibir en tu domicilio (48h para confirmar el pago o el documento será dado de baja).
Tipos:
- Tipo A: Automovilista
- Tipo C: Chofer (auto + carga ligera hasta 3.5t)
- Tipo M: Motociclista
Vigencias y costos:
- 3 años: $650
- 5 años: $700
¿Quieres requisitos? Responde “requisitos”.

[3] INICIO DE TRÁMITE (FORMULARIO + FOTOS)
Primero llena el formulario:
👉 https://whatsform.com/7i2sdc
Al finalizar, envíalo por WhatsApp.
Luego comparte: INE por ambos lados, foto de frente sin lentes (fondo claro, sin gorra), y foto de tu firma en hoja blanca.

[4] ESTADO: GUERRERO (validez nacional)
El trámite es del estado de Guerrero. Es válido en todo México, con QR y registro en plataforma .gob.mx. Envíos a todo el país: primero recibes y después pagas.

[5] DÓNDE VERIFICAR
https://www.ixcateopandecuauhtemocgro.gob.mx (datos oficiales de contacto ahí mismo).

[6] MARCO LEGAL (validez nacional)
Art. 121 fracción V de la Constitución: documentos oficiales emitidos conforme a la ley de un estado tienen validez en toda la República.

[7] ENVÍOS
Envíos a todo el país. Si tu CP es zona extendida, podemos enviar a oficina (DHL, FedEx, Estafeta) para que pases a recoger.

[8] FOTO CARACTERÍSTICAS
Color, de frente, visibles orejas y hombros, sin gorra ni lentes, playera/camiseta, fondo claro (ideal blanco).

[9] QUIÉN PUEDE TRAMITAR
Cualquier persona. Extranjeros: con residencia temporal o permanente.

[10] DOMICILIO EN LA LICENCIA
Sale con domicilio de Guerrero (del ayuntamiento donde se realiza el trámite).

[11] TIPO DE TRÁMITE
Solo licencias particulares de Guerrero (no servicio público).

[12] “NO APARECE EN CONSULTA”
Cada municipio tiene su propia base. Se debe buscar en el municipio correcto.

[13] PÁGINAS OFICIALES (ejemplos, todas .gob.mx)
https://licencias.guerrero.gob.mx/
https://direcciondetransitoiliatenco.gob.mx/
https://licencias.pilcaya.gob.mx/
https://permisosixcapuzalco.gob.mx/
https://permisosylicenciascoculagro.gob.mx/
https://verificaid.acapulco.gob.mx/
https://permisoscuetzala.gob.mx/
https://www.ixcateopandecuauhtemocgro.gob.mx
https://transitotepecoacuilco.gob.mx/
https://permisosylicenciascopalillogro.gob.mx/
https://acapetlahuayapermisoslic.gob.mx/
https://transitomunicipalcuautepecgro.gob.mx/
https://www.iguala.gob.mx/
https://permisosylicenciasleonardobravo.gob.mx/
https://plataforma.direcciontransitotlapadecomonfort.gob.mx/
https://www.permisos-licenciastetipac.gob.mx/
https://permisosylicenciasmalinaltepecgro.gob.mx/
https://buenavistadecuellar.gob.mx/
https://plataforma.permisoshueycantenango.gob.mx/
https://licencias.pilcaya.gob.mx/
https://direcciontransitojuchitan.gob.mx/

[14] ASESOR HUMANO
Si necesitas asesor personal: https://wa.me/527225600905

[15] DIFERENCIAS TIPOS
Automovilista = auto particular. Chofer = auto + carga ligera hasta 3.5t. Motociclista = moto.
`

const SYSTEM_PROMPT =
  (process.env.SYSTEM_PROMPT || 'Eres un asistente claro, útil y amigable.') +
  '\n\n' + INSTRUCCIONES_BOT.trim()

// --- OpenAI client ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// --- Utilidades varias ---
const sleep = (ms) => new Promise(res => setTimeout(res, ms))
function isStatus(msg) { return !msg.from.endsWith('@c.us') }
function isOwn(msg) { return msg.fromMe }
function isGroup(msg) { return msg.from.endsWith('@g.us') }

// Auto-detección de binario Chromium (para Railway/Dockerfile)
function findChrome() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean)
  return candidates.find(p => { try { return fs.existsSync(p) } catch { return false } }) || null
}
const chromePath = findChrome()

// ===== Fijamos una versión estable de WhatsApp Web =====
const WA_WEB_VER = '2.2412.54' // si algún día falla, cambia por otra del repo wppconnect

// --- WhatsApp client ---
const wa = new Client({
  authStrategy: new LocalAuth({
    clientId: 'session-main',
    dataPath: process.env.SESSION_DATA_PATH || './wwebjs_auth',
  }),

  // Bloquea versión y usa caché remoto con ruta explícita (evita roturas)
  webVersion: WA_WEB_VER,
  webVersionCache: {
    type: 'remote',
    remotePath: `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${WA_WEB_VER}.html`,
  },

  puppeteer: {
    headless: 'new',
    executablePath: chromePath || undefined, // en Dockerfile se fija por ENV; local puede usar el propio
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1280,800',
      '--lang=es-ES,es',
    ],
  },
})

// ======== Respuestas rápidas ========
const R1_INFO = `¡Hola! Gracias por escribir a Consultoría Virtual.
Te acompañamos paso a paso en el proceso para obtener tu documento de conducción del estado de Guerrero.
- El servicio incluye entrega sin costo adicional dentro del país.
- El documento es expedido por autoridades estatales y puede verificarse en línea.
- El proceso de pago se realiza únicamente después de recibir tu documento en casa.

La entrega puede demorar entre 1 y 2 días hábiles, dependiendo de tu zona.
Una vez recibido, cuentas con 48 horas para confirmar el pago.

Si deseas conocer los detalles completos, como tipos de licencia, vigencias y requisitos, solo responde con la palabra "costos" y con gusto te ayudamos.`

const R2_COSTOS = `Estos son los costos y vigencias disponibles para la gestión de tu licencia de conducir del estado de Guerrero:

Tipos de licencia:
• Tipo A: Automovilista
• Tipo C: Chofer (automóvil + carga ligera hasta 3.5 t)
• Tipo M: Motociclista

Vigencias y costos:
• 3 años: $650
• 5 años: $700

Recuerda: el pago se realiza únicamente después de que recibes tu licencia en tu domicilio (48 h para confirmar).
¿Te comparto los requisitos? Responde “requisitos”.`

const R3_REQ = `Para iniciar tu trámite:
1) Completa el formulario 👉 https://whatsform.com/7i2sdc (al final puedes enviarlo por WhatsApp).
2) Comparte en este chat:
   • INE por ambos lados
   • Foto de frente sin lentes (fondo claro, sin gorra)
   • Foto de tu firma en hoja blanca`

const R4_ENVIO = `Envíos a todo el país. Si tu CP es zona extendida, podemos enviar a oficina (DHL/FedEx/Estafeta) para recoger.`
const R5_VALIDEZ = `Validez nacional (Art. 121 fracc. V). Licencia con QR y registro en plataformas .gob.mx.`
const R6_VERIF = `Verificación en línea: https://www.ixcateopandecuauhtemocgro.gob.mx`
const R7_ASESOR = `¿Necesitas asesor humano? Escríbenos: https://wa.me/527225600905`

function quickReply(text) {
  const t = (text || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
  if (/(hola|buenas|info|informacion|hey)/.test(t)) return R1_INFO
  if (/(costo|costos|precio|precios|vigencia|vigencias|cuanto|cuánto)/.test(t)) return R2_COSTOS
  if (/(requisito|requisitos|tramite|formulario|form)/.test(t)) return R3_REQ
  if (/(envio|entrega|paqueteria|dhl|fedex|estafeta|zona extendida)/.test(t)) return R4_ENVIO
  if (/(validez|legal|nacional|constitucion|articulo 121)/.test(t)) return R5_VALIDEZ
  if (/(verificar|verificacion|qr|gob\.mx|pagina)/.test(t)) return R6_VERIF
  if (/(asesor|humano|ayuda personal)/.test(t)) return R7_ASESOR
  return null
}

// --- Memoria por chat y OpenAI helpers ---
const MAX_MEMORY = 8
const memory = new Map() // key: chatId, value: [{role, content}]

function pushMemory(chatId, role, content) {
  if (!memory.has(chatId)) memory.set(chatId, [])
  const arr = memory.get(chatId)
  arr.push({ role, content })
  while (arr.length > MAX_MEMORY) arr.shift()
}

function buildMessages(chatId, userText) {
  const hist = memory.get(chatId) || []
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }]
  for (const m of hist) messages.push(m)
  messages.push({ role: 'user', content: userText })
  return messages
}

async function askOpenAI(chatId, userText) {
  const resp = await openai.chat.completions.create({
    model: MODEL,
    messages: buildMessages(chatId, userText),
    temperature: 0.3,
  })
  const answer = resp.choices?.[0]?.message?.content?.trim() || 'Lo siento, no pude generar respuesta.'
  pushMemory(chatId, 'user', userText)
  pushMemory(chatId, 'assistant', answer)
  return answer
}

// --- QR / Ready / Auth ---
let lastQRDataURL = null
wa.on('qr', async (qr) => {
  qrcodeTerminal.generate(qr, { small: true })
  console.log('\nEscanea este QR desde WhatsApp → Dispositivos vinculados')
  try { lastQRDataURL = await QRCode.toDataURL(qr, { scale: 8 }) } catch {}
})

wa.on('ready', async () => {
  console.log('✅ WhatsApp listo')
  if (OWNER_NUMBER) {
    try { await wa.sendMessage(`${OWNER_NUMBER}@c.us`, '✅ Bot WhatsApp ↔ OpenAI iniciado') } catch {}
  }
})

wa.on('auth_failure', (m) => console.error('❌ Fallo de autenticación:', m))
wa.on('disconnected', (r) => console.warn('⚠️ Desconectado:', r))

// --- Mensajes entrantes ---
wa.on('message', async (msg) => {
  try {
    if (isStatus(msg)) return
    if (isOwn(msg)) return
    if (isGroup(msg)) return // permite grupos quitando esta línea

    const chat = await msg.getChat()
    const chatId = chat.id._serialized
    const from = msg.from
    const text = (msg.body || '').trim()
    if (!text) return

    // Atajos de “respuestas rápidas”
    const qrAnswer = quickReply(text)

    await chat.sendStateTyping()
    const answer = qrAnswer ?? await askOpenAI(chatId, text.length < 2 ? 'Hola' : text)

    // Mantén typing y espera 4s para humanizar
    await chat.sendStateTyping()
    await sleep(4000)

    // Envío normal (sin monoespaciado) para que WhatsApp aplique su formato
    const chunks = answer.match(/[\s\S]{1,3000}/g) || [answer]
    for (const ch of chunks) {
      await wa.sendMessage(from, ch, { linkPreview: false })
    }
  } catch (err) {
    console.error('Error al procesar mensaje:', err)
    try { await wa.sendMessage(msg.from, '⚠️ Ocurrió un error procesando tu mensaje. Intenta de nuevo.', { linkPreview: false }) } catch {}
  }
})

// --- HTTP (health + QR viewer para Railway) ---
const app = express()
const QR_TOKEN = process.env.QR_TOKEN || '' // opcional para proteger el QR

app.get('/', (_, res) => res.send('OK'))
app.get('/healthz', (_, res) => res.send('ok'))

app.get('/qr', (req, res) => {
  if (QR_TOKEN && req.query.token !== QR_TOKEN) return res.status(401).send('Unauthorized')
  if (!lastQRDataURL) return res.status(404).send('QR no disponible')
  const b64 = lastQRDataURL.split(',')[1]
  const img = Buffer.from(b64, 'base64')
  res.setHeader('Content-Type', 'image/png')
  res.send(img)
})

app.get('/scan', (req, res) => {
  if (QR_TOKEN && req.query.token !== QR_TOKEN) return res.status(401).send('Unauthorized')
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Escanear QR</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="display:grid;place-items:center;height:100vh;font-family:system-ui">${lastQRDataURL ? `<img src="/qr${QR_TOKEN ? `?token=${QR_TOKEN}` : ''}" alt="QR" style="width:min(90vw,420px);height:auto;border:8px solid #eee;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.1)"/>` : '<p>No hay QR disponible. Espera a que el bot muestre uno en logs.</p>'}<div style="margin-top:16px;color:#666">Abre WhatsApp → Dispositivos vinculados → Vincular un dispositivo</div></body></html>`)
})

app.listen(PORT, () => console.log(`HTTP listo en :${PORT}`))

// --- Inicia ---
wa.initialize()
