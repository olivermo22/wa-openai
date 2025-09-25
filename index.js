// WhatsApp (QR login) ↔ OpenAI relay — Node.js

import 'dotenv/config'
import express from 'express'
import pkg from 'whatsapp-web.js'
const { Client, LocalAuth, MessageMedia } = pkg
import qrcodeTerminal from 'qrcode-terminal'
import QRCode from 'qrcode'
import OpenAI from 'openai'

// --- Config ---
const PORT = process.env.PORT || 3000
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const OWNER_NUMBER = process.env.OWNER_NUMBER || '' // ej. 5217220000000

// ======== TUS INSTRUCCIONES (prompt del asistente) ========
const INSTRUCCIONES_BOT = `
Trabajas en una Gestoría llamada "CONSULTORIAVIRTUAL". Eres un bot de servicio al cliente cuya misión es aclarar dudas para tramitar la licencia de conducir del estado de Guerrero. 
De forma proactiva, prioriza siempre mostrar las "respuestas rápidas" 1, 2 y 3 (en ese orden) cuando el cliente pida información general. Si el cliente pregunta por algo específico, usa la sección correspondiente.

[1] INFO INICIAL
¡Hola! Gracias por escribir a Consultoría Virtual.
Te acompañamos paso a paso en el proceso para obtener tu documento de conducción del estado de Guerrero.

- El servicio incluye entrega sin costo adicional dentro del país.
- El documento es expedido por autoridades estatales y puede verificarse en línea.
- El proceso de pago se realiza únicamente después de recibir tu documento en casa.

La entrega puede demorar entre 1 y 2 días hábiles, dependiendo de tu zona. Una vez recibido, cuentas con 48 horas para confirmar el pago.
Si deseas conocer detalles como tipos de licencia, vigencias y requisitos, responde con la palabra "costos".

[2] COSTOS Y VIGENCIAS
Recuerda: Pagas únicamente después de recibir en tu domicilio (48h para confirmar el pago o el documento será dado de baja).
Tipos: 
- Tipo A: Automovilista
- Tipo C: Chofer (automóvil + carga ligera hasta 3.5t)
- Tipo M: Motociclista
Vigencias y costos:
- 3 años: $650
- 5 años: $700
¿Quieres requisitos? Responde “requisitos”.

[3] INICIO DE TRÁMITE (FORMULARIO + FOTOS)
Primero llena el formulario:
👉 https://whatsform.com/7i2sdc
Al finalizar, envíalo por WhatsApp.
Luego comparte:
- INE por ambos lados
- Foto de frente sin lentes (fondo claro, sin gorra)
- Foto de tu firma en hoja blanca
Nuestro equipo verificará y te indicará cómo continuar.

[4] ESTADO: GUERRERO (validez nacional)
El trámite es del estado de Guerrero. Es válido en todo México, con QR y registro en plataforma .gob.mx. Envíos a todo el país: primero recibes y después pagas (depósito/transferencia).

[5] DÓNDE VERIFICAR
https://permisosylicenciascopalillogro.gob.mx/
Datos de contacto oficiales en esa página.

[6] VALIDEZ EN TODO EL PAÍS (marco legal)
Artículo 121, fracción V de la Constitución: los actos/documentos oficiales de un estado son válidos en toda la República si se emiten conforme a la ley de esa entidad. En Guerrero, reglamentos de Tránsito/Movilidad exigen licencia vigente y adecuada. Tu licencia de Guerrero es reconocida en México.

[7] PLACAS
De momento no tramitamos placas. Cuando tengamos opciones, las publicaremos en redes.

[8] ENVÍOS
Se hacen envíos a todo el país. Si la paquetería no llega a tu código postal, se puede enviar a oficina (DHL, FedEx, Estafeta) para que pases a recoger.

[9] FOTO CARACTERÍSTICAS
Color, de frente, visibles ambas orejas y hombros, sin gorra ni lentes, playera/camiseta, fondo claro (mejor blanco).

[10] QUIÉN PUEDE TRAMITAR
Cualquier persona. Extranjeros: residencia temporal o permanente.

[11] DOMICILIO EN LICENCIA
La licencia sale con domicilio del estado de Guerrero. Si no tienes uno, se usa el del ayuntamiento donde se realiza el trámite.

[12] TIPO DE TRÁMITE
Sólo licencias particulares del estado de Guerrero (no servicio público).

[13] SI “NO APARECE” EN CONSULTA
Cada municipio tiene su propia base de datos. Se debe buscar en el municipio correcto.

[14] LISTADO DE PÁGINAS OFICIALES (ejemplos)
Todas terminan en .gob.mx y son válidas.
- https://licencias.guerrero.gob.mx/
- https://direcciondetransitoiliatenco.gob.mx/
- https://licencias.pilcaya.gob.mx/
- https://permisosixcapuzalco.gob.mx/
- https://permisosylicenciascoculagro.gob.mx/
- https://verificaid.acapulco.gob.mx/
- https://permisoscuetzala.gob.mx/
- https://www.ixcateopandecuauhtemocgro.gob.mx
- https://transitotepecoacuilco.gob.mx/
- https://permisosylicenciascopalillogro.gob.mx/
- https://acapetlahuayapermisoslic.gob.mx/
- https://transitomunicipalcuautepecgro.gob.mx/
- https://www.iguala.gob.mx/
- https://permisosylicenciasleonardobravo.gob.mx/
- https://plataforma.direcciontransitotlapadecomonfort.gob.mx/
- https://www.permisos-licenciastetipac.gob.mx/
- https://permisosylicenciasmalinaltepecgro.gob.mx/
- https://buenavistadecuellar.gob.mx/
- https://plataforma.permisoshueycantenango.gob.mx/
- https://licencias.pilcaya.gob.mx/
- https://direcciontransitojuchitan.gob.mx/

[15] ZONAS EXTENDIDAS
Se puede enviar a oficina de paquetería (DHL, FedEx, Estafeta).

[16] ASESOR HUMANO
Si el cliente necesita asesor personal: “Escríbenos a https://wa.me/527225600905”.

[17] DIFERENCIAS DE TIPOS
Automovilista: auto particular. Chofer: auto + carga ligera hasta 3.5t.

[18] REFERENCIAS / CONFIANZA
Facebook (reseñas): https://www.facebook.com/profile.php?id=61559438742815

[19] OTROS TIPOS / ACLARACIONES
En Guerrero: A=Automovilista, B=Chofer, C=Motociclista. Sólo particulares (no federales). Sí funciona para plataformas (Uber, Didi, Rappi). Envíos con DHL/FedEx/Estafeta. No permisos para menores. Extranjeros: residencia temporal o permanente.
Si mandan fotos antes del formulario, pedir primero completar el formulario (tiene botón para enviar por WhatsApp). 
Si mexicano sin INE: puede presentar pasaporte, cartilla militar o cédula.
`
// Si quieres añadir más reglas, colócalas aquí.

