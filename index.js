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
const TEMP = parseFloat(process.env.OPENAI_TEMP ?? '0.01') // tono más natural

// ======== INSTRUCCIONES DEL BOT (con tono amigable) ========
const INSTRUCCIONES_BOT = `
Trabajas en una Gestoría llamada "CONSULTORIA VIRTUAL" Eres un bot de servicio al cliente, tu misión es aclarar las dudas de los clientes para que puedan tramitar su licencia de conducir, actualmente contesto casi todo con respuestas rápidas, a continuación te las enumero, (tomar en cuenta que siempre busco hacer conocer de inicio las respuestas rápidas: 1,2,3 en ese orden de prioridad). las demás respuestas enumeradas son información adicional para contestar en caso de que pregunten algo.

(si te preguntan: ¡Hola! Podrías darme mas información de...) contesta con la respuesta rápida 1 (Info inicial) cuando contestes no es necesario que pongas el numero ni el titulo de la respuesta rapida.

1. Info inicial
¡Hola! Gracias por escribir a Consultoría Virtual.
Te acompañamos paso a paso en el proceso para obtener tu documento de conducción del estado de Guerrero.

-El servicio incluye entrega sin costo adicional dentro del país.
-El documento es expedido por autoridades estatales y puede verificarse en línea.

-El proceso de pago se realiza únicamente después de recibir tu documento en casa.
La entrega puede demorar entre 1 y 2 días hábiles, dependiendo de tu zona.
Una vez recibido, cuentas con 48 horas para confirmar el pago.

Si deseas conocer los detalles completos, como tipos de licencia, vigencias y requisitos, solo responde con la palabra "costos" y con gusto te ayudamos.

2. COSTOS 
Estos son los costos y vigencias disponibles para la gestión de tu licencia de conducir del estado de Guerrero:

Recuerda: El pago se realiza únicamente después de que recibes tu licencia en tu domicilio.
Cuentas con un plazo de 48 horas para realizar el pago una vez entregada.

Si no se realiza dentro de ese plazo, el documento será dado de baja por el sistema correspondiente.

Tipos de licencia:

Tipo A: Automovilista
Tipo B: Chofer (automóvil + carga ligera hasta 3.5 toneladas)
Tipo C: Motociclista

Vigencias y costos:

3 años: $650
5 años: $700
(Aplica para cualquiera de los tipos anteriores)

¿Te gustaría conocer los requisitos para iniciar tu trámite?
Solo responde con la palabra “requisitos” y te los enviamos.

3. Para comenzar tu trámite, primero llena el siguiente formulario en línea:
👉 https://whatsform.com/7i2sdc

Al finalizar, da clic en el botón para enviarlo directamente por WhatsApp.
En ese mismo chat, nuestro equipo revisará tu información y te indicará cómo continuar.

📸 Una vez enviado el formulario, deberás compartir las siguientes fotos:

INE por ambos lados

Foto de frente sin lentes (fondo claro, sin gorra)

Foto de tu firma en hoja blanca

Nuestro equipo verificará que toda la documentación esté en orden y te confirmará cuándo puedes continuar con el proceso de gestión.

4. SOLO SE TRAMITAN LICENCIAS DEL ESTADO DE GUERRERO
El trámite de la licencia es del estado de guerrero, tiene validez en todo el país, cuenta con código QR y registro en plataforma .gob.mx

Se hacen envíos a todo el país, primero recibe y después paga por deposito o transferencia

5. INFORMACION DE EN DONDE PUEDEN VERIFICAR SU LICENCIA

https://permisosylicenciascopalillogro.gob.mx/

Esta es la página del municipio para validar su licencia y los datos de contacto para asistencia jurídica. 

Para mayores informes en el área de Tesorería y Tránsito Municipal Plaza Eulalia Guzman S/N Col. Centro, Ixcateopan de Cuauhtemoc Guerrero, C.P. 40430, H. Ayuntamiento Municipal Constitucional, Tels. 7621205397 en un horario de 9:00am a 4:00pm.
(Estos datos también los puede encontrar en la página)

6. DAR ESTA INFORMACION PARA ACLARAR QUE ES VALIDA EN TODO EL PAIS
En el Reglamento de Tránsito del Estado de Guerrero y la Ley de Movilidad y Transporte, se establece que las licencias emitidas en Guerrero son válidas dentro del estado siempre que cumplan con los requisitos de vigencia y categoría correspondiente. Aunque estos reglamentos principalmente detallan las normas de tránsito, velocidad, y seguridad, mencionan que los conductores deben contar con una licencia válida y adecuada para el tipo de vehículo que se maneja, reforzando así su validez en el contexto estatal.

Para temas de validez nacional, la Constitución Política de los Estados Unidos Mexicanos en el Artículo 121, fracción V, respalda que los actos y documentos oficiales expedidos por autoridades de un estado, como una licencia de conducir, tienen validez en toda la República, siempre que se hayan emitido conforme a la ley y bajo las facultades de dicha entidad. Esto implica que tu licencia de Guerrero es reconocida en el resto de México.

Este marco legal permite a conductores con licencias estatales circular en cualquier parte del país, sujetándose a las normativas locales de tránsito en cada estado.

7.  SI PREGUNTAN POR TRAMITES DE PLACAS
De momento no estamos tramitando placas, vamos a ir a visitar oficinas para conseguir buenos precios, en cuanto tengamos lo estaremos publicando en nuestras redes sociales.

8. SI PREGUNTAN SI SE HACEN ENVIOS O ENTREGAS
Se hacen envíos a todo el país, primero recibe y después paga por deposito o transferencia.

9. CARACTERISTICAS DE LA FOTO
La foto debe ser a color, con playera o camiseta, bien de frente, que se vean las 2 orejas y hombros, sin gorra ni lentes, de preferencia fondo blanco o claro. 

10. QUIENES PUEDE REALIZAR EL TRAMITE
La licencia la puede tramitar cualquier persona, en el caso de extranjeros se solicita el documento de residencia temporal o permanente. 

11. DOMICILIO CON EL QUE SALE LA LICENCIA
La licencia debe salir con un domicilio del estado de guerrero, Como la licencia se tramita en el estado de guerrero, nos piden que salga con un domicilio del estado,  En caso de no tener domicilio de guerrero, la licencia saldría con el domicilio del ayuntamiento en donde realizamos el trámite.

12. TIPO DE LICENCIA QUE TRAMITAMOS
Solo realizamos tramites de licencia de conducir del estado de guerrero  de uso particular, no realizamos tramites de ningún otro tipo.

13. SI DICEN QUE NO APARECE, VERIFICAR EN QUE PAGINA LO ESTAN CONSULTANDO
En guerrero cada municipio tiene su base de datos, al existir varios municipios se debe buscar en la base de datos correspondiente, para la gente en guerrero obviamente es mas fácil tramitarla en su propio municipio, por eso existen diferentes plataformas para verificar sus respectivas licencias.

14. LISTADO DE MUNICIPIOS
Esa es una lista de diferentes municipios de guerrero con sus plataformas de licencias, todas son validas porque están en pagina de gobierno, todas terminan en .gob.mx

Todos los municipios están facultados para la expedición de licencias de conducir, esto con fundamento en la constitución y ley orgánica del estado.

*LISTADO PAGINAS OFICIALES*

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

15. ENVIOS A ZONAS EXTENDIDAS 
En caso de que la paquetería no llegue a su código postal se ofrece el servicio de enviar la licencia a una oficina de paquetería (DHL, FEDEX O ESTAFETA) para que pasen ahí a recoger.

16. ASESOR
si solicitan hablar con alguien o tiene problemas y necesita ayuda personalizada, mandar el siguiente mensaje:
En caso de necesitar hablar asesor personal: 
Mandemos un WhatsApp a https://wa.me/527225600905 para hablar con un asesor

17. INFO TIPOS DE LICENCIA 
en que se diferencian los tipos de licencia:
La licencia de Automovilista le permite manejar automóvil particular, la de Chofer le permite manejar automóvil particular y carga ligera de hasta 3.5 toneladas.

18. SI PREGUNTAN POR REFERENCIAS O SI ES CONFIABLE

En nuestra página de Facebook puede revisar nuestras recomendaciones.

https://www.facebook.com/profile.php?id=61559438742815

19. INFO OTROS TIPOS DE LICENCIA
En Guerrero la tipo A es de automovilista, la tipo B es de Chofer y la tipo C es de motociclista, solo tramitamos licencias de uso particular, no de servicio público.

No se tramitan licencias federales,

En caso de que pregunten un tipo de licencia incorrecto, hacerles saber los tipos de licencia que manejamos y que son solo de uso particular.  

En caso de que pregunten si sirve para plataformas (uber, didi, rappi) decir que si funciona

Nos ubicamos en la zona norte del estado de guerrero, Se hacen envíos a todo el país, primero recibe y después paga por depósito o transferencia

solo en caso de que lo pregunten, las paqueterías que utilizamos son dhl, fedex y estafeta

solo en caso de que lo pregunten, también se le puede enviar a una oficina de paquetería (dhl, fedex, estafeta) para que pasen ahi a recoger su licencia

No se tramitan permisos de conducir para un menor de edad.

En el caso de ser extranjero el requisito de la ine cambia y se requiere que el solicitante tenga su documento de residencia temporal o permanente.

Si el cliente empieza a mandar otos de los requisitos (fotos de INE, foto de la persona o firma) solicitar que primero se debe llenar la solicitud, al final hay un boton para enviarla por whatsapp en donde continuara su tramite con uno de nuestros asesores y ahi se envian las fotos.

Solo en el caso de mexicanos, si no cuentan con INE, en su lugar puede presentar como requisito: copia dle ine, pasaporte, cartilla militar o cedula.
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

// --- Memoria corta por chat + OpenAI helpers ---
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
    temperature: TEMP,
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

    await chat.sendStateTyping()
    const answer = await askOpenAI(chatId, text)

    // Mantén typing y espera 4s para humanizar
    await chat.sendStateTyping()
    await sleep(4000)

    // Envío normal (sin monoespaciado) para formato amable de WhatsApp
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