const SYSTEM_PROMPT =
  (process.env.SYSTEM_PROMPT || 'Eres un asistente claro, útil y amigable.') +
  '\n\n' + INSTRUCCIONES_BOT.trim()
// ============================================================

// --- OpenAI client ---
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// --- WhatsApp client ---
const wa = new Client({
  authStrategy: new LocalAuth({
    clientId: 'session-main',
    // Para Railway: monta un volumen en /data y usa SESSION_DATA_PATH=/data/session
    dataPath: process.env.SESSION_DATA_PATH || './wwebjs_auth',
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  },
})

// ======== Respuestas rápidas (texto exacto) ========
const R1_INFO_INICIAL = `¡Hola! Gracias por escribir a Consultoría Virtual.
Te acompañamos paso a paso en el proceso para obtener tu documento de conducción del estado de Guerrero.

-El servicio incluye entrega sin costo adicional dentro del país.
-El documento es expedido por autoridades estatales y puede verificarse en línea.
-El proceso de pago se realiza únicamente después de recibir tu documento en casa.

La entrega puede demorar entre 1 y 2 días hábiles, dependiendo de tu zona.
Una vez recibido, cuentas con 48 horas para confirmar el pago.

Si deseas conocer los detalles completos, como tipos de licencia, vigencias y requisitos, solo responde con la palabra "costos" y con gusto te ayudamos.`

const R2_COSTOS = `Estos son los costos y vigencias disponibles para la gestión de tu licencia de conducir del estado de Guerrero:

Recuerda: El pago se realiza únicamente después de que recibes tu licencia en tu domicilio.
Cuentas con un plazo de 48 horas para realizar el pago una vez entregada.
Si no se realiza dentro de ese plazo, el documento será dado de baja por el sistema correspondiente.

Tipos de licencia:
Tipo A: Automovilista
Tipo C: Chofer (automóvil + carga ligera hasta 3.5 toneladas)
Tipo M: Motociclista

Vigencias y costos:
3 años: $650
5 años: $700

¿Te gustaría conocer los requisitos para iniciar tu trámite?
Responde “requisitos” y te los enviamos.`

const R3_REQUISITOS = `Para comenzar tu trámite, primero llena el siguiente formulario en línea:
👉 https://whatsform.com/7i2sdc

Al finalizar, da clic en el botón para enviarlo directamente por WhatsApp.
En ese mismo chat, nuestro equipo revisará tu información y te indicará cómo continuar.

📸 Después, comparte:
• INE por ambos lados
• Foto de frente sin lentes (fondo claro, sin gorra)
• Foto de tu firma en hoja blanca`

const R4_ENVIO = `Se hacen envíos a todo el país. Primero recibes y después pagas por depósito o transferencia. Si tu código postal es zona extendida, podemos enviar a una oficina de paquetería (DHL, FedEx o Estafeta) para que pases a recoger.`
const R5_VALIDEZ = `Tu licencia de Guerrero es válida en todo México (Art. 121 fracción V Constitucional). Además, lleva QR y está en plataformas .gob.mx.`
const R6_VERIFICAR = `Puedes verificar en: https://www.ixcateopandecuauhtemocgro.gob.mx (datos de contacto oficiales ahí mismo).`
const R7_PLACAS = `Por ahora no tramitamos placas. Cuando tengamos opciones, lo publicaremos en nuestras redes.`
const R8_FOTO = `Foto a color, de frente, visibles ambas orejas y hombros, sin gorra ni lentes, playera/camiseta, preferente fondo blanco o claro.`
const R9_ASESOR = `Si necesitas asesor personal, escríbenos a: https://wa.me/527225600905`

// ======== Utilidades ========
function isStatus(msg) { return !msg.from.endsWith('@c.us') }
function isOwn(msg) { return msg.fromMe }
function isGroup(msg) { return msg.from.endsWith('@g.us') }
const sleep = (ms) => new Promise(res => setTimeout(res, ms))

// Sencillo enrutador por palabras clave (prioriza R1 → R2 → R3)
function quickReply(text) {
  const t = (text || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

  // R1: saludos / info
  if (/(hola|buen[aos]|\binfo\b|informacion|mas info|mas informacion|me das informacion|\bhey\b)/.test(t)) {
    return R1_INFO_INICIAL
  }
  // R2: costos
  if (/(costo|costos|precio|precios|vigencia|vigencias|cuanto|cuánto)/.test(t)) {
    return R2_COSTOS
  }
  // R3: requisitos / iniciar
  if (/(requisito|requisitos|que necesito|iniciar tramite|formulario|form|tramite)/.test(t)) {
    return R3_REQUISITOS
  }
  // Otras FAQs
  if (/(envio|envios|entrega|paqueteria|paquetería|dhl|fedex|estafeta|zona extendida)/.test(t)) return R4_ENVIO
  if (/(validez|legal|sirve en todo|nacional|articulo 121|constitucion)/.test(t)) return R5_VALIDEZ
  if (/(verificar|verificacion|qr|pagina|pagina de gobierno|gob.mx)/.test(t)) return R6_VERIFICAR
  if (/(placa|placas|emplacar)/.test(t)) return R7_PLACAS
  if (/(foto|fotografia|fotografía|ine|firma|retrato)/.test(t)) return R8_FOTO
  if (/(asesor|hablar con alguien|ayuda personal)/.test(t)) return R9_ASESOR

  return null
}

// --- Construcción de mensajes para OpenAI ---
const MAX_MEMORY = 8
const memory = new Map() // key: chatId, value: array de {role, content}

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
  const messages = buildMessages(chatId, userText)
  const resp = await openai.chat.completions.create({
    model: MODEL,
    messages,
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
    try {
      await wa.sendMessage(`${OWNER_NUMBER}@c.us`, '✅ Bot WhatsApp ↔ OpenAI iniciado')
    } catch {}
  }
})

wa.on('auth_failure', (m) => console.error('❌ Fallo de autenticación:', m))
wa.on('disconnected', (r) => console.warn('⚠️ Desconectado:', r))

// --- Handler principal de mensajes ---
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

    // Atajo: respuestas rápidas
    const qrAnswer = quickReply(text)

    // Indicador de escritura
    await chat.sendStateTyping()

    // Genera respuesta (atajo o OpenAI)
    const answer = qrAnswer ?? await askOpenAI(chatId, text.length < 2 ? 'Hola' : text)

    // Mantén el typing y aplica retraso de 4s
    await chat.sendStateTyping()
    await sleep(6000)

    // Enviar (en trozos si es largo)
    const chunks = answer.match(/[\s\S]{1,3000}/g) || [answer]
    for (const ch of chunks) {
      await wa.sendMessage(from, ch)
    }
  } catch (err) {
    console.error('Error al procesar mensaje:', err)
    try { await wa.sendMessage(msg.from, '⚠️ Ocurrió un error procesando tu mensaje. Intenta de nuevo.') } catch {}
  }
})

// --- Servidor HTTP simple (healthcheck + QR viewer) ---
const app = express()
const QR_TOKEN = process.env.QR_TOKEN || '' // opcional para proteger el QR

app.get('/', (_, res) => res.send('OK'))
app.get('/healthz', (_, res) => res.send('ok'))

// Imagen PNG del QR (para Railway)
app.get('/qr', (req, res) => {
  if (QR_TOKEN && req.query.token !== QR_TOKEN) return res.status(401).send('Unauthorized')
  if (!lastQRDataURL) return res.status(404).send('QR no disponible')
  const b64 = lastQRDataURL.split(',')[1]
  const img = Buffer.from(b64, 'base64')
  res.setHeader('Content-Type', 'image/png')
  res.send(img)
})

// Página sencilla para escanear
app.get('/scan', (req, res) => {
  if (QR_TOKEN && req.query.token !== QR_TOKEN) return res.status(401).send('Unauthorized')
  res.send(`<!doctype html><html><head><meta charset="utf-8"><title>Escanear QR</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="display:grid;place-items:center;height:100vh;font-family:system-ui">${lastQRDataURL ? `<img src="/qr${QR_TOKEN ? `?token=${QR_TOKEN}` : ''}" alt="QR" style="width:min(90vw,420px);height:auto;border:8px solid #eee;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.1)"/>` : '<p>No hay QR disponible. Espera a que el bot muestre uno en logs.</p>'}<div style="margin-top:16px;color:#666">Abre WhatsApp → Dispositivos vinculados → Vincular un dispositivo</div></body></html>`)
})

app.listen(PORT, () => console.log(`HTTP listo en :${PORT}`))

// --- Inicia ---
wa.initialize()
