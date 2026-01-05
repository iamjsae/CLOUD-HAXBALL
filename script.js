const room = HBInit({
  roomName: "🔝 | 𝐒𝐭𝐮𝐩𝐢𝐝 𝐍𝐢𝐠𝐠𝐚 𝐁𝐫𝐚𝐢𝐧 𝐱𝟒 | 🔝", 
  maxPlayers: 30,
  public: false,
  noPlayer: true,
  token: "thr1.AAAAAGf746Ke9o96UgFKmQ.UiQcSRoVbiU",
  geo: { code: "co", lat: 10.9639, lon: -74.7964 }
});



const state = {
  rolesEnabled: true,
  commandsEnabled: true,
  matchInProgress: false,
  lastMatchEnd: null
};
let notificationSent = false;
let matchLogs = [];
let matchEvents = [];

let playerStats = {
  
 "id_jugador": {
    wins: 0,       // Victorias
    losses: 0,     // Derrotas
    goals: 0,      // Goles
    assists: 0,    // Asistencias
    cs: 0,         // Clean Sheets
    lastKnownName: "Nombre" // Último nombre conocido
  }
};

function sanitizeStats(stats) {
  const cleanStats = {};
  for (const [playerId, playerData] of Object.entries(stats)) {
    cleanStats[playerId] = {
      wins: Number(playerData.wins) || 0,
      losses: Number(playerData.losses) || 0,
      goals: Number(playerData.goals) || 0,
      assists: Number(playerData.assists) || 0,
      cs: Number(playerData.cs) || 0,
      lastKnownName: String(playerData.lastKnownName || "")
    };
  }
  return cleanStats;
}





// Añadir funciones faltantes
function registrarActividadChat(player) {
    playerLastActivity.set(player.id, Date.now());
}

function checkRoomState() {
    console.log("Estado de la sala verificado");
}


// ======================
// CONFIGURACIÓN DE FIREBASE
// ======================

// 1. Configuración de Firebase (usa tus datos reales)
const firebaseConfig = {
apiKey: "AIzaSyAa3TOmPwaUBmQRlHaS48rmppqJYjaWwF8",
databaseURL: "https://host-by-jsae-default-rtdb.firebaseio.com"
};

// 2. Función para cargar Firebase dinámicamente
function loadFirebase() {
return new Promise((resolve) => {
  if (typeof firebase === 'undefined') {
    const script = document.createElement('script');
    script.src = 'https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js';
    script.onload = () => {
      const scriptDB = document.createElement('script');
      scriptDB.src = 'https://www.gstatic.com/firebasejs/9.0.0/firebase-database-compat.js';
      scriptDB.onload = resolve;
      document.head.appendChild(scriptDB);
    };
    document.head.appendChild(script);
  } else {
    resolve();
  }
});
}

// 3. Función para cargar estadísticas desde Firebase
async function cargarEstadisticas() {
try {
  const snapshot = await firebase.database().ref('playerStats').once('value');
  const data = snapshot.val();

  if (data) {
    playerStats = data;
    console.log("📊 Estadísticas cargadas desde Firebase");

    // Actualiza nombres de jugadores conectados
    room.getPlayerList().forEach(p => {
      if (playerStats[p.id]) {
        roleSystem.updatePlayerNameWithRole(p);
      }
    });
  } else {
    playerStats = {};
    console.log("📊 No hay estadísticas guardadas en Firebase");
  }
} catch (error) {
  console.error("❌ Error cargando stats desde Firebase:", error);
  playerStats = {};
}
}

async function guardarEstadisticas() {
  try {
    const statsToSave = sanitizeStats(playerStats);
    await firebase.database().ref('playerStats').set(statsToSave);
    console.log("💾 Estadísticas guardadas en Firebase");
  } catch (error) {
    console.error("❌ Error guardando stats en Firebase:", error);
    
    // Opcional: Intentar guardar solo datos válidos
    const statsToSave = sanitizeStats(playerStats);
    try {
      await firebase.database().ref('playerStats_backup').set(statsToSave);
      console.log("📦 Estadísticas guardadas en backup");
    } catch (e) {
      console.error("❌ Error guardando backup:", e);
    }
  }
}



// Mejorar la inicialización con verificación de estado
let firebaseInitialized = false;
let firebaseInitializing = false;

async function initializeRoom() {
  if (firebaseInitializing) return;
  firebaseInitializing = true;
  
  try {
      await loadFirebase();
      // Verificar si Firebase ya está inicializado
      if (!firebase.apps || firebase.apps.length === 0) {
          firebase.initializeApp(firebaseConfig);
      }
      
      firebaseInitialized = true;
      console.log("✅ Firebase inicializado correctamente");
      
      // Cargar estadísticas con timeout
      await Promise.race([
          cargarEstadisticas(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout cargando stats")), 10000))
      ]);
      
  } catch (error) {
      console.error("❌ Error inicializando Firebase:", error);
      firebaseInitialized = false;
      // Continuar sin Firebase pero desactivar funciones dependientes
      room.sendAnnouncement("⚠️ Modo offline activado - Estadísticas no disponibles", null, 0xFFA500);
  } finally {
      firebaseInitializing = false;
  }
}

// Inicializar la sala
initializeRoom();


const jugadoresVerificando = new Map();

// Define comandos object to handle command cooldowns and admin-only commands
const comandos = {
  cooldowns: {},
  adminOnly: new Set(["!clearbans", "!rstats", "!fill", "!swap", "!rr", "!mute"]),

  checkCooldown: function(playerId, command) {
      const key = `${playerId}_${command}`;
      return this.cooldowns[key] && Date.now() - this.cooldowns[key] < COOLDOWN_GENERAL;
  },

  getCooldownTime: function(playerId, command) {
      const key = `${playerId}_${command}`;
      return Math.ceil((COOLDOWN_GENERAL - (Date.now() - this.cooldowns[key])) / 1000);
  },

  setCooldown: function(playerId, command) {
      const key = `${playerId}_${command}`;
      this.cooldowns[key] = Date.now();
  }
};



// Función addMatchEvent faltante:
function addMatchEvent(type, details) {
  const now = Date.now();
  const timestamp = matchStartTime ? now - matchStartTime : 0;
  const event = {
      time: now,
      type,
      details,
      gameTime: `${Math.floor(timestamp/1000)}s`
  };

  matchEvents.push(event);
  matchLogs.push(`[${event.gameTime}] ${type}: ${details}`);

  // Límite de 100 eventos para evitar sobrecarga
  if (matchEvents.length > 100) {
      matchEvents.shift();
      matchLogs.shift();
  }
}



 
async function sendToDiscord(webhookUrl, message, embed = null) {
  try {
      const payload = {
          content: message,
          embeds: embed ? [embed] : []
      };

      const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
      });

      if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status}`);
      }
  } catch (error) {
      console.error("Error al enviar a Discord:", error);
      throw error; // Relanza el error para manejo adicional si es necesario
  }
}

function initPlayerStats() {
  return {
    wins: 0,
    losses: 0,
    goals: 0,
    assists: 0,
    cs: 0,
    lastKnownName: "",
    position: "field"
  };
}














const playerLastActivity = new Map();
const messageHistory = new Map();


const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/13788458874504872097/P8a_DdjiKmxLaWhWraZA3isavb5ydkwwxcJwskcne171IDHu361jHPiemQZRm_xrGHhG";
let equipoGanadorAnterior = null;
let triviaEnCurso = false;
let jugadoresTrivia = []; // Almacena IDs de jugadores en trivia
let preguntasTrivia = []; // Preguntas seleccionadas
let preguntaActual = null;
let tiempoLimite = null;
let temporizador = null;
let puntos = {}; // Puntos por jugador
let preguntaNumero = 0;
const MAX_PREGUNTAS = 6;
const TIEMPO_RESPUESTA = 20; // segundos
let votacion = null;
let matchStartTime = null;
let matchStartTimestamp = null;
let votacionTimeout = null;
let contador = 0;
const firmas = {};
// Añadir estas variables globales al inicio:
let votacionKick = null;
let votacionKickTimeout = null;
let siguienteNumero = 1;
let cargandoContador = false;
const messageCooldowns = new Map();
// Limitar frecuencia de actualizaciones
let lastUpdate = 0;
let lastGlobalMessage = 0;
let redTeam = [];
let blueTeam = [];

// Variables para control de frecuencia
let lastGameStart = 0;
let lastGameStop = 0;

  

  

function getRandomPhrase(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// 1. Primero definimos jugadoresMuteados si no está definido
if (typeof jugadoresMuteados === 'undefined') {
  var jugadoresMuteados = new Map();
}

const deadPlayers = new Set();
// Función para obtener elemento aleatorio de un array
Array.prototype.random = function() {
  return this[Math.floor(Math.random() * this.length)];
};
// Variables para !silent
let silentMode = false;
let lastSilent = 0;

// Variables para !ki y !atki
const kiPlayers = {}; // Almacena carga de ki: { playerId: { charge: 0, lastUsed: 0 } }

// Diccionario para !lag
const hardwareReal = [
  { modelo: "Ryzen 9 7950X", problema: "overclockeado con aceite de cocina" },
  { modelo: "RTX 4090", problema: "minando Bitcoin en segundo plano" },
  { modelo: "Conexión 5G", problema: "interferencia de chemtrails" },
  { modelo: "SSD Samsung 980 Pro", problema: "lleno de memes de 2012" }
];

function getRandomPhrase(list) {
  return list[Math.floor(Math.random() * list.length)];
}



// Función corregida para iniciar apuestas
function iniciarApuestas() {
    // Reiniciar apuestas
    apuestas = {
        red: new Set(),
        blue: new Set(),
        votacionAbierta: true,
        tiempoInicio: Date.now()
    };

    enviarMensajeGlobal(
        "🎰 ¡APUESTAS ABIERTAS! 🎰\n" +
        "━━━━━━━━━━━━━━━━━━━━━━━━\n" +
        "🔴 Usa: !apostar red\n" +
        "🔵 Usa: !apostar blue\n" +
        "⏳ Tienes 30 segundos para apostar!\n" +
        "💰 El equipo ganador recibirá reconocimiento",
        0xFFD700,  // Color dorado
        "bold"
    );

    // Temporizador para cerrar apuestas
    setTimeout(() => {
        if (apuestas.votacionAbierta) {
            apuestas.votacionAbierta = false;
            enviarMensajeGlobal(
                "⏰ APUESTAS CERRADAS\n" +
                `🔴 ${apuestas.red.size} jugadores | 🔵 ${apuestas.blue.size} jugadores`,
                0xFF6347  // Color tomate
            );
        }
    }, 30000); // 30 segundos
}

function processReplacement(team) {
  const players = room.getPlayerList();
  const specs = players.filter(p => p.team === 0 && !jugadoresAFK.has(p.id));

  if (specs.length === 0) return;

  // Encontrar el jugador que lleva más tiempo en espectador
  const replacement = specs.reduce((prev, current) => 
      (prev.joinOrder < current.joinOrder) ? prev : current
  );

  room.setPlayerTeam(replacement.id, team);
  enviarMensajeGlobal(
      `🔄 ${replacement.name} reemplaza al jugador que salió (Equipo ${team === 1 ? 'Rojo' : 'Azul'})`,
      0xFFFF00
  );
}


function updateTeams() {
  const players = room.getPlayerList();
  redTeam = players.filter(p => p.team === 1);
  blueTeam = players.filter(p => p.team === 2);
}

function iniciarTrivia() {
    if (triviaEnCurso) return;

    triviaEnCurso = true;
    preguntaNumero = 0;

    // Cargar preguntas aleatorias con ponderación por dificultad
    preguntasTrivia = [...TODAS_LAS_PREGUNTAS]
        .sort(() => 0.5 - Math.random())
        .slice(0, MAX_PREGUNTAS);

    siguientePregunta();
}

function siguientePregunta() {
    clearTimeout(temporizador);

    if (preguntaNumero >= MAX_PREGUNTAS || preguntasTrivia.length === 0) {
        finalizarTrivia();
        return;
    }

    preguntaActual = preguntasTrivia[preguntaNumero++];
    tiempoLimite = Date.now() + TIEMPO_RESPUESTA * 1000;

    let mensaje = `❓ PREGUNTA ${preguntaNumero}/${MAX_PREGUNTAS}:\n${preguntaActual.pregunta}\n`;
    preguntaActual.opciones.forEach((op, i) => {
        mensaje += `${String.fromCharCode(65 + i)}) ${op.texto}\n`;
    });

    enviarMensajeGlobal(mensaje, 0x3498DB);

    temporizador = setTimeout(() => {
        if (triviaEnCurso) {
            const respuestaCorrecta = preguntaActual.opciones.find(op => op.correcta).texto;
            enviarMensajeGlobal(
                `⏰ Tiempo terminado! La respuesta correcta era: ${respuestaCorrecta}\n` +
                `📚 Explicación: ${obtenerExplicacion(preguntaActual.pregunta)}`,
                0xFF5555
            );
            siguientePregunta();
        }
    }, TIEMPO_RESPUESTA * 1000);
}

function obtenerExplicacion(pregunta) {
     const explicaciones = {
        "¿Cuál es el planeta más grande del sistema solar?": "Júpiter es el gigante gaseoso y el planeta más masivo, con más del doble de la masa de todos los demás planetas combinados.",
        "¿Quién pintó la 'Mona Lisa'?": "La 'Mona Lisa' (o La Gioconda) fue pintada por el artista del Renacimiento italiano Leonardo da Vinci, y se exhibe en el Museo del Louvre.",
        "¿Cuántos lados tiene un hexágono?": "Un hexágono es un polígono que se caracteriza por tener exactamente seis lados y seis vértices.",
        "¿Cuál es el elemento químico con el símbolo 'O'?": "El símbolo 'O' representa al Oxígeno, un gas vital para la respiración y un componente clave del agua (H₂O).",
        "¿En qué año comenzó la Primera Guerra Mundial?": "La Primera Guerra Mundial comenzó en 1914, tras el asesinato del archiduque Francisco Fernando de Austria.",
        "¿Cuál es el metal más abundante en la corteza terrestre?": "El Aluminio (Al) es el metal más común en la corteza terrestre, aunque a menudo se encuentra en forma de compuestos.",
        "¿Quién escribió la obra 'Don Quijote de la Mancha'?": "La obra cumbre de la literatura española, 'El ingenioso hidalgo Don Quijote de la Mancha', fue escrita por Miguel de Cervantes Saavedra.",
        "¿Qué gas es el más abundante en la atmósfera terrestre?": "El Nitrógeno (N₂) constituye aproximadamente el 78% de la atmósfera terrestre.",
        "¿Cuántos huesos tiene el cuerpo humano adulto?": "El cuerpo humano adulto estándar tiene 206 huesos. Los bebés nacen con más, que se fusionan con el tiempo.",
        "¿Cuál es el país más poblado del mundo?": "Desde 2023, la India superó a China como el país con mayor población a nivel global.",
        "¿Cuál es la capital de Australia?": "Aunque Sídney y Melbourne son más grandes, la capital federal de Australia es Canberra.",
        "¿Quién es conocido por la teoría de la relatividad?": "Albert Einstein es el físico que desarrolló las teorías de la relatividad especial y general, revolucionando la física moderna.",
        "¿Cuál es el océano más grande del mundo?": "El Océano Pacífico es el más grande y profundo, cubriendo aproximadamente un tercio de la superficie de la Tierra.",
        "¿Qué animal es el mamífero terrestre más rápido?": "El Guepardo (Acinonyx jubatus) puede alcanzar velocidades de hasta 112 km/h en distancias cortas.",
        "¿En qué deporte se utiliza la palabra 'birdie'?": "Un 'birdie' es un término de Golf que indica que un jugador ha completado un hoyo en un golpe por debajo del par.",
        "¿Cuál es el color primario que se mezcla con el azul para hacer verde?": "Según el modelo de color sustractivo (CMY), el Amarillo y el Azul se mezclan para formar el Verde.",
        "¿Cuál es la montaña más alta del mundo?": "El Monte Everest, con una altura de 8,848.86 metros sobre el nivel del mar, es el pico más alto del planeta.",
        "¿Quién fue el primer hombre en caminar sobre la Luna?": "Neil Armstrong, comandante de la misión Apolo 11, se convirtió en el primer humano en pisar la Luna en julio de 1969.",
        "¿Cuál es el idioma más hablado del mundo (por número de hablantes nativos)?": "El Mandarín (un dialecto del chino) es el idioma con el mayor número de hablantes nativos en el mundo.",
        "¿Qué significa 'WWW' en una dirección web?": "Son las siglas de World Wide Web, un sistema de documentos de hipertexto interconectados accesibles a través de Internet.",
        "¿Cuál es la capital de Canadá?": "La capital de Canadá es Ottawa, ubicada en la provincia de Ontario, no la más poblada Toronto.",
        "¿Qué civilización construyó las pirámides de Giza?": "Las Grandes Pirámides de Giza fueron construidas por la antigua civilización Egipcia como tumbas para sus faraones.",
        "¿Cuántos minutos hay en una hora?": "Una hora se define como un periodo de 60 minutos.",
        "¿Qué instrumento toca Yo-Yo Ma?": "Yo-Yo Ma es uno de los violonchelistas más famosos y aclamados de la historia moderna.",
        "¿Cuál es el símbolo químico del oro?": "El símbolo Au proviene del término latino 'aurum'.",
        "¿Cuántas cuerdas tiene un ukelele estándar?": "La mayoría de los ukeleles (soprano, concierto y tenor) tienen cuatro cuerdas.",
        "¿Qué país es conocido como la 'Tierra del Sol Naciente'?": "Japón, o 'Nihon', significa 'origen del sol' o 'país del sol naciente'.",
        "¿Quién formuló las tres leyes del movimiento?": "Isaac Newton, en su obra *Philosophiæ Naturalis Principia Mathematica* (1687), formuló las bases de la mecánica clásica.",
        "¿Cuál es el río más largo del mundo?": "Tras investigaciones recientes, el consenso científico actual considera al río Amazonas como el más largo, superando al Nilo.",
        "¿Qué novela comienza con la línea 'Llamadme Ismael'?": "La icónica frase de apertura pertenece a *Moby Dick*, la novela épica de Herman Melville.",
        "¿En qué continente se encuentra el desierto del Sahara?": "El Sahara, el desierto cálido más grande del mundo, se extiende por gran parte del norte de África.",
        "¿Cuál es la velocidad de la luz en el vacío (aproximadamente, en km/s)?": "La velocidad de la luz es de aproximadamente 299,792 kilómetros por segundo, comúnmente redondeada a 300,000 km/s.",
        "¿Qué ciudad es conocida como 'La Gran Manzana'?": "Nueva York, o 'The Big Apple', es uno de sus apodos más famosos, popularizado en la década de 1920.",
        "¿Qué significa 'PC' en el contexto de informática personal?": "PC es la abreviatura de Personal Computer (Computadora Personal).",
        "¿Cuál es el plural de 'cactus'?": "La RAE acepta tanto 'cactos' (plural regular en español) como 'cactus' (plural invariable, por su origen latino).",
        "¿Qué artista cortó su propia oreja?": "Vincent van Gogh se cortó parte de la oreja izquierda en un episodio de crisis emocional en 1888.",
        "¿En qué año se disolvió la Unión Soviética (URSS)?": "La URSS se disolvió oficialmente el 26 de diciembre de 1991, tras la renuncia de Mijaíl Gorbachov.",
        "¿Qué bebida se obtiene de la fermentación de la uva?": "El Vino se obtiene de la fermentación del mosto de uva, principalmente mediante la acción de levaduras.",
        "¿Cuál es el nombre del primer satélite artificial en órbita?": "El Sputnik 1 fue lanzado por la Unión Soviética el 4 de octubre de 1957, marcando el inicio de la era espacial.",
        "¿Cuál es el único mamífero que puede volar?": "Los Murciélagos son los únicos mamíferos capaces de realizar un vuelo sostenido y activo.",
        "¿De qué país es originario el tango?": "El tango es un género musical y una danza que se originó en la región del Río de la Plata, principalmente en Buenos Aires (Argentina) y Montevideo (Uruguay).",
        "¿Qué tipo de energía se almacena en una batería?": "Una batería almacena Energía Química, la cual se convierte en energía eléctrica al activarse mediante reacciones químicas.",
        "¿Quién compuso la 'Novena Sinfonía'?": "Ludwig van Beethoven terminó su 'Novena Sinfonía' en 1824; es famosa por su coral 'Oda a la Alegría'.",
        "¿Qué día se celebra el Día de la Independencia de Estados Unidos?": "Se celebra el 4 de julio en conmemoración de la Declaración de Independencia de 1776.",
        "¿Qué cuerpo celeste orbita la Tierra?": "La Luna es el único satélite natural de la Tierra y orbita nuestro planeta a una distancia promedio de unos 384,400 km.",
        "¿Qué filósofo es famoso por la frase 'Pienso, luego existo'?": "René Descartes, filósofo francés, es el autor del famoso 'Cogito ergo sum' (Pienso, luego existo), pilar del racionalismo occidental.",
        "¿Cuál es la moneda oficial de Japón?": "La moneda oficial de Japón es el Yen (JPY).",
        "¿Qué gas es necesario para la combustión?": "La combustión es una reacción química que requiere la presencia de Oxígeno para que se produzca.",
        "¿Qué famoso monumento es conocido como el 'Coliseo'?": "El Coliseo de Roma es el Anfiteatro Flavio, el anfiteatro más grande jamás construido.",
        "¿De qué país es el Everest (la cima)?": "El Monte Everest está situado en la cordillera del Himalaya, en la frontera entre Nepal y China (Tíbet).",
        "¿Qué partícula subatómica tiene carga negativa?": "El Electrón es una partícula elemental que posee una carga eléctrica elemental negativa."
    };
    return explicaciones[pregunta] || "No hay explicación disponible para esta pregunta.";
}  


function finalizarTrivia() {
  triviaEnCurso = false;

  let mensaje = "🏆 FIN DE LA TRIVIA - RESULTADOS:\n";
  jugadoresTrivia.forEach(id => {
      const player = room.getPlayer(id);
      if (player) {
          mensaje += `${player.name}: ${puntos[id] || 0} puntos\n`;
      }
  });

  enviarMensajeGlobal(mensaje, 0x9B59B6);
  jugadoresTrivia = [];
  puntos = {};
}

function handleTriviaAnswer(player, opcion) {
  if (!triviaEnCurso || !preguntaActual) return false;

  const opcionIndex = opcion.toLowerCase().charCodeAt(0) - 97;
  const esCorrecta = preguntaActual.opciones[opcionIndex]?.correcta;

  if (esCorrecta) {
      puntos[player.id] = (puntos[player.id] || 0) + 5;
      enviarMensajeGlobal(`✅ ${player.name} respondió correctamente! (+5 puntos)`, 0x4CAF50);
      siguientePregunta();
  } else {
      puntos[player.id] = (puntos[player.id] || 0) - 3;
      enviarMensajeGlobal(`❌ ${player.name} respondió mal! (-3 puntos)`, 0xFF5555);
  }

  return false;
}


function balancearEquipos() {
  const players = room.getPlayerList();
  const redCount = players.filter(p => p.team === 1).length;
  const blueCount = players.filter(p => p.team === 2).length;
  const specs = players.filter(p => p.team === 0 && !jugadoresAFK.has(p.id));

  // Equilibrar si hay diferencia
  if (Math.abs(redCount - blueCount) > 1) {
      room.pauseGame(true);
      enviarMensajeGlobal("⏸️ Partido pausado por desbalance de equipos", 0xFFA500);

      // Mover espectadores para equilibrar
      if (redCount > blueCount && specs.length > 0) {
          room.setPlayerTeam(specs[0].id, 2);
      } else if (blueCount > redCount && specs.length > 0) {
          room.setPlayerTeam(specs[0].id, 1);
      }

      // Si no hay espectadores, mover de equipo mayoritario
      if (specs.length === 0) {
          if (redCount > blueCount) {
              const lastRed = players.find(p => p.team === 1);
              if (lastRed) room.setPlayerTeam(lastRed.id, 2);
          } else {
              const lastBlue = players.find(p => p.team === 2);
              if (lastBlue) room.setPlayerTeam(lastBlue.id, 1);
          }
      }
  }

  // Reanudar si está equilibrado
  if (Math.abs(redCount - blueCount) <= 1) {
      room.pauseGame(false);
  }
}

// Función mejorada para obtener jugadores activos
function getActivePlayers() {
  return room.getPlayerList().filter(p => !jugadoresAFK.has(p.id));
};

function optimizedGlobalMessage(text, color) {
  const now = Date.now();
  if (now - lastGlobalMessage < 2000) { // 2 segundos entre mensajes
      setTimeout(() => {
          room.sendAnnouncement(text, null, color, "bold");
      }, 2000 - (now - lastGlobalMessage));
  } else {
      room.sendAnnouncement(text, null, color, "bold");
  }
  lastGlobalMessage = now;
};


room.onPlayerBallKick = function(player) {
  const now = Date.now();
  if (now - lastUpdate < 100) return; // Limitar a 10 actualizaciones/segundo
  lastUpdate = now;

  // Tu lógica aquí...
};

function enviarMensajeGlobal(texto, color = 0xEEEEEE, estilo = "bold") {
  room.sendAnnouncement(texto, null, color, estilo);
};

function enviarMensajePrivado(playerId, texto, color = 0xEEEEEE, estilo = "bold") {
  room.sendAnnouncement(texto, playerId, color, estilo);
};


function validarJugador(player, targetName) {
  if (!targetName) {
      enviarMensajePrivado(player.id, "❌ Debes mencionar un jugador", 0xFF5252);
      return null;
  }
  const target = encontrarJugadorPorNombre(targetName);
  if (!target) {
      enviarMensajePrivado(player.id, "❌ Jugador no encontrado", 0xFF5252);
      return null;
  }
  return target;
}

function encontrarJugadorPorNombre(nombre) {
  const players = room.getPlayerList();
  return players.find(p => p.name.toLowerCase().includes(nombre.toLowerCase()));
};

// Función mejorada para guardar el contador en Firebase
async function guardarContador() {
  if (!firebaseInitialized) {
      console.log("Firebase no inicializado, no se guardó el contador");
      return;
  }

  try {
      await firebase.database().ref('contador').set({
          valor: contador,
          siguiente: siguienteNumero,
          ultimaActualizacion: Date.now()
      });
      console.log(`✅ Contador guardado: ${contador}, Siguiente: ${siguienteNumero}`);
  } catch (error) {
      console.error("❌ Error guardando contador:", error);
  }
}

// Función mejorada para cargar el contador desde Firebase
async function cargarContador() {
  if (!firebaseInitialized || cargandoContador) return;

  cargandoContador = true;
  console.log("🔃 Cargando contador desde Firebase...");

  try {
      const snapshot = await firebase.database().ref('contador').once('value');
      const datos = snapshot.val();

      if (datos) {
          contador = datos.valor || 0;
          siguienteNumero = datos.siguiente || 1;
          console.log(`🔢 Contador cargado: ${contador}, Siguiente: ${siguienteNumero}`);

          // Verificar si los datos están desactualizados (más de 1 día)
          const ahora = Date.now();
          const ultimaActualizacion = datos.ultimaActualizacion || 0;
          const diasDesactualizado = (ahora - ultimaActualizacion) / (1000 * 60 * 60 * 24);

          if (diasDesactualizado > 1) {
              console.log(`⚠️ Contador desactualizado (${diasDesactualizado.toFixed(1)} días)`);
          }
      } else {
          console.log("ℹ️ No se encontraron datos del contador en Firebase");
      }
  } catch (error) {
      console.error("❌ Error cargando contador:", error);
  } finally {
      cargandoContador = false;
  }
}

// Al iniciar la sala (fuera de cualquier función)
room.onRoomLink = function() {
  console.log("🔗 Sala cargada, inicializando contador...");
  cargarContador().then(() => {
      console.log("✅ Contador inicializado correctamente");
      enviarMensajeGlobal(
          `🔢 Contador global inicializado\n` +
          `📌 Número actual: ${contador}\n` +
          `👉 Siguiente número: ${siguienteNumero}`,
          0x2196F3
      );
  }).catch(error => {
      console.error("Error al inicializar contador:", error);
  });
};

// Verificar estado del contador cada 5 minutos
setInterval(() => {
  if (firebaseInitialized && !cargandoContador) {
      console.log("🔄 Verificando estado del contador...");
      guardarContador();
  }
}, 5 * 60 * 1000); // 5 minutos






// ======================
// CONSTANTES
// ======================
const CONTRASEÑA_ADMIN = "jeje";
const TIEMPO_ESPERA = 5000;
const COOLDOWN_GENERAL = 30000;
const TIEMPO_VOTACION = 30;
const MAX_JUGADORES_POR_EQUIPO = 4;
const COOLDOWN_SORTEO = 30000;
let jugadoresAFK = new Set();
let apuestas = {  // Para el sistema de apuestas
  red: new Set(),
  blue: new Set(),
  votacionAbierta: false,
  tiempoInicio: null
};

let playersInGame = new Set(); // Jugadores en partida

// ======================
// MENSAJES CON COLORES
// ======================

const TODAS_LAS_PREGUNTAS = [
    {
        pregunta: "¿Cuál es el planeta más grande del sistema solar?",
        opciones: [
            { texto: "Júpiter", correcta: true },
            { texto: "Marte", correcta: false },
            { texto: "Saturno", correcta: false }
        ]
    },
    {
        pregunta: "¿Quién pintó la 'Mona Lisa'?",
        opciones: [
            { texto: "Leonardo da Vinci", correcta: true },
            { texto: "Pablo Picasso", correcta: false },
            { texto: "Vincent van Gogh", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuántos lados tiene un hexágono?",
        opciones: [
            { texto: "Seis", correcta: true },
            { texto: "Siete", correcta: false },
            { texto: "Cinco", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuál es el elemento químico con el símbolo 'O'?",
        opciones: [
            { texto: "Oxígeno", correcta: true },
            { texto: "Oro", correcta: false },
            { texto: "Osmio", correcta: false }
        ]
    },
    {
        pregunta: "¿En qué año comenzó la Primera Guerra Mundial?",
        opciones: [
            { texto: "1914", correcta: true },
            { texto: "1939", correcta: false },
            { texto: "1918", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuál es el metal más abundante en la corteza terrestre?",
        opciones: [
            { texto: "Aluminio", correcta: true },
            { texto: "Hierro", correcta: false },
            { texto: "Oro", correcta: false }
        ]
    },
    {
        pregunta: "¿Quién escribió la obra 'Don Quijote de la Mancha'?",
        opciones: [
            { texto: "Miguel de Cervantes", correcta: true },
            { texto: "Gabriel García Márquez", correcta: false },
            { texto: "Federico García Lorca", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué gas es el más abundante en la atmósfera terrestre?",
        opciones: [
            { texto: "Nitrógeno", correcta: true },
            { texto: "Oxígeno", correcta: false },
            { texto: "Dióxido de carbono", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuántos huesos tiene el cuerpo humano adulto?",
        opciones: [
            { texto: "206", correcta: true },
            { texto: "300", correcta: false },
            { texto: "180", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuál es el país más poblado del mundo?",
        opciones: [
            { texto: "India", correcta: true },
            { texto: "China", correcta: false },
            { texto: "Estados Unidos", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuál es la capital de Australia?",
        opciones: [
            { texto: "Canberra", correcta: true },
            { texto: "Sídney", correcta: false },
            { texto: "Melbourne", correcta: false }
        ]
    },
    {
        pregunta: "¿Quién es conocido por la teoría de la relatividad?",
        opciones: [
            { texto: "Albert Einstein", correcta: true },
            { texto: "Isaac Newton", correcta: false },
            { texto: "Galileo Galilei", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuál es el océano más grande del mundo?",
        opciones: [
            { texto: "Pacífico", correcta: true },
            { texto: "Atlántico", correcta: false },
            { texto: "Índico", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué animal es el mamífero terrestre más rápido?",
        opciones: [
            { texto: "Guepardo", correcta: true },
            { texto: "León", correcta: false },
            { texto: "Tigre", correcta: false }
        ]
    },
    {
        pregunta: "¿En qué deporte se utiliza la palabra 'birdie'?",
        opciones: [
            { texto: "Golf", correcta: true },
            { texto: "Tenis", correcta: false },
            { texto: "Fútbol", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuál es el color primario que se mezcla con el azul para hacer verde?",
        opciones: [
            { texto: "Amarillo", correcta: true },
            { texto: "Rojo", correcta: false },
            { texto: "Blanco", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuál es la montaña más alta del mundo?",
        opciones: [
            { texto: "Monte Everest", correcta: true },
            { texto: "K2", correcta: false },
            { texto: "Monte Kilimanjaro", correcta: false }
        ]
    },
    {
        pregunta: "¿Quién fue el primer hombre en caminar sobre la Luna?",
        opciones: [
            { texto: "Neil Armstrong", correcta: true },
            { texto: "Buzz Aldrin", correcta: false },
            { texto: "Yuri Gagarin", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuál es el idioma más hablado del mundo (por número de hablantes nativos)?",
        opciones: [
            { texto: "Mandarín", correcta: true },
            { texto: "Español", correcta: false },
            { texto: "Inglés", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué significa 'WWW' en una dirección web?",
        opciones: [
            { texto: "World Wide Web", correcta: true },
            { texto: "Web World Wide", correcta: false },
            { texto: "Wide Web World", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuál es la capital de Canadá?",
        opciones: [
            { texto: "Ottawa", correcta: true },
            { texto: "Toronto", correcta: false },
            { texto: "Vancouver", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué civilización construyó las pirámides de Giza?",
        opciones: [
            { texto: "Egipcia", correcta: true },
            { texto: "Romana", correcta: false },
            { texto: "Maya", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuántos minutos hay en una hora?",
        opciones: [
            { texto: "60", correcta: true },
            { texto: "30", correcta: false },
            { texto: "100", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué instrumento toca Yo-Yo Ma?",
        opciones: [
            { texto: "Violonchelo", correcta: true },
            { texto: "Violín", correcta: false },
            { texto: "Piano", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuál es el símbolo químico del oro?",
        opciones: [
            { texto: "Au", correcta: true },
            { texto: "Ag", correcta: false },
            { texto: "Fe", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuántas cuerdas tiene un ukelele estándar?",
        opciones: [
            { texto: "Cuatro", correcta: true },
            { texto: "Seis", correcta: false },
            { texto: "Tres", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué país es conocido como la 'Tierra del Sol Naciente'?",
        opciones: [
            { texto: "Japón", correcta: true },
            { texto: "China", correcta: false },
            { texto: "Corea del Sur", correcta: false }
        ]
    },
    {
        pregunta: "¿Quién formuló las tres leyes del movimiento?",
        opciones: [
            { texto: "Isaac Newton", correcta: true },
            { texto: "Albert Einstein", correcta: false },
            { texto: "Stephen Hawking", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuál es el río más largo del mundo?",
        opciones: [
            { texto: "Amazonas", correcta: true },
            { texto: "Nilo", correcta: false },
            { texto: "Misisipi", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué novela comienza con la línea 'Llamadme Ismael'?",
        opciones: [
            { texto: "Moby Dick", correcta: true },
            { texto: "Guerra y Paz", correcta: false },
            { texto: "Orgullo y Prejuicio", correcta: false }
        ]
    },
    {
        pregunta: "¿En qué continente se encuentra el desierto del Sahara?",
        opciones: [
            { texto: "África", correcta: true },
            { texto: "Asia", correcta: false },
            { texto: "América del Sur", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuál es la velocidad de la luz en el vacío (aproximadamente, en km/s)?",
        opciones: [
            { texto: "300,000 km/s", correcta: true },
            { texto: "150,000 km/s", correcta: false },
            { texto: "600,000 km/s", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué ciudad es conocida como 'La Gran Manzana'?",
        opciones: [
            { texto: "Nueva York", correcta: true },
            { texto: "Los Ángeles", correcta: false },
            { texto: "Chicago", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué significa 'PC' en el contexto de informática personal?",
        opciones: [
            { texto: "Personal Computer", correcta: true },
            { texto: "Private Communication", correcta: false },
            { texto: "Public Central", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuál es el plural de 'cactus'?",
        opciones: [
            { texto: "Cactos o Cactus", correcta: true },
            { texto: "Cactuses", correcta: false },
            { texto: "Cactí", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué artista cortó su propia oreja?",
        opciones: [
            { texto: "Vincent van Gogh", correcta: true },
            { texto: "Salvador Dalí", correcta: false },
            { texto: "Claude Monet", correcta: false }
        ]
    },
    {
        pregunta: "¿En qué año se disolvió la Unión Soviética (URSS)?",
        opciones: [
            { texto: "1991", correcta: true },
            { texto: "1989", correcta: false },
            { texto: "2001", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué bebida se obtiene de la fermentación de la uva?",
        opciones: [
            { texto: "Vino", correcta: true },
            { texto: "Cerveza", correcta: false },
            { texto: "Sidra", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuál es el nombre del primer satélite artificial en órbita?",
        opciones: [
            { texto: "Sputnik 1", correcta: true },
            { texto: "Explorer 1", correcta: false },
            { texto: "Apollo 1", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuál es el único mamífero que puede volar?",
        opciones: [
            { texto: "Murciélago", correcta: true },
            { texto: "Pterodáctilo", correcta: false },
            { texto: "Ardilla voladora", correcta: false }
        ]
    },
    {
        pregunta: "¿De qué país es originario el tango?",
        opciones: [
            { texto: "Argentina y Uruguay", correcta: true },
            { texto: "España", correcta: false },
            { texto: "Brasil", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué tipo de energía se almacena en una batería?",
        opciones: [
            { texto: "Química", correcta: true },
            { texto: "Eléctrica", correcta: false },
            { texto: "Térmica", correcta: false }
        ]
    },
    {
        pregunta: "¿Quién compuso la 'Novena Sinfonía'?",
        opciones: [
            { texto: "Ludwig van Beethoven", correcta: true },
            { texto: "Wolfgang Amadeus Mozart", correcta: false },
            { texto: "Johann Sebastian Bach", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué día se celebra el Día de la Independencia de Estados Unidos?",
        opciones: [
            { texto: "4 de julio", correcta: true },
            { texto: "14 de julio", correcta: false },
            { texto: "24 de diciembre", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué cuerpo celeste orbita la Tierra?",
        opciones: [
            { texto: "La Luna", correcta: true },
            { texto: "Marte", correcta: false },
            { texto: "El Sol", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué filósofo es famoso por la frase 'Pienso, luego existo'?",
        opciones: [
            { texto: "René Descartes", correcta: true },
            { texto: "Sócrates", correcta: false },
            { texto: "Platón", correcta: false }
        ]
    },
    {
        pregunta: "¿Cuál es la moneda oficial de Japón?",
        opciones: [
            { texto: "Yen", correcta: true },
            { texto: "Won", correcta: false },
            { texto: "Yuan", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué gas es necesario para la combustión?",
        opciones: [
            { texto: "Oxígeno", correcta: true },
            { texto: "Nitrógeno", correcta: false },
            { texto: "Hidrógeno", correcta: false }
        ]
    },
    {
        pregunta: "¿Qué famoso monumento es conocido como el 'Coliseo'?",
        opciones: [
            { texto: "Anfiteatro Flavio", correcta: true },
            { texto: "Partenón", correcta: false },
            { texto: "Estatua de la Libertad", correcta: false }
        ]
    }
];













const frasesAleatorias = [
  {texto: "🤪 La vida es corta, sé memín", color: 0xFFB74D},
  {texto: "🚫🧠 Aquí se viene a perder neuronas", color: 0xFF6D6D},
  {texto: "😂 El que ríe último... no entendió", color: 0x81C784},
  {texto: "💀 Moriremos todos, pero primero...", color: 0xBA68C8},
  {texto: "🍌 No es el tamaño, es el meme", color: 0xFFF176},
  {texto: "🧠❌ Cerebro? Nunca supe de él", color: 0x4FC3F7},
  {texto: "🤡 Bienvenidos al circo", color: 0xFF8A80},
  {texto: "🤪 ¿Sabías que si gritas 'GOL' fuerte, el balón se asusta y entra?", color: 0xFF80AB},
  {texto: "🚀 ¡Jugamos en modo cohete! (Porque todos vuelan... menos tú)", color: 0x80DEEA},
  {texto: "💀 La única 'estrategia' aquí es sobrevivir.", color: 0xFF8A65},
  {texto: "🍌 Cuidado con las cáscaras... oh, ya te caíste.", color: 0xFFF59D},
  {texto: "🧠 ¿Cerebro? Aquí solo aceptamos reflejos de tortuga.", color: 0xA5D6A7},
  {texto: "🔥 Este partido está más caliente que mi CPU con 50 tabs abiertos.", color: 0xFF7043},
  {texto: "🎮 Si el fútbol fuera fácil, se llamaría 'Haxball para noobs'.", color: 0xB39DDB},
  {texto: "👻 Jugador fantasma detectado: corre rápido pero no toca el balón.", color: 0xE0E0E0},
  {texto: "🦶 Tus pies parecen manos... y tus manos, pies.", color: 0xFFCC80},
  {texto: "💩 Si los errores fueran goles, serías Messi.", color: 0xA1887F},
  {texto: "🤡 Bienvenido al circo, donde el balón es el payaso.", color: 0xF48FB1},
  {texto: "📉 Tu habilidad es como Bitcoin: en picada.", color: 0x8BC34A},
  {texto: "🍕 ¿Pizza o gol? Ambos son redondos, pero uno te llena más.", color: 0xFFAB91},
  {texto: "🎲 Apostar aquí es como jugar a la ruleta rusa... con 5 balas.", color: 0x90CAF9},
  {texto: "👽 Si los aliens nos ven jugar, nos invadirán por pena.", color: 0xCE93D8},
  {texto: "🛌 El único 'dribbling' que conoces es en la cama.", color: 0xF06292},
  {texto: "📌 Regla #1: No llorar. Regla #2: Ver Regla #1.", color: 0x9FA8DA},
  {texto: "💣 Tu defensa es como mi ex: inexistente.", color: 0xFF8A65},
  {texto: "🤏 Casi casi... como siempre.", color: 0x80CBC4},
  {texto: "🏆 El premio al 'Más confundido' va para... ¡todos!", color: 0xFFD54F}
];

const chistes = [
  "¿Qué hace un perro con un talonario? ¡Guaupar cheques! 🐶💸",
  "¿Cómo se dice pañuelo en japonés? Saka-moko 🤧🇯🇵",
  "¿Qué le dijo un semáforo a otro? No me mires, me estoy cambiando 🚦😳",
  "¿Por qué el libro de matemáticas estaba triste? Porque tenía muchos problemas 📖😢",
  "¿Qué hace una abeja en el gimnasio? Zum-ba! 🐝💪"

];

const insultosDivertidos = [
  "Juegas como si tuvieras los controles en modo avión ✈️🎮",
"Si la estupidez doliera, serías una farmacia entera 💊🤕",
"Tienes más lag que mi abuela con Zoom 🧓📶",
"Eres como un GPS: siempre perdiendo la ruta 🗺️❌",
"Celebras los corners como si fueran goles... es lo más cerca que llegas ⚽😂",
"Tu táctica es como mi ex: inexistente 👻💔",
"Si los errores fueran criptomonedas, serías millonario 💰🤡",
"Eres el motivo por el que los tutoriales existen 🎓🙄",
"Juegas como si tuvieras las manos hechas de mantequilla 🧈✋",
"Tu habilidad es como Bitcoin: en picada 📉😭",
  "Juegas como si tuvieras los ojos cerrados... oh espera, ¿los tienes cerrados? 😵",
  "Si el fútbol fuera un idioma, tú serías mudo 🤐⚽",
  "Tienes más lag mental que mi abuela con el WhatsApp 🧓📱",
  "Eres como un semáforo: siempre en rojo 🚦🔴",
  "Si la mediocridad fuera un superpoder, serías un superhéroe 🦸‍♂️💩"
];

const climas = [
  "🌪️ Huracán de pases horribles con probabilidad de autogoles",
"☀️ Soleado con rachas de lag mental",
"🌧️ Lluvia de excusas baratas",
"❄️ Frío polar de habilidad (-10° de reflejos)",
"⚡ Tormenta eléctrica de insultos creativos",
"🌫️ Niebla espesa de confusión táctica",
"🔥 Ola de calor de rqs inminentes",
"🌈 Arcoíris de casi-goles fallados",
"🌀 Tornado de giros innecesarios",
"🌨️ Nevada de balones perdidos",
  "☀️ Soleado con probabilidad de autogoles",
  "⛈️ Tormenta de pases horribles",
  "🌪️ Huracán de lag mental",
  "❄️ Frío polar de habilidad",
  "🌈 Arcoíris de casi goles"
];

const historiasCringe = [
"Érase una vez {jugador1}, {jugador2} y {jugador3} en una aventura épica... {jugador1} tropezó con el balón, {jugador2} se cayó de bruces y {jugador3} celebró un gol que no existía. Fin. 📖",
"En un mundo postapocalíptico... {jugador1} intentaba hacer un pase, {jugador2} lo malinterpretó como declaración de guerra, y {jugador3} se declaró emperador del servidor. 🏰",
"{jugador1} y {jugador2} se enamoraron perdidamente, pero {jugador3} los separó al demostrar que ninguno sabía patear un balón. Una tragedia griega. 💔",
"{jugador1}, {jugador2} y {jugador3} entraron a un bar. {jugador1} tropezó con el aire, {jugador2} pidió agua y se ahogó, y {jugador3} celebró su cumpleaños... en junio (era enero) 🎉📅",
"Érase una vez {jugador1} que intentó hacer un pase. Fin. (Nadie lo atrapó) ✨",
"En un mundo postapocalíptico, {jugador1} declaró guerra a {jugador2} por robarle su estrategia... que nunca funcionó ☢️🎮",
"{jugador1} y {jugador2} juraron vengar a {jugador3}... hasta que recordaron que era su enemigo. Awkward 😶⚔️",
"La historia de cómo {jugador1} perdió sus neuronas: Capítulo 1 - Este partido 🧠💥",
"{jugador1} inventó el 'autogol olímpico'. {jugador2} lo patentó. {jugador3} lo celebró como si fuera suyo 🏅🤦",
"Cuando {jugador1} conoció a {jugador2}: Un romance basado en pases fallidos y miradas de odio 💘🔪",
"El día que {jugador1} desafió a {jugador3} a un duelo... perdió ambos pulgares 🤌💀",
"{jugador2} juró que era el mejor. El universo se rió 🌌😂",
"Y así, {jugador1}, {jugador2} y {jugador3} demostraron que el fútbol no es lo suyo. Fin 📖✌️",

];

const batallas = [
"{jugador1} lanzó un hadouken de pases malos, pero {jugador2} lo esquivó con estilo de bailarín de TikTok. ¡{ganador} gana con un meme épico! 🎭",
"{jugador1} intentó un tackle prohibido, {jugador2} contraatacó con un baile fortnite. ¡{ganador} gana por puntos de estilo! 💃",
"La batalla fue intensa: {jugador1} con sus insultos de abuelo, {jugador2} con sus memes de 2012. ¡{ganador} gana por ser menos cringe! 🏆",
"{jugador1} lanzó un Hadouken... pero era un estornudo. {jugador2} contraatacó con una mirada decepcionante. ¡{ganador} gana por pena ajena! 🥋👀",
"Batalla épica: {jugador1} con su dribbling imaginario vs {jugador2} con su defensa inexistente. ¡{ganador} gana por default! 🛡️💨",
"{jugador1} usó lágrimas de cocodrilo. ¡{jugador2} es inmune! ¡{ganador} gana con un meme de 2012! 🐊😂",
"¡{jugador1} invocó a su abuela! ¡{jugador2} contraataca con 'en mis tiempos...'! ¡{ganador} gana por cansancio! 👵⏳",
"Combate de baile: {jugador1} con el floss vs {jugador2} con el renegade. ¡{ganador} gana por menos cringe! 💃🕺",
"¡{jugador1} amenaza con reportar! ¡{jugador2} le muestra su historial de 0 goles! ¡{ganador} gana por shame! 📉😳",
"Duelo de insultos: {jugador1} dice 'tu madre'... {jugador2} responde 'tu perro'. ¡{ganador} gana por creatividad nula! 🐕💬",
"{jugador1} desafía a {jugador2} a Fortnite... pero estaban en Haxball. ¡{ganador} gana por sentido común! 🎮🤪",
"¡Batalla de memes! {jugador1} usa 'lo mismo digo'... {jugador2} responde con 'no u'. ¡{ganador} gana por falta de originalidad! 🔄🙃",
"¡{jugador1} y {jugador2} se retan a quién tiene peor conexión! Empate técnico... pero {ganador} gana por laggear más épicamente! 📶🐌"

];





const frasesKick = [
  "🚀 ¡Fuera de aquí!",
  "👋 Adiós, persona no deseada",
  "💥 ¡Banned por molesto!",
  "🦶 ¡Patada en el trasero!",
  "❌ No cumples los requisitos neuronales",
  "🚀 @player fue lanzado al espacio por inútil. ¡Adiós!",
  "🍌 @player resbaló con una cáscara y cayó fuera del servidor.",
  "💀 RIP @player. Murió de vergüenza tras jugar tan mal.",
  "👋 @player dijo '¡Adiós, mundo cruel!' y se autoexpulsó.",
  "🏴‍☠️ @player fue capturado por piratas. ¡Banned por piratería!",
  "🤡 @player fue arrestado por payaso. ¡Fuera de aquí!",
  "📉 @player bajó tanto el nivel que el servidor lo vomitó.",
  "🔥 @player se quemó solo. ¡Hasta nunca!",
  "👻 @player es ahora un fantasma. Booooo... fuera.",
  "🦶 @player recibió una patada voladora. ¡Hasta luego!",
  "💩 @player fue flushado por tóxico. ¡Adiós!",
  "🎤 @player cantó tan mal que lo expulsamos por spam.",
  "🛌 @player se durmió en el teclado. ¡Despierta en otro lado!",
  "🍕 @player se convirtió en pizza. ¡Servido!",
  "🧹 El servidor te barrio por ser basura."
];

const frasesRuletaGanar = [
  "🎉 ¡Felicidades! Ganaste la ruleta con el número {numero}",
  "💰 ¡Bien hecho! Acertaste el {numero}",
  "👑 ¡Eres el rey de la ruleta! Número {numero}",
  "🎉 ¡Ganaste! El número {numero} era el correcto. ¿Eres brujo?", 
  "💰 ¡Boom! {numero} era la respuesta. ¿Robaste el algoritmo?", 
  "👑 Rey de la ruleta: acertaste el {numero}. ¡Injusto!",
  "🍀 ¡Suerte de principiante! El {numero} te salvó."
];

const frasesRuletaPerder = [
  "😭 ¡Mala suerte! Perdiste con el número {numero}",
  "❌ ¡Casi! El número ganador no era el {numero}",
  "💸 ¡Mejor suerte para la próxima! No era el {numero}",
  "⚡ ¡Increíble! Hasta un reloj roto acierta 2 veces al día.",
  "😭 ¡Perdiste! El {numero} no era. ¿Quieres un pañuelo?",
  "💀 Nada como elegir el {numero} para perder rápido.",
  "🤡 ¿En serio pensaste que el {numero} ganaría? JAJA.",
  "🍌 Igual que tu último pase: el {numero} fue al vacío.",
  "📉 Tu suerte es como el {numero}: bajó y nunca subió."
];

const frasesMusi = [
  "Tiro, velocidad, regate y talento... vamos, lo básico para jugar bien. Musi: 0/4",
  "Musi juega como si tuviera los controles al revés",
  "Si el fútbol fuera un examen, Musi sería el que pide ayuda al profesor en la primera pregunta",
  "Musi tiene más lag mental que mi conexión a internet",
  "El único dribbling que conoce Musi es cuando se le cae el balón",
  "Musi celebra los corners como si fueran goles (es lo más cerca que llega)",
  "Si existiera un ranking de 'casi lo logro', Musi sería top 1",
  "Musi tiene más excusas que goles en su historial",
  "Cuando Musi dice 'pasámela', en realidad significa 'haz todo el trabajo por mí'",
  "Musi es el único jugador que puede fallar un pase estando solo",
  "La táctica de Musi: correr en círculos hasta marearse",
  "Musi tiene más cambios de dirección que un político en campaña",
  "Si el balón hablara, le pediría a Musi que lo deje en paz",
  "Musi juega como si tuviera los pies hechos de mantequilla",
  "El único 'gol olímpico' de Musi sería meterla desde el saque de banda (por error)",
  "Musi es proof de que cualquiera puede jugar a este juego",
  "Si la mediocridad fuera un superpoder, Musi sería un héroe",
  "Musi tiene más problemas controlando el balón que yo controlando mi vida",
  "El mejor movimiento de Musi: el 'autopase' hacia la nada",
  "Musi es la razón por la que existe el botón 'Reportar jugador'"
];

const SHIP_EMOJIS = ["💖", "💘", "💝", "💕", "💞"];
const SHIP_PHRASES = [
  "son el dúo dinámico del balón",
  "su química hace hervir la cancha",
  "tienen más chispa que un derbi clásico",
  "son como pan y queso (pegajosos e inseparables)"
];

const TROLL_ACTIONS = [
"le cambió el teclado a DVORAK 👾⌨️",
"escondió el mouse bajo 3 tazas de café ☕🖱️",
"puso stickers de 'novato' en su monitor 🏷️🤓",
"activó el modo espejo en su pantalla 🔄🖥️",
"conectó su control al PC del vecino 🎮🏠",
"pintó de rosa su mouse con Photoshop 💖🐭",
"le puso autocorrector de 'gol' a 'fail' ⚽❌",
"🤡 {jugador1} cambió el idioma del teclado de {jugador2} a esperanto (¿qué jugabas?) ⌨️🌍",
"🎮 {jugador1} desconectó el mouse de {jugador2} y lo acusó de lag 🖱️⚡",
"🍌 {jugador1} puso cáscaras de banana en el teclado de {jugador2} (resbaló en el rank) 🤣",
"👻 {jugador1} convenció a {jugador2} de que su personaje era invisible (spoiler: no lo era) 🙈",
"📧 {jugador1} envió a {jugador2} un 'virus' (era un meme de gatos) 🐱💻",
"🕹️ {jugador1} configuró los controles de {jugador2} al revés (↑ = ↓, ¡caos!) 🔄",
"🎤 {jugador1} hizo karaoke en el chat de voz de {jugador2} (desafinado a propósito) 🎶😫",
"📱 *{jugador1} dijo que había un easter egg si {jugador2} apretaba Alt+F4* 💀😂",
"🖥️ {jugador1} le puso pantalla azul de mentira a {jugador2} (¡sorpresa! era un screenshot) 💙",
"🧀 {jugador1} dijo que el queso en el mapa daba poderes... {jugador2} todavía lo busca 🧀🤡",

];

// Variables globales para tracking de goles
let ultimoTocador = null;
let penultimoTocador = null;

// Función para manejar goles
function manejarGol(jugadorGol, equipo) {
    const frasesGol = [
        `⚽ **ɢᴏᴏᴏᴏʟ!!!** ᴅᴇ @${jugadorGol.name} ᴄᴏɴ ᴜɴᴀ ᴊᴜɢᴀᴅᴀ ᴍᴀɢɪsᴛʀᴀʟ ${penultimoTocador ? `ʏ ᴀsɪsᴛᴇɴᴄɪᴀ ᴅᴇ ᴏʀᴏ ᴅᴇ @${penultimoTocador.name}` : ''} 🎯`,
        `⚽ **¡ɪᴍᴘʀᴇsɪᴏɴᴀɴᴛᴇ!** @${jugadorGol.name} ʜᴀᴄᴇ ᴜɴ ɢᴏʟ ᴇ́ᴘɪᴄᴏ ${penultimoTocador ? `ɢʀᴀᴄɪᴀs ᴀʟ ᴘᴀsᴇ ᴅᴇ ʟᴇʏᴇɴᴅᴀ ᴅᴇ @${penultimoTocador.name}` : ''} 🌟`,
        `⚽ **ʜᴀᴢᴀɴ̃ᴀ ᴅᴇʟ ꜰᴜ́ᴛʙᴏʟ** ᴘᴏʀ @${jugadorGol.name} ${penultimoTocador ? `ǫᴜɪᴇɴ ʀᴇᴄɪʙɪᴏ́ ᴜɴ ᴘᴀsᴇ ᴅᴇ ᴀʟɪᴇɴɪɢᴇɴᴀ ᴅᴇ @${penultimoTocador.name}` : ''} 👽`,
        `⚽ **ɢᴏʟᴀᴢᴏ ᴅᴇ ᴘᴇʟɪ́ᴄᴜʟᴀ** ᴅᴇ @${jugadorGol.name} ${penultimoTocador ? `ᴄᴏɴ ᴜɴᴀ ᴀsɪsᴛᴇɴᴄɪᴀ ᴅᴇ ᴏᴛʀᴏ ᴍᴜɴᴅᴏ ᴅᴇ @${penultimoTocador.name}` : ''} 🎬`,
        `⚽ **¡ʟᴏ ʜᴀ ʜᴇᴄʜᴏ ᴅᴇ ɴᴜᴇᴠᴏ!** @${jugadorGol.name} ᴀɴᴏᴛᴀ ${penultimoTocador ? `ᴛʀᴀs ᴜɴ ᴘᴀsᴇ ᴘᴇʀꜰᴇᴄᴛᴏ ᴅᴇ @${penultimoTocador.name}` : ''} ⚡`
    ];

    const mensajeGol = frasesGol[Math.floor(Math.random() * frasesGol.length)];
    enviarMensajeGlobal(mensajeGol, equipo === 1 ? 0xFF6B6B : 0x4FC3F7);

    // Actualizar estadísticas
    if (playerStats[jugadorGol.id]) {
        playerStats[jugadorGol.id].goals = (playerStats[jugadorGol.id].goals || 0) + 1;
    }

    // Asistencia
    if (penultimoTocador && playerStats[penultimoTocador.id] && penultimoTocador.id !== jugadorGol.id) {
        playerStats[penultimoTocador.id].assists = (playerStats[penultimoTocador.id].assists || 0) + 1;
    }

    // Resetear trackers
    ultimoTocador = null;
    penultimoTocador = null;
}

// SISTEMA DE MAPAS

// =========== CONFIGURACIÓN INICIAL ===========
const MAPAS = {
  'practica': '{"name":"AF Official 1v1 by Vitão ®","width":510,"height":230,"bg":{"kickOffRadius":80,"color":"1D2431"},"vertexes":[{"x":-400,"y":-70,"bCoef":0.1,"cMask":["ball"]},{"x":-435,"y":-70,"bCoef":0.1,"cMask":["ball"]},{"x":-434,"y":-71,"bCoef":0.1,"cMask":["ball"]},{"x":-434,"y":71,"bCoef":0.1,"cMask":["ball"]},{"x":-435,"y":70,"bCoef":0.1,"cMask":["ball"]},{"x":-400,"y":70,"bCoef":0.1,"cMask":["ball"]},{"x":400,"y":70,"bCoef":0.1,"cMask":["ball"]},{"x":435,"y":70,"bCoef":0.1,"cMask":["ball"]},{"x":434,"y":71,"bCoef":0.1,"cMask":["ball"]},{"x":434,"y":-71,"bCoef":0.1,"cMask":["ball"]},{"x":435,"y":-70,"bCoef":0.1,"cMask":["ball"]},{"x":400,"y":-70,"bCoef":0.1,"cMask":["ball"]},{"x":-400,"y":-201.5,"cMask":["ball"]},{"x":-400,"y":-70,"cMask":["ball"]},{"x":-400,"y":70,"cMask":["ball"]},{"x":-400,"y":201.5,"cMask":["ball"]},{"x":-400,"y":200,"cMask":["ball"]},{"x":400,"y":200,"cMask":["ball"]},{"x":400,"y":201.5,"cMask":["ball"]},{"x":400,"y":70,"cMask":["ball"]},{"x":400,"y":-70,"cMask":["ball"]},{"x":400,"y":-201.5,"cMask":["ball"]},{"x":400,"y":-200,"cMask":["ball"]},{"x":-400,"y":-200,"cMask":["ball"]},{"x":-400,"y":-70,"cMask":[]},{"x":-400,"y":70,"cMask":[]},{"x":400,"y":70,"cMask":[]},{"x":400,"y":-70,"cMask":[]},{"x":0,"y":-80,"cMask":["red","blue"],"cGroup":["redKO"]},{"x":0,"y":80,"cMask":["red","blue"],"cGroup":["redKO"]},{"x":0,"y":-230,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":230,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-198,"cMask":[]},{"x":0,"y":-80,"cMask":[]},{"x":0,"y":198,"cMask":[]},{"x":0,"y":80,"cMask":[]},{"x":-50,"y":30,"cMask":[]},{"x":-25,"y":-30,"cMask":[]},{"x":11,"y":30,"cMask":[]},{"x":20,"y":-30,"cMask":[]},{"x":-42.5,"y":30,"cMask":[]},{"x":-17.5,"y":-30,"cMask":[]},{"x":-52,"y":30,"cMask":[]},{"x":-27,"y":-30,"cMask":[]},{"x":-40.5,"y":30,"cMask":[]},{"x":-15.5,"y":-30,"cMask":[]},{"x":-33,"y":30,"cMask":[]},{"x":-8,"y":-30,"cMask":[]},{"x":-31,"y":30,"cMask":[]},{"x":-6,"y":-30,"cMask":[]},{"x":-29,"y":30,"cMask":[]},{"x":-4,"y":-30,"cMask":[]},{"x":-27,"y":30,"cMask":[]},{"x":-2,"y":-30,"cMask":[]},{"x":-25,"y":30,"cMask":[]},{"x":0,"y":-30,"cMask":[]},{"x":5,"y":30,"cMask":[]},{"x":0,"y":-30,"cMask":[]},{"x":3,"y":30,"cMask":[]},{"x":-2,"y":-30,"cMask":[]},{"x":1,"y":30,"cMask":[]},{"x":-4,"y":-30,"cMask":[]},{"x":-1,"y":30,"cMask":[]},{"x":-6,"y":-30,"cMask":[]},{"x":-3,"y":30,"cMask":[]},{"x":-8,"y":-30,"cMask":[]},{"x":-21,"y":19,"cMask":[]},{"x":-5,"y":19,"cMask":[]},{"x":-21,"y":17,"cMask":[]},{"x":-5,"y":17,"cMask":[]},{"x":-21,"y":15,"cMask":[]},{"x":-5,"y":15,"cMask":[]},{"x":-21,"y":13,"cMask":[]},{"x":-5,"y":13,"cMask":[]},{"x":-21,"y":11,"cMask":[]},{"x":-5,"y":11,"cMask":[]},{"x":13,"y":30,"cMask":[]},{"x":22,"y":-30,"cMask":[]},{"x":15,"y":30,"cMask":[]},{"x":24,"y":-30,"cMask":[]},{"x":17,"y":30,"cMask":[]},{"x":26,"y":-30,"cMask":[]},{"x":19,"y":30,"cMask":[]},{"x":28,"y":-30,"cMask":[]},{"x":19,"y":-29,"cMask":[]},{"x":49,"y":-29,"cMask":[]},{"x":19,"y":-27,"cMask":[]},{"x":49,"y":-27,"cMask":[]},{"x":19,"y":-25,"cMask":[]},{"x":49,"y":-25,"cMask":[]},{"x":19,"y":-23,"cMask":[]},{"x":49,"y":-23,"cMask":[]},{"x":19,"y":-21,"cMask":[]},{"x":49,"y":-21,"cMask":[]},{"x":23,"y":-6,"cMask":[]},{"x":42,"y":-6,"cMask":[]},{"x":23,"y":-4,"cMask":[]},{"x":42,"y":-4,"cMask":[]},{"x":23,"y":-2,"cMask":[]},{"x":42,"y":-2,"cMask":[]},{"x":23,"y":0,"cMask":[]},{"x":42,"y":0,"cMask":[]},{"x":23,"y":2,"cMask":[]},{"x":42,"y":2,"cMask":[]},{"x":-52,"y":27,"cMask":[]},{"x":-27,"y":-33,"cMask":[]},{"x":9,"y":27,"cMask":[]},{"x":18,"y":-33,"cMask":[]},{"x":-44.5,"y":27,"cMask":[]},{"x":-19.5,"y":-33,"cMask":[]},{"x":-54,"y":27,"cMask":[]},{"x":-29,"y":-33,"cMask":[]},{"x":-42.5,"y":27,"cMask":[]},{"x":-17.5,"y":-33,"cMask":[]},{"x":-35,"y":27,"cMask":[]},{"x":-10,"y":-33,"cMask":[]},{"x":-33,"y":27,"cMask":[]},{"x":-8,"y":-33,"cMask":[]},{"x":-31,"y":27,"cMask":[]},{"x":-6,"y":-33,"cMask":[]},{"x":-29,"y":27,"cMask":[]},{"x":-4,"y":-33,"cMask":[]},{"x":-27,"y":27,"cMask":[]},{"x":-2,"y":-33,"cMask":[]},{"x":3,"y":27,"cMask":[]},{"x":-2,"y":-33,"cMask":[]},{"x":1,"y":27,"cMask":[]},{"x":-4,"y":-33,"cMask":[]},{"x":-1,"y":27,"cMask":[]},{"x":-6,"y":-33,"cMask":[]},{"x":-3,"y":27,"cMask":[]},{"x":-8,"y":-33,"cMask":[]},{"x":-5,"y":27,"cMask":[]},{"x":-10,"y":-33,"cMask":[]},{"x":-23,"y":16,"cMask":[]},{"x":-7,"y":16,"cMask":[]},{"x":-23,"y":14,"cMask":[]},{"x":-7,"y":14,"cMask":[]},{"x":-23,"y":12,"cMask":[]},{"x":-7,"y":12,"cMask":[]},{"x":-23,"y":10,"cMask":[]},{"x":-7,"y":10,"cMask":[]},{"x":-23,"y":8,"cMask":[]},{"x":-7,"y":8,"cMask":[]},{"x":11,"y":27,"cMask":[]},{"x":20,"y":-33,"cMask":[]},{"x":13,"y":27,"cMask":[]},{"x":22,"y":-33,"cMask":[]},{"x":15,"y":27,"cMask":[]},{"x":24,"y":-33,"cMask":[]},{"x":17,"y":27,"cMask":[]},{"x":26,"y":-33,"cMask":[]},{"x":17,"y":-32,"cMask":[]},{"x":47,"y":-32,"cMask":[]},{"x":17,"y":-30,"cMask":[]},{"x":47,"y":-30,"cMask":[]},{"x":17,"y":-28,"cMask":[]},{"x":47,"y":-28,"cMask":[]},{"x":17,"y":-26,"cMask":[]},{"x":47,"y":-26,"cMask":[]},{"x":17,"y":-24,"cMask":[]},{"x":47,"y":-24,"cMask":[]},{"x":21,"y":-9,"cMask":[]},{"x":40,"y":-9,"cMask":[]},{"x":21,"y":-7,"cMask":[]},{"x":40,"y":-7,"cMask":[]},{"x":21,"y":-5,"cMask":[]},{"x":40,"y":-5,"cMask":[]},{"x":21,"y":-3,"cMask":[]},{"x":40,"y":-3,"cMask":[]},{"x":21,"y":-1,"cMask":[]},{"x":40,"y":-1,"cMask":[]}],"segments":[{"v0":0,"v1":1,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":3,"v1":2,"bias":-10,"bCoef":0.1,"curve":35,"curveF":3.1715948023632126,"cMask":["ball"],"color":"717F98"},{"v0":4,"v1":5,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":6,"v1":7,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":9,"v1":8,"bias":-10,"bCoef":0.1,"curve":35,"curveF":3.1715948023632126,"cMask":["ball"],"color":"717F98"},{"v0":10,"v1":11,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":12,"v1":13,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":14,"v1":15,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":16,"v1":17,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":18,"v1":19,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":20,"v1":21,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":22,"v1":23,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":24,"v1":25,"cMask":[],"color":"3B424F"},{"v0":26,"v1":27,"cMask":[],"color":"3B424F"},{"v0":30,"v1":28,"vis":false,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":31,"v1":29,"vis":false,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":29,"v1":28,"curve":180,"curveF":6.123233995736766e-17,"vis":false,"cMask":["red","blue"],"cGroup":["blueKO"]},{"v0":28,"v1":29,"curve":180,"curveF":6.123233995736766e-17,"vis":false,"cMask":["red","blue"],"cGroup":["redKO"]},{"v0":32,"v1":33,"cMask":[],"color":"161C26"},{"v0":34,"v1":35,"cMask":[],"color":"161C26"},{"v0":35,"v1":33,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":33,"v1":35,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":36,"v1":37,"cMask":[],"color":"9101D"},{"v0":38,"v1":39,"cMask":[],"color":"9101D"},{"v0":40,"v1":41,"cMask":[],"color":"9101D"},{"v0":42,"v1":43,"cMask":[],"color":"9101D"},{"v0":44,"v1":45,"cMask":[],"color":"9101D"},{"v0":46,"v1":47,"cMask":[],"color":"9101D"},{"v0":48,"v1":49,"cMask":[],"color":"9101D"},{"v0":50,"v1":51,"cMask":[],"color":"9101D"},{"v0":52,"v1":53,"cMask":[],"color":"9101D"},{"v0":54,"v1":55,"cMask":[],"color":"9101D"},{"v0":56,"v1":57,"cMask":[],"color":"9101D"},{"v0":58,"v1":59,"cMask":[],"color":"9101D"},{"v0":60,"v1":61,"cMask":[],"color":"9101D"},{"v0":62,"v1":63,"cMask":[],"color":"9101D"},{"v0":64,"v1":65,"cMask":[],"color":"9101D"},{"v0":66,"v1":67,"cMask":[],"color":"9101D"},{"v0":68,"v1":69,"cMask":[],"color":"9101D"},{"v0":70,"v1":71,"cMask":[],"color":"9101D"},{"v0":72,"v1":73,"cMask":[],"color":"9101D"},{"v0":74,"v1":75,"cMask":[],"color":"9101D"},{"v0":76,"v1":77,"cMask":[],"color":"9101D"},{"v0":78,"v1":79,"cMask":[],"color":"9101D"},{"v0":80,"v1":81,"cMask":[],"color":"9101D"},{"v0":82,"v1":83,"cMask":[],"color":"9101D"},{"v0":84,"v1":85,"cMask":[],"color":"9101D"},{"v0":86,"v1":87,"cMask":[],"color":"9101D"},{"v0":88,"v1":89,"cMask":[],"color":"9101D"},{"v0":90,"v1":91,"cMask":[],"color":"9101D"},{"v0":92,"v1":93,"cMask":[],"color":"9101D"},{"v0":94,"v1":95,"cMask":[],"color":"9101D"},{"v0":96,"v1":97,"cMask":[],"color":"9101D"},{"v0":98,"v1":99,"cMask":[],"color":"9101D"},{"v0":100,"v1":101,"cMask":[],"color":"9101D"},{"v0":102,"v1":103,"cMask":[],"color":"9101D"},{"v0":104,"v1":105,"cMask":[],"color":"333945"},{"v0":106,"v1":107,"cMask":[],"color":"333945"},{"v0":108,"v1":109,"cMask":[],"color":"333945"},{"v0":110,"v1":111,"cMask":[],"color":"333945"},{"v0":112,"v1":113,"cMask":[],"color":"333945"},{"v0":114,"v1":115,"cMask":[],"color":"333945"},{"v0":116,"v1":117,"cMask":[],"color":"333945"},{"v0":118,"v1":119,"cMask":[],"color":"333945"},{"v0":120,"v1":121,"cMask":[],"color":"333945"},{"v0":122,"v1":123,"cMask":[],"color":"333945"},{"v0":124,"v1":125,"cMask":[],"color":"333945"},{"v0":126,"v1":127,"cMask":[],"color":"333945"},{"v0":128,"v1":129,"cMask":[],"color":"333945"},{"v0":130,"v1":131,"cMask":[],"color":"333945"},{"v0":132,"v1":133,"cMask":[],"color":"333945"},{"v0":134,"v1":135,"cMask":[],"color":"333945"},{"v0":136,"v1":137,"cMask":[],"color":"333945"},{"v0":138,"v1":139,"cMask":[],"color":"333945"},{"v0":140,"v1":141,"cMask":[],"color":"333945"},{"v0":142,"v1":143,"cMask":[],"color":"333945"},{"v0":144,"v1":145,"cMask":[],"color":"333945"},{"v0":146,"v1":147,"cMask":[],"color":"333945"},{"v0":148,"v1":149,"cMask":[],"color":"333945"},{"v0":150,"v1":151,"cMask":[],"color":"333945"},{"v0":152,"v1":153,"cMask":[],"color":"333945"},{"v0":154,"v1":155,"cMask":[],"color":"333945"},{"v0":156,"v1":157,"cMask":[],"color":"333945"},{"v0":158,"v1":159,"cMask":[],"color":"333945"},{"v0":160,"v1":161,"cMask":[],"color":"333945"},{"v0":162,"v1":163,"cMask":[],"color":"333945"},{"v0":164,"v1":165,"cMask":[],"color":"333945"},{"v0":166,"v1":167,"cMask":[],"color":"333945"},{"v0":168,"v1":169,"cMask":[],"color":"333945"},{"v0":170,"v1":171,"cMask":[],"color":"333945"}],"planes":[{"normal":[0,1],"dist":-230},{"normal":[0,-1],"dist":-230},{"normal":[1,0],"dist":-510},{"normal":[-1,0],"dist":-510}],"goals":[{"p0":[-408.3,-70],"p1":[-408.3,70],"team":"red"},{"p0":[408.3,70],"p1":[408.3,-70],"team":"blue"}],"discs":[{"radius":5.8,"bCoef":0.412,"invMass":1.55,"color":"FFA500","cGroup":["ball","kick","score"]},{"pos":[-400,70],"radius":5.4,"invMass":0,"color":"3B424F"},{"pos":[-400,-70],"radius":5.4,"invMass":0,"color":"3B424F"},{"pos":[400,70],"radius":5.4,"invMass":0,"color":"3B424F"},{"pos":[400,-70],"radius":5.4,"invMass":0,"color":"3B424F"}],"playerPhysics":{"bCoef":0,"acceleration":0.11,"kickingAcceleration":0.083,"kickStrength":4.2},"ballPhysics":"disc0","spawnDistance":366.5}',
  '1v1': '{"name":"AF Official 1v1 by Vitão ®","width":510,"height":230,"bg":{"kickOffRadius":80,"color":"1D2431"},"vertexes":[{"x":-400,"y":-70,"bCoef":0.1,"cMask":["ball"]},{"x":-435,"y":-70,"bCoef":0.1,"cMask":["ball"]},{"x":-434,"y":-71,"bCoef":0.1,"cMask":["ball"]},{"x":-434,"y":71,"bCoef":0.1,"cMask":["ball"]},{"x":-435,"y":70,"bCoef":0.1,"cMask":["ball"]},{"x":-400,"y":70,"bCoef":0.1,"cMask":["ball"]},{"x":400,"y":70,"bCoef":0.1,"cMask":["ball"]},{"x":435,"y":70,"bCoef":0.1,"cMask":["ball"]},{"x":434,"y":71,"bCoef":0.1,"cMask":["ball"]},{"x":434,"y":-71,"bCoef":0.1,"cMask":["ball"]},{"x":435,"y":-70,"bCoef":0.1,"cMask":["ball"]},{"x":400,"y":-70,"bCoef":0.1,"cMask":["ball"]},{"x":-400,"y":-201.5,"cMask":["ball"]},{"x":-400,"y":-70,"cMask":["ball"]},{"x":-400,"y":70,"cMask":["ball"]},{"x":-400,"y":201.5,"cMask":["ball"]},{"x":-400,"y":200,"cMask":["ball"]},{"x":400,"y":200,"cMask":["ball"]},{"x":400,"y":201.5,"cMask":["ball"]},{"x":400,"y":70,"cMask":["ball"]},{"x":400,"y":-70,"cMask":["ball"]},{"x":400,"y":-201.5,"cMask":["ball"]},{"x":400,"y":-200,"cMask":["ball"]},{"x":-400,"y":-200,"cMask":["ball"]},{"x":-400,"y":-70,"cMask":[]},{"x":-400,"y":70,"cMask":[]},{"x":400,"y":70,"cMask":[]},{"x":400,"y":-70,"cMask":[]},{"x":0,"y":-80,"cMask":["red","blue"],"cGroup":["redKO"]},{"x":0,"y":80,"cMask":["red","blue"],"cGroup":["redKO"]},{"x":0,"y":-230,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":230,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-198,"cMask":[]},{"x":0,"y":-80,"cMask":[]},{"x":0,"y":198,"cMask":[]},{"x":0,"y":80,"cMask":[]},{"x":-50,"y":30,"cMask":[]},{"x":-25,"y":-30,"cMask":[]},{"x":11,"y":30,"cMask":[]},{"x":20,"y":-30,"cMask":[]},{"x":-42.5,"y":30,"cMask":[]},{"x":-17.5,"y":-30,"cMask":[]},{"x":-52,"y":30,"cMask":[]},{"x":-27,"y":-30,"cMask":[]},{"x":-40.5,"y":30,"cMask":[]},{"x":-15.5,"y":-30,"cMask":[]},{"x":-33,"y":30,"cMask":[]},{"x":-8,"y":-30,"cMask":[]},{"x":-31,"y":30,"cMask":[]},{"x":-6,"y":-30,"cMask":[]},{"x":-29,"y":30,"cMask":[]},{"x":-4,"y":-30,"cMask":[]},{"x":-27,"y":30,"cMask":[]},{"x":-2,"y":-30,"cMask":[]},{"x":-25,"y":30,"cMask":[]},{"x":0,"y":-30,"cMask":[]},{"x":5,"y":30,"cMask":[]},{"x":0,"y":-30,"cMask":[]},{"x":3,"y":30,"cMask":[]},{"x":-2,"y":-30,"cMask":[]},{"x":1,"y":30,"cMask":[]},{"x":-4,"y":-30,"cMask":[]},{"x":-1,"y":30,"cMask":[]},{"x":-6,"y":-30,"cMask":[]},{"x":-3,"y":30,"cMask":[]},{"x":-8,"y":-30,"cMask":[]},{"x":-21,"y":19,"cMask":[]},{"x":-5,"y":19,"cMask":[]},{"x":-21,"y":17,"cMask":[]},{"x":-5,"y":17,"cMask":[]},{"x":-21,"y":15,"cMask":[]},{"x":-5,"y":15,"cMask":[]},{"x":-21,"y":13,"cMask":[]},{"x":-5,"y":13,"cMask":[]},{"x":-21,"y":11,"cMask":[]},{"x":-5,"y":11,"cMask":[]},{"x":13,"y":30,"cMask":[]},{"x":22,"y":-30,"cMask":[]},{"x":15,"y":30,"cMask":[]},{"x":24,"y":-30,"cMask":[]},{"x":17,"y":30,"cMask":[]},{"x":26,"y":-30,"cMask":[]},{"x":19,"y":30,"cMask":[]},{"x":28,"y":-30,"cMask":[]},{"x":19,"y":-29,"cMask":[]},{"x":49,"y":-29,"cMask":[]},{"x":19,"y":-27,"cMask":[]},{"x":49,"y":-27,"cMask":[]},{"x":19,"y":-25,"cMask":[]},{"x":49,"y":-25,"cMask":[]},{"x":19,"y":-23,"cMask":[]},{"x":49,"y":-23,"cMask":[]},{"x":19,"y":-21,"cMask":[]},{"x":49,"y":-21,"cMask":[]},{"x":23,"y":-6,"cMask":[]},{"x":42,"y":-6,"cMask":[]},{"x":23,"y":-4,"cMask":[]},{"x":42,"y":-4,"cMask":[]},{"x":23,"y":-2,"cMask":[]},{"x":42,"y":-2,"cMask":[]},{"x":23,"y":0,"cMask":[]},{"x":42,"y":0,"cMask":[]},{"x":23,"y":2,"cMask":[]},{"x":42,"y":2,"cMask":[]},{"x":-52,"y":27,"cMask":[]},{"x":-27,"y":-33,"cMask":[]},{"x":9,"y":27,"cMask":[]},{"x":18,"y":-33,"cMask":[]},{"x":-44.5,"y":27,"cMask":[]},{"x":-19.5,"y":-33,"cMask":[]},{"x":-54,"y":27,"cMask":[]},{"x":-29,"y":-33,"cMask":[]},{"x":-42.5,"y":27,"cMask":[]},{"x":-17.5,"y":-33,"cMask":[]},{"x":-35,"y":27,"cMask":[]},{"x":-10,"y":-33,"cMask":[]},{"x":-33,"y":27,"cMask":[]},{"x":-8,"y":-33,"cMask":[]},{"x":-31,"y":27,"cMask":[]},{"x":-6,"y":-33,"cMask":[]},{"x":-29,"y":27,"cMask":[]},{"x":-4,"y":-33,"cMask":[]},{"x":-27,"y":27,"cMask":[]},{"x":-2,"y":-33,"cMask":[]},{"x":3,"y":27,"cMask":[]},{"x":-2,"y":-33,"cMask":[]},{"x":1,"y":27,"cMask":[]},{"x":-4,"y":-33,"cMask":[]},{"x":-1,"y":27,"cMask":[]},{"x":-6,"y":-33,"cMask":[]},{"x":-3,"y":27,"cMask":[]},{"x":-8,"y":-33,"cMask":[]},{"x":-5,"y":27,"cMask":[]},{"x":-10,"y":-33,"cMask":[]},{"x":-23,"y":16,"cMask":[]},{"x":-7,"y":16,"cMask":[]},{"x":-23,"y":14,"cMask":[]},{"x":-7,"y":14,"cMask":[]},{"x":-23,"y":12,"cMask":[]},{"x":-7,"y":12,"cMask":[]},{"x":-23,"y":10,"cMask":[]},{"x":-7,"y":10,"cMask":[]},{"x":-23,"y":8,"cMask":[]},{"x":-7,"y":8,"cMask":[]},{"x":11,"y":27,"cMask":[]},{"x":20,"y":-33,"cMask":[]},{"x":13,"y":27,"cMask":[]},{"x":22,"y":-33,"cMask":[]},{"x":15,"y":27,"cMask":[]},{"x":24,"y":-33,"cMask":[]},{"x":17,"y":27,"cMask":[]},{"x":26,"y":-33,"cMask":[]},{"x":17,"y":-32,"cMask":[]},{"x":47,"y":-32,"cMask":[]},{"x":17,"y":-30,"cMask":[]},{"x":47,"y":-30,"cMask":[]},{"x":17,"y":-28,"cMask":[]},{"x":47,"y":-28,"cMask":[]},{"x":17,"y":-26,"cMask":[]},{"x":47,"y":-26,"cMask":[]},{"x":17,"y":-24,"cMask":[]},{"x":47,"y":-24,"cMask":[]},{"x":21,"y":-9,"cMask":[]},{"x":40,"y":-9,"cMask":[]},{"x":21,"y":-7,"cMask":[]},{"x":40,"y":-7,"cMask":[]},{"x":21,"y":-5,"cMask":[]},{"x":40,"y":-5,"cMask":[]},{"x":21,"y":-3,"cMask":[]},{"x":40,"y":-3,"cMask":[]},{"x":21,"y":-1,"cMask":[]},{"x":40,"y":-1,"cMask":[]}],"segments":[{"v0":0,"v1":1,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":3,"v1":2,"bias":-10,"bCoef":0.1,"curve":35,"curveF":3.1715948023632126,"cMask":["ball"],"color":"717F98"},{"v0":4,"v1":5,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":6,"v1":7,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":9,"v1":8,"bias":-10,"bCoef":0.1,"curve":35,"curveF":3.1715948023632126,"cMask":["ball"],"color":"717F98"},{"v0":10,"v1":11,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":12,"v1":13,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":14,"v1":15,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":16,"v1":17,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":18,"v1":19,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":20,"v1":21,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":22,"v1":23,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":24,"v1":25,"cMask":[],"color":"3B424F"},{"v0":26,"v1":27,"cMask":[],"color":"3B424F"},{"v0":30,"v1":28,"vis":false,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":31,"v1":29,"vis":false,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":29,"v1":28,"curve":180,"curveF":6.123233995736766e-17,"vis":false,"cMask":["red","blue"],"cGroup":["blueKO"]},{"v0":28,"v1":29,"curve":180,"curveF":6.123233995736766e-17,"vis":false,"cMask":["red","blue"],"cGroup":["redKO"]},{"v0":32,"v1":33,"cMask":[],"color":"161C26"},{"v0":34,"v1":35,"cMask":[],"color":"161C26"},{"v0":35,"v1":33,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":33,"v1":35,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":36,"v1":37,"cMask":[],"color":"9101D"},{"v0":38,"v1":39,"cMask":[],"color":"9101D"},{"v0":40,"v1":41,"cMask":[],"color":"9101D"},{"v0":42,"v1":43,"cMask":[],"color":"9101D"},{"v0":44,"v1":45,"cMask":[],"color":"9101D"},{"v0":46,"v1":47,"cMask":[],"color":"9101D"},{"v0":48,"v1":49,"cMask":[],"color":"9101D"},{"v0":50,"v1":51,"cMask":[],"color":"9101D"},{"v0":52,"v1":53,"cMask":[],"color":"9101D"},{"v0":54,"v1":55,"cMask":[],"color":"9101D"},{"v0":56,"v1":57,"cMask":[],"color":"9101D"},{"v0":58,"v1":59,"cMask":[],"color":"9101D"},{"v0":60,"v1":61,"cMask":[],"color":"9101D"},{"v0":62,"v1":63,"cMask":[],"color":"9101D"},{"v0":64,"v1":65,"cMask":[],"color":"9101D"},{"v0":66,"v1":67,"cMask":[],"color":"9101D"},{"v0":68,"v1":69,"cMask":[],"color":"9101D"},{"v0":70,"v1":71,"cMask":[],"color":"9101D"},{"v0":72,"v1":73,"cMask":[],"color":"9101D"},{"v0":74,"v1":75,"cMask":[],"color":"9101D"},{"v0":76,"v1":77,"cMask":[],"color":"9101D"},{"v0":78,"v1":79,"cMask":[],"color":"9101D"},{"v0":80,"v1":81,"cMask":[],"color":"9101D"},{"v0":82,"v1":83,"cMask":[],"color":"9101D"},{"v0":84,"v1":85,"cMask":[],"color":"9101D"},{"v0":86,"v1":87,"cMask":[],"color":"9101D"},{"v0":88,"v1":89,"cMask":[],"color":"9101D"},{"v0":90,"v1":91,"cMask":[],"color":"9101D"},{"v0":92,"v1":93,"cMask":[],"color":"9101D"},{"v0":94,"v1":95,"cMask":[],"color":"9101D"},{"v0":96,"v1":97,"cMask":[],"color":"9101D"},{"v0":98,"v1":99,"cMask":[],"color":"9101D"},{"v0":100,"v1":101,"cMask":[],"color":"9101D"},{"v0":102,"v1":103,"cMask":[],"color":"9101D"},{"v0":104,"v1":105,"cMask":[],"color":"333945"},{"v0":106,"v1":107,"cMask":[],"color":"333945"},{"v0":108,"v1":109,"cMask":[],"color":"333945"},{"v0":110,"v1":111,"cMask":[],"color":"333945"},{"v0":112,"v1":113,"cMask":[],"color":"333945"},{"v0":114,"v1":115,"cMask":[],"color":"333945"},{"v0":116,"v1":117,"cMask":[],"color":"333945"},{"v0":118,"v1":119,"cMask":[],"color":"333945"},{"v0":120,"v1":121,"cMask":[],"color":"333945"},{"v0":122,"v1":123,"cMask":[],"color":"333945"},{"v0":124,"v1":125,"cMask":[],"color":"333945"},{"v0":126,"v1":127,"cMask":[],"color":"333945"},{"v0":128,"v1":129,"cMask":[],"color":"333945"},{"v0":130,"v1":131,"cMask":[],"color":"333945"},{"v0":132,"v1":133,"cMask":[],"color":"333945"},{"v0":134,"v1":135,"cMask":[],"color":"333945"},{"v0":136,"v1":137,"cMask":[],"color":"333945"},{"v0":138,"v1":139,"cMask":[],"color":"333945"},{"v0":140,"v1":141,"cMask":[],"color":"333945"},{"v0":142,"v1":143,"cMask":[],"color":"333945"},{"v0":144,"v1":145,"cMask":[],"color":"333945"},{"v0":146,"v1":147,"cMask":[],"color":"333945"},{"v0":148,"v1":149,"cMask":[],"color":"333945"},{"v0":150,"v1":151,"cMask":[],"color":"333945"},{"v0":152,"v1":153,"cMask":[],"color":"333945"},{"v0":154,"v1":155,"cMask":[],"color":"333945"},{"v0":156,"v1":157,"cMask":[],"color":"333945"},{"v0":158,"v1":159,"cMask":[],"color":"333945"},{"v0":160,"v1":161,"cMask":[],"color":"333945"},{"v0":162,"v1":163,"cMask":[],"color":"333945"},{"v0":164,"v1":165,"cMask":[],"color":"333945"},{"v0":166,"v1":167,"cMask":[],"color":"333945"},{"v0":168,"v1":169,"cMask":[],"color":"333945"},{"v0":170,"v1":171,"cMask":[],"color":"333945"}],"planes":[{"normal":[0,1],"dist":-230},{"normal":[0,-1],"dist":-230},{"normal":[1,0],"dist":-510},{"normal":[-1,0],"dist":-510}],"goals":[{"p0":[-408.3,-70],"p1":[-408.3,70],"team":"red"},{"p0":[408.3,70],"p1":[408.3,-70],"team":"blue"}],"discs":[{"radius":5.8,"bCoef":0.412,"invMass":1.55,"color":"FFA500","cGroup":["ball","kick","score"]},{"pos":[-400,70],"radius":5.4,"invMass":0,"color":"3B424F"},{"pos":[-400,-70],"radius":5.4,"invMass":0,"color":"3B424F"},{"pos":[400,70],"radius":5.4,"invMass":0,"color":"3B424F"},{"pos":[400,-70],"radius":5.4,"invMass":0,"color":"3B424F"}],"playerPhysics":{"bCoef":0,"acceleration":0.11,"kickingAcceleration":0.083,"kickStrength":4.2},"ballPhysics":"disc0","spawnDistance":366.5}', // JSON del mapa 1v1
  '2v2': '{"name":"AF Official 1v1 by Vitão ®","width":510,"height":230,"bg":{"kickOffRadius":80,"color":"1D2431"},"vertexes":[{"x":-400,"y":-70,"bCoef":0.1,"cMask":["ball"]},{"x":-435,"y":-70,"bCoef":0.1,"cMask":["ball"]},{"x":-434,"y":-71,"bCoef":0.1,"cMask":["ball"]},{"x":-434,"y":71,"bCoef":0.1,"cMask":["ball"]},{"x":-435,"y":70,"bCoef":0.1,"cMask":["ball"]},{"x":-400,"y":70,"bCoef":0.1,"cMask":["ball"]},{"x":400,"y":70,"bCoef":0.1,"cMask":["ball"]},{"x":435,"y":70,"bCoef":0.1,"cMask":["ball"]},{"x":434,"y":71,"bCoef":0.1,"cMask":["ball"]},{"x":434,"y":-71,"bCoef":0.1,"cMask":["ball"]},{"x":435,"y":-70,"bCoef":0.1,"cMask":["ball"]},{"x":400,"y":-70,"bCoef":0.1,"cMask":["ball"]},{"x":-400,"y":-201.5,"cMask":["ball"]},{"x":-400,"y":-70,"cMask":["ball"]},{"x":-400,"y":70,"cMask":["ball"]},{"x":-400,"y":201.5,"cMask":["ball"]},{"x":-400,"y":200,"cMask":["ball"]},{"x":400,"y":200,"cMask":["ball"]},{"x":400,"y":201.5,"cMask":["ball"]},{"x":400,"y":70,"cMask":["ball"]},{"x":400,"y":-70,"cMask":["ball"]},{"x":400,"y":-201.5,"cMask":["ball"]},{"x":400,"y":-200,"cMask":["ball"]},{"x":-400,"y":-200,"cMask":["ball"]},{"x":-400,"y":-70,"cMask":[]},{"x":-400,"y":70,"cMask":[]},{"x":400,"y":70,"cMask":[]},{"x":400,"y":-70,"cMask":[]},{"x":0,"y":-80,"cMask":["red","blue"],"cGroup":["redKO"]},{"x":0,"y":80,"cMask":["red","blue"],"cGroup":["redKO"]},{"x":0,"y":-230,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":230,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-198,"cMask":[]},{"x":0,"y":-80,"cMask":[]},{"x":0,"y":198,"cMask":[]},{"x":0,"y":80,"cMask":[]},{"x":-50,"y":30,"cMask":[]},{"x":-25,"y":-30,"cMask":[]},{"x":11,"y":30,"cMask":[]},{"x":20,"y":-30,"cMask":[]},{"x":-42.5,"y":30,"cMask":[]},{"x":-17.5,"y":-30,"cMask":[]},{"x":-52,"y":30,"cMask":[]},{"x":-27,"y":-30,"cMask":[]},{"x":-40.5,"y":30,"cMask":[]},{"x":-15.5,"y":-30,"cMask":[]},{"x":-33,"y":30,"cMask":[]},{"x":-8,"y":-30,"cMask":[]},{"x":-31,"y":30,"cMask":[]},{"x":-6,"y":-30,"cMask":[]},{"x":-29,"y":30,"cMask":[]},{"x":-4,"y":-30,"cMask":[]},{"x":-27,"y":30,"cMask":[]},{"x":-2,"y":-30,"cMask":[]},{"x":-25,"y":30,"cMask":[]},{"x":0,"y":-30,"cMask":[]},{"x":5,"y":30,"cMask":[]},{"x":0,"y":-30,"cMask":[]},{"x":3,"y":30,"cMask":[]},{"x":-2,"y":-30,"cMask":[]},{"x":1,"y":30,"cMask":[]},{"x":-4,"y":-30,"cMask":[]},{"x":-1,"y":30,"cMask":[]},{"x":-6,"y":-30,"cMask":[]},{"x":-3,"y":30,"cMask":[]},{"x":-8,"y":-30,"cMask":[]},{"x":-21,"y":19,"cMask":[]},{"x":-5,"y":19,"cMask":[]},{"x":-21,"y":17,"cMask":[]},{"x":-5,"y":17,"cMask":[]},{"x":-21,"y":15,"cMask":[]},{"x":-5,"y":15,"cMask":[]},{"x":-21,"y":13,"cMask":[]},{"x":-5,"y":13,"cMask":[]},{"x":-21,"y":11,"cMask":[]},{"x":-5,"y":11,"cMask":[]},{"x":13,"y":30,"cMask":[]},{"x":22,"y":-30,"cMask":[]},{"x":15,"y":30,"cMask":[]},{"x":24,"y":-30,"cMask":[]},{"x":17,"y":30,"cMask":[]},{"x":26,"y":-30,"cMask":[]},{"x":19,"y":30,"cMask":[]},{"x":28,"y":-30,"cMask":[]},{"x":19,"y":-29,"cMask":[]},{"x":49,"y":-29,"cMask":[]},{"x":19,"y":-27,"cMask":[]},{"x":49,"y":-27,"cMask":[]},{"x":19,"y":-25,"cMask":[]},{"x":49,"y":-25,"cMask":[]},{"x":19,"y":-23,"cMask":[]},{"x":49,"y":-23,"cMask":[]},{"x":19,"y":-21,"cMask":[]},{"x":49,"y":-21,"cMask":[]},{"x":23,"y":-6,"cMask":[]},{"x":42,"y":-6,"cMask":[]},{"x":23,"y":-4,"cMask":[]},{"x":42,"y":-4,"cMask":[]},{"x":23,"y":-2,"cMask":[]},{"x":42,"y":-2,"cMask":[]},{"x":23,"y":0,"cMask":[]},{"x":42,"y":0,"cMask":[]},{"x":23,"y":2,"cMask":[]},{"x":42,"y":2,"cMask":[]},{"x":-52,"y":27,"cMask":[]},{"x":-27,"y":-33,"cMask":[]},{"x":9,"y":27,"cMask":[]},{"x":18,"y":-33,"cMask":[]},{"x":-44.5,"y":27,"cMask":[]},{"x":-19.5,"y":-33,"cMask":[]},{"x":-54,"y":27,"cMask":[]},{"x":-29,"y":-33,"cMask":[]},{"x":-42.5,"y":27,"cMask":[]},{"x":-17.5,"y":-33,"cMask":[]},{"x":-35,"y":27,"cMask":[]},{"x":-10,"y":-33,"cMask":[]},{"x":-33,"y":27,"cMask":[]},{"x":-8,"y":-33,"cMask":[]},{"x":-31,"y":27,"cMask":[]},{"x":-6,"y":-33,"cMask":[]},{"x":-29,"y":27,"cMask":[]},{"x":-4,"y":-33,"cMask":[]},{"x":-27,"y":27,"cMask":[]},{"x":-2,"y":-33,"cMask":[]},{"x":3,"y":27,"cMask":[]},{"x":-2,"y":-33,"cMask":[]},{"x":1,"y":27,"cMask":[]},{"x":-4,"y":-33,"cMask":[]},{"x":-1,"y":27,"cMask":[]},{"x":-6,"y":-33,"cMask":[]},{"x":-3,"y":27,"cMask":[]},{"x":-8,"y":-33,"cMask":[]},{"x":-5,"y":27,"cMask":[]},{"x":-10,"y":-33,"cMask":[]},{"x":-23,"y":16,"cMask":[]},{"x":-7,"y":16,"cMask":[]},{"x":-23,"y":14,"cMask":[]},{"x":-7,"y":14,"cMask":[]},{"x":-23,"y":12,"cMask":[]},{"x":-7,"y":12,"cMask":[]},{"x":-23,"y":10,"cMask":[]},{"x":-7,"y":10,"cMask":[]},{"x":-23,"y":8,"cMask":[]},{"x":-7,"y":8,"cMask":[]},{"x":11,"y":27,"cMask":[]},{"x":20,"y":-33,"cMask":[]},{"x":13,"y":27,"cMask":[]},{"x":22,"y":-33,"cMask":[]},{"x":15,"y":27,"cMask":[]},{"x":24,"y":-33,"cMask":[]},{"x":17,"y":27,"cMask":[]},{"x":26,"y":-33,"cMask":[]},{"x":17,"y":-32,"cMask":[]},{"x":47,"y":-32,"cMask":[]},{"x":17,"y":-30,"cMask":[]},{"x":47,"y":-30,"cMask":[]},{"x":17,"y":-28,"cMask":[]},{"x":47,"y":-28,"cMask":[]},{"x":17,"y":-26,"cMask":[]},{"x":47,"y":-26,"cMask":[]},{"x":17,"y":-24,"cMask":[]},{"x":47,"y":-24,"cMask":[]},{"x":21,"y":-9,"cMask":[]},{"x":40,"y":-9,"cMask":[]},{"x":21,"y":-7,"cMask":[]},{"x":40,"y":-7,"cMask":[]},{"x":21,"y":-5,"cMask":[]},{"x":40,"y":-5,"cMask":[]},{"x":21,"y":-3,"cMask":[]},{"x":40,"y":-3,"cMask":[]},{"x":21,"y":-1,"cMask":[]},{"x":40,"y":-1,"cMask":[]}],"segments":[{"v0":0,"v1":1,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":3,"v1":2,"bias":-10,"bCoef":0.1,"curve":35,"curveF":3.1715948023632126,"cMask":["ball"],"color":"717F98"},{"v0":4,"v1":5,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":6,"v1":7,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":9,"v1":8,"bias":-10,"bCoef":0.1,"curve":35,"curveF":3.1715948023632126,"cMask":["ball"],"color":"717F98"},{"v0":10,"v1":11,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":12,"v1":13,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":14,"v1":15,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":16,"v1":17,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":18,"v1":19,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":20,"v1":21,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":22,"v1":23,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":24,"v1":25,"cMask":[],"color":"3B424F"},{"v0":26,"v1":27,"cMask":[],"color":"3B424F"},{"v0":30,"v1":28,"vis":false,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":31,"v1":29,"vis":false,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":29,"v1":28,"curve":180,"curveF":6.123233995736766e-17,"vis":false,"cMask":["red","blue"],"cGroup":["blueKO"]},{"v0":28,"v1":29,"curve":180,"curveF":6.123233995736766e-17,"vis":false,"cMask":["red","blue"],"cGroup":["redKO"]},{"v0":32,"v1":33,"cMask":[],"color":"161C26"},{"v0":34,"v1":35,"cMask":[],"color":"161C26"},{"v0":35,"v1":33,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":33,"v1":35,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":36,"v1":37,"cMask":[],"color":"9101D"},{"v0":38,"v1":39,"cMask":[],"color":"9101D"},{"v0":40,"v1":41,"cMask":[],"color":"9101D"},{"v0":42,"v1":43,"cMask":[],"color":"9101D"},{"v0":44,"v1":45,"cMask":[],"color":"9101D"},{"v0":46,"v1":47,"cMask":[],"color":"9101D"},{"v0":48,"v1":49,"cMask":[],"color":"9101D"},{"v0":50,"v1":51,"cMask":[],"color":"9101D"},{"v0":52,"v1":53,"cMask":[],"color":"9101D"},{"v0":54,"v1":55,"cMask":[],"color":"9101D"},{"v0":56,"v1":57,"cMask":[],"color":"9101D"},{"v0":58,"v1":59,"cMask":[],"color":"9101D"},{"v0":60,"v1":61,"cMask":[],"color":"9101D"},{"v0":62,"v1":63,"cMask":[],"color":"9101D"},{"v0":64,"v1":65,"cMask":[],"color":"9101D"},{"v0":66,"v1":67,"cMask":[],"color":"9101D"},{"v0":68,"v1":69,"cMask":[],"color":"9101D"},{"v0":70,"v1":71,"cMask":[],"color":"9101D"},{"v0":72,"v1":73,"cMask":[],"color":"9101D"},{"v0":74,"v1":75,"cMask":[],"color":"9101D"},{"v0":76,"v1":77,"cMask":[],"color":"9101D"},{"v0":78,"v1":79,"cMask":[],"color":"9101D"},{"v0":80,"v1":81,"cMask":[],"color":"9101D"},{"v0":82,"v1":83,"cMask":[],"color":"9101D"},{"v0":84,"v1":85,"cMask":[],"color":"9101D"},{"v0":86,"v1":87,"cMask":[],"color":"9101D"},{"v0":88,"v1":89,"cMask":[],"color":"9101D"},{"v0":90,"v1":91,"cMask":[],"color":"9101D"},{"v0":92,"v1":93,"cMask":[],"color":"9101D"},{"v0":94,"v1":95,"cMask":[],"color":"9101D"},{"v0":96,"v1":97,"cMask":[],"color":"9101D"},{"v0":98,"v1":99,"cMask":[],"color":"9101D"},{"v0":100,"v1":101,"cMask":[],"color":"9101D"},{"v0":102,"v1":103,"cMask":[],"color":"9101D"},{"v0":104,"v1":105,"cMask":[],"color":"333945"},{"v0":106,"v1":107,"cMask":[],"color":"333945"},{"v0":108,"v1":109,"cMask":[],"color":"333945"},{"v0":110,"v1":111,"cMask":[],"color":"333945"},{"v0":112,"v1":113,"cMask":[],"color":"333945"},{"v0":114,"v1":115,"cMask":[],"color":"333945"},{"v0":116,"v1":117,"cMask":[],"color":"333945"},{"v0":118,"v1":119,"cMask":[],"color":"333945"},{"v0":120,"v1":121,"cMask":[],"color":"333945"},{"v0":122,"v1":123,"cMask":[],"color":"333945"},{"v0":124,"v1":125,"cMask":[],"color":"333945"},{"v0":126,"v1":127,"cMask":[],"color":"333945"},{"v0":128,"v1":129,"cMask":[],"color":"333945"},{"v0":130,"v1":131,"cMask":[],"color":"333945"},{"v0":132,"v1":133,"cMask":[],"color":"333945"},{"v0":134,"v1":135,"cMask":[],"color":"333945"},{"v0":136,"v1":137,"cMask":[],"color":"333945"},{"v0":138,"v1":139,"cMask":[],"color":"333945"},{"v0":140,"v1":141,"cMask":[],"color":"333945"},{"v0":142,"v1":143,"cMask":[],"color":"333945"},{"v0":144,"v1":145,"cMask":[],"color":"333945"},{"v0":146,"v1":147,"cMask":[],"color":"333945"},{"v0":148,"v1":149,"cMask":[],"color":"333945"},{"v0":150,"v1":151,"cMask":[],"color":"333945"},{"v0":152,"v1":153,"cMask":[],"color":"333945"},{"v0":154,"v1":155,"cMask":[],"color":"333945"},{"v0":156,"v1":157,"cMask":[],"color":"333945"},{"v0":158,"v1":159,"cMask":[],"color":"333945"},{"v0":160,"v1":161,"cMask":[],"color":"333945"},{"v0":162,"v1":163,"cMask":[],"color":"333945"},{"v0":164,"v1":165,"cMask":[],"color":"333945"},{"v0":166,"v1":167,"cMask":[],"color":"333945"},{"v0":168,"v1":169,"cMask":[],"color":"333945"},{"v0":170,"v1":171,"cMask":[],"color":"333945"}],"planes":[{"normal":[0,1],"dist":-230},{"normal":[0,-1],"dist":-230},{"normal":[1,0],"dist":-510},{"normal":[-1,0],"dist":-510}],"goals":[{"p0":[-408.3,-70],"p1":[-408.3,70],"team":"red"},{"p0":[408.3,70],"p1":[408.3,-70],"team":"blue"}],"discs":[{"radius":5.8,"bCoef":0.412,"invMass":1.55,"color":"FFA500","cGroup":["ball","kick","score"]},{"pos":[-400,70],"radius":5.4,"invMass":0,"color":"3B424F"},{"pos":[-400,-70],"radius":5.4,"invMass":0,"color":"3B424F"},{"pos":[400,70],"radius":5.4,"invMass":0,"color":"3B424F"},{"pos":[400,-70],"radius":5.4,"invMass":0,"color":"3B424F"}],"playerPhysics":{"bCoef":0,"acceleration":0.11,"kickingAcceleration":0.083,"kickStrength":4.2},"ballPhysics":"disc0","spawnDistance":366.5}',
  '3v3': '{"name":"AF 3v3 Official by Vitão ® from HaxMaps","width":710,"height":300,"bg":{"kickOffRadius":80,"color":"1D2431"},"vertexes":[{"x":-600,"y":-85,"bCoef":0.1,"cMask":["ball"]},{"x":-635,"y":-85,"bCoef":0.1,"cMask":["ball"]},{"x":-634,"y":-86,"bCoef":0.1,"cMask":["ball"]},{"x":-634,"y":86,"bCoef":0.1,"cMask":["ball"]},{"x":-635,"y":85,"bCoef":0.1,"cMask":["ball"]},{"x":-600,"y":85,"bCoef":0.1,"cMask":["ball"]},{"x":600,"y":85,"bCoef":0.1,"cMask":["ball"]},{"x":635,"y":85,"bCoef":0.1,"cMask":["ball"]},{"x":634,"y":86,"bCoef":0.1,"cMask":["ball"]},{"x":634,"y":-86,"bCoef":0.1,"cMask":["ball"]},{"x":635,"y":-85,"bCoef":0.1,"cMask":["ball"]},{"x":600,"y":-85,"bCoef":0.1,"cMask":["ball"]},{"x":-600,"y":-271.5,"cMask":["ball"]},{"x":-600,"y":-85,"cMask":["ball"]},{"x":-600,"y":85,"cMask":["ball"]},{"x":-600,"y":271.5,"cMask":["ball"]},{"x":-600,"y":270,"cMask":["ball"]},{"x":600,"y":270,"cMask":["ball"]},{"x":600,"y":271.5,"cMask":["ball"]},{"x":600,"y":85,"cMask":["ball"]},{"x":600,"y":-85,"cMask":["ball"]},{"x":600,"y":-271.5,"cMask":["ball"]},{"x":600,"y":-270,"cMask":["ball"]},{"x":-600,"y":-270,"cMask":["ball"]},{"x":-600,"y":-85,"cMask":[]},{"x":-600,"y":85,"cMask":[]},{"x":600,"y":85,"cMask":[]},{"x":600,"y":-85,"cMask":[]},{"x":-310,"y":268,"cMask":[]},{"x":-310,"y":-268,"cMask":[]},{"x":310,"y":-268,"cMask":[]},{"x":310,"y":268,"cMask":[]},{"x":-420,"y":-1,"cMask":[]},{"x":-420,"y":1,"cMask":[]},{"x":-420,"y":-2,"cMask":[]},{"x":-420,"y":2,"cMask":[]},{"x":0,"y":-80,"cMask":["red","blue"],"cGroup":["redKO"]},{"x":0,"y":80,"cMask":["red","blue"],"cGroup":["redKO"]},{"x":0,"y":-300,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":300,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-268,"cMask":[]},{"x":0,"y":-80,"cMask":[]},{"x":0,"y":268,"cMask":[]},{"x":0,"y":80,"cMask":[]},{"x":420,"y":-1,"cMask":[]},{"x":420,"y":1,"cMask":[]},{"x":420,"y":-2,"cMask":[]},{"x":420,"y":2,"cMask":[]},{"x":-310,"y":-135,"cMask":[]},{"x":-310,"y":135,"cMask":[]},{"x":310,"y":135,"cMask":[]},{"x":310,"y":-135,"cMask":[]},{"x":-598,"y":125,"cMask":[]},{"x":-530,"y":125,"cMask":[]},{"x":-530,"y":-125,"cMask":[]},{"x":-598,"y":-125,"cMask":[]},{"x":-530,"y":126.5,"cMask":[]},{"x":-530,"y":-126.5,"cMask":[]},{"x":598,"y":125,"cMask":[]},{"x":530,"y":125,"cMask":[]},{"x":530,"y":-125,"cMask":[]},{"x":598,"y":-125,"cMask":[]},{"x":530,"y":126.5,"cMask":[]},{"x":530,"y":-126.5,"cMask":[]},{"x":-50,"y":30,"cMask":[]},{"x":-25,"y":-30,"cMask":[]},{"x":11,"y":30,"cMask":[]},{"x":20,"y":-30,"cMask":[]},{"x":-42.5,"y":30,"cMask":[]},{"x":-17.5,"y":-30,"cMask":[]},{"x":-52,"y":30,"cMask":[]},{"x":-27,"y":-30,"cMask":[]},{"x":-40.5,"y":30,"cMask":[]},{"x":-15.5,"y":-30,"cMask":[]},{"x":-33,"y":30,"cMask":[]},{"x":-8,"y":-30,"cMask":[]},{"x":-31,"y":30,"cMask":[]},{"x":-6,"y":-30,"cMask":[]},{"x":-29,"y":30,"cMask":[]},{"x":-4,"y":-30,"cMask":[]},{"x":-27,"y":30,"cMask":[]},{"x":-2,"y":-30,"cMask":[]},{"x":-25,"y":30,"cMask":[]},{"x":0,"y":-30,"cMask":[]},{"x":5,"y":30,"cMask":[]},{"x":0,"y":-30,"cMask":[]},{"x":3,"y":30,"cMask":[]},{"x":-2,"y":-30,"cMask":[]},{"x":1,"y":30,"cMask":[]},{"x":-4,"y":-30,"cMask":[]},{"x":-1,"y":30,"cMask":[]},{"x":-6,"y":-30,"cMask":[]},{"x":-3,"y":30,"cMask":[]},{"x":-8,"y":-30,"cMask":[]},{"x":-21,"y":19,"cMask":[]},{"x":-5,"y":19,"cMask":[]},{"x":-21,"y":17,"cMask":[]},{"x":-5,"y":17,"cMask":[]},{"x":-21,"y":15,"cMask":[]},{"x":-5,"y":15,"cMask":[]},{"x":-21,"y":13,"cMask":[]},{"x":-5,"y":13,"cMask":[]},{"x":-21,"y":11,"cMask":[]},{"x":-5,"y":11,"cMask":[]},{"x":13,"y":30,"cMask":[]},{"x":22,"y":-30,"cMask":[]},{"x":15,"y":30,"cMask":[]},{"x":24,"y":-30,"cMask":[]},{"x":17,"y":30,"cMask":[]},{"x":26,"y":-30,"cMask":[]},{"x":19,"y":30,"cMask":[]},{"x":28,"y":-30,"cMask":[]},{"x":19,"y":-29,"cMask":[]},{"x":49,"y":-29,"cMask":[]},{"x":19,"y":-27,"cMask":[]},{"x":49,"y":-27,"cMask":[]},{"x":19,"y":-25,"cMask":[]},{"x":49,"y":-25,"cMask":[]},{"x":19,"y":-23,"cMask":[]},{"x":49,"y":-23,"cMask":[]},{"x":19,"y":-21,"cMask":[]},{"x":49,"y":-21,"cMask":[]},{"x":23,"y":-6,"cMask":[]},{"x":42,"y":-6,"cMask":[]},{"x":23,"y":-4,"cMask":[]},{"x":42,"y":-4,"cMask":[]},{"x":23,"y":-2,"cMask":[]},{"x":42,"y":-2,"cMask":[]},{"x":23,"y":0,"cMask":[]},{"x":42,"y":0,"cMask":[]},{"x":23,"y":2,"cMask":[]},{"x":42,"y":2,"cMask":[]},{"x":-52,"y":27,"cMask":[]},{"x":-27,"y":-33,"cMask":[]},{"x":9,"y":27,"cMask":[]},{"x":18,"y":-33,"cMask":[]},{"x":-44.5,"y":27,"cMask":[]},{"x":-19.5,"y":-33,"cMask":[]},{"x":-54,"y":27,"cMask":[]},{"x":-29,"y":-33,"cMask":[]},{"x":-42.5,"y":27,"cMask":[]},{"x":-17.5,"y":-33,"cMask":[]},{"x":-35,"y":27,"cMask":[]},{"x":-10,"y":-33,"cMask":[]},{"x":-33,"y":27,"cMask":[]},{"x":-8,"y":-33,"cMask":[]},{"x":-31,"y":27,"cMask":[]},{"x":-6,"y":-33,"cMask":[]},{"x":-29,"y":27,"cMask":[]},{"x":-4,"y":-33,"cMask":[]},{"x":-27,"y":27,"cMask":[]},{"x":-2,"y":-33,"cMask":[]},{"x":3,"y":27,"cMask":[]},{"x":-2,"y":-33,"cMask":[]},{"x":1,"y":27,"cMask":[]},{"x":-4,"y":-33,"cMask":[]},{"x":-1,"y":27,"cMask":[]},{"x":-6,"y":-33,"cMask":[]},{"x":-3,"y":27,"cMask":[]},{"x":-8,"y":-33,"cMask":[]},{"x":-5,"y":27,"cMask":[]},{"x":-10,"y":-33,"cMask":[]},{"x":-23,"y":16,"cMask":[]},{"x":-7,"y":16,"cMask":[]},{"x":-23,"y":14,"cMask":[]},{"x":-7,"y":14,"cMask":[]},{"x":-23,"y":12,"cMask":[]},{"x":-7,"y":12,"cMask":[]},{"x":-23,"y":10,"cMask":[]},{"x":-7,"y":10,"cMask":[]},{"x":-23,"y":8,"cMask":[]},{"x":-7,"y":8,"cMask":[]},{"x":11,"y":27,"cMask":[]},{"x":20,"y":-33,"cMask":[]},{"x":13,"y":27,"cMask":[]},{"x":22,"y":-33,"cMask":[]},{"x":15,"y":27,"cMask":[]},{"x":24,"y":-33,"cMask":[]},{"x":17,"y":27,"cMask":[]},{"x":26,"y":-33,"cMask":[]},{"x":17,"y":-32,"cMask":[]},{"x":47,"y":-32,"cMask":[]},{"x":17,"y":-30,"cMask":[]},{"x":47,"y":-30,"cMask":[]},{"x":17,"y":-28,"cMask":[]},{"x":47,"y":-28,"cMask":[]},{"x":17,"y":-26,"cMask":[]},{"x":47,"y":-26,"cMask":[]},{"x":17,"y":-24,"cMask":[]},{"x":47,"y":-24,"cMask":[]},{"x":21,"y":-9,"cMask":[]},{"x":40,"y":-9,"cMask":[]},{"x":21,"y":-7,"cMask":[]},{"x":40,"y":-7,"cMask":[]},{"x":21,"y":-5,"cMask":[]},{"x":40,"y":-5,"cMask":[]},{"x":21,"y":-3,"cMask":[]},{"x":40,"y":-3,"cMask":[]},{"x":21,"y":-1,"cMask":[]},{"x":40,"y":-1,"cMask":[]}],"segments":[{"v0":0,"v1":1,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":3,"v1":2,"bias":-10,"bCoef":0.1,"curve":35,"curveF":3.1715948023632126,"cMask":["ball"],"color":"717F98"},{"v0":4,"v1":5,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":6,"v1":7,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":9,"v1":8,"bias":-10,"bCoef":0.1,"curve":35,"curveF":3.1715948023632126,"cMask":["ball"],"color":"717F98"},{"v0":10,"v1":11,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":12,"v1":13,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":14,"v1":15,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":16,"v1":17,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":18,"v1":19,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":20,"v1":21,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":22,"v1":23,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":24,"v1":25,"cMask":[],"color":"3B424F"},{"v0":26,"v1":27,"cMask":[],"color":"3B424F"},{"v0":28,"v1":29,"cMask":[],"color":"161C26"},{"v0":30,"v1":31,"cMask":[],"color":"161C26"},{"v0":33,"v1":32,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":32,"v1":33,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":35,"v1":34,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":34,"v1":35,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":38,"v1":36,"vis":false,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":39,"v1":37,"vis":false,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":37,"v1":36,"curve":180,"curveF":6.123233995736766e-17,"vis":false,"cMask":["red","blue"],"cGroup":["blueKO"]},{"v0":36,"v1":37,"curve":180,"curveF":6.123233995736766e-17,"vis":false,"cMask":["red","blue"],"cGroup":["redKO"]},{"v0":40,"v1":41,"cMask":[],"color":"161C26"},{"v0":42,"v1":43,"cMask":[],"color":"161C26"},{"v0":43,"v1":41,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":41,"v1":43,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":45,"v1":44,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":44,"v1":45,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":47,"v1":46,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":46,"v1":47,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":48,"v1":49,"curve":89.99999999999999,"curveF":1.0000000000000002,"cMask":[],"color":"161C26"},{"v0":50,"v1":51,"curve":89.99999999999999,"curveF":1.0000000000000002,"cMask":[],"color":"161C26"},{"v0":52,"v1":53,"cMask":[],"color":"161C26"},{"v0":54,"v1":55,"cMask":[],"color":"161C26"},{"v0":56,"v1":57,"cMask":[],"color":"161C26"},{"v0":58,"v1":59,"cMask":[],"color":"161C26"},{"v0":60,"v1":61,"cMask":[],"color":"161C26"},{"v0":62,"v1":63,"cMask":[],"color":"161C26"},{"v0":64,"v1":65,"cMask":[],"color":"9101D"},{"v0":66,"v1":67,"cMask":[],"color":"9101D"},{"v0":68,"v1":69,"cMask":[],"color":"9101D"},{"v0":70,"v1":71,"cMask":[],"color":"9101D"},{"v0":72,"v1":73,"cMask":[],"color":"9101D"},{"v0":74,"v1":75,"cMask":[],"color":"9101D"},{"v0":76,"v1":77,"cMask":[],"color":"9101D"},{"v0":78,"v1":79,"cMask":[],"color":"9101D"},{"v0":80,"v1":81,"cMask":[],"color":"9101D"},{"v0":82,"v1":83,"cMask":[],"color":"9101D"},{"v0":84,"v1":85,"cMask":[],"color":"9101D"},{"v0":86,"v1":87,"cMask":[],"color":"9101D"},{"v0":88,"v1":89,"cMask":[],"color":"9101D"},{"v0":90,"v1":91,"cMask":[],"color":"9101D"},{"v0":92,"v1":93,"cMask":[],"color":"9101D"},{"v0":94,"v1":95,"cMask":[],"color":"9101D"},{"v0":96,"v1":97,"cMask":[],"color":"9101D"},{"v0":98,"v1":99,"cMask":[],"color":"9101D"},{"v0":100,"v1":101,"cMask":[],"color":"9101D"},{"v0":102,"v1":103,"cMask":[],"color":"9101D"},{"v0":104,"v1":105,"cMask":[],"color":"9101D"},{"v0":106,"v1":107,"cMask":[],"color":"9101D"},{"v0":108,"v1":109,"cMask":[],"color":"9101D"},{"v0":110,"v1":111,"cMask":[],"color":"9101D"},{"v0":112,"v1":113,"cMask":[],"color":"9101D"},{"v0":114,"v1":115,"cMask":[],"color":"9101D"},{"v0":116,"v1":117,"cMask":[],"color":"9101D"},{"v0":118,"v1":119,"cMask":[],"color":"9101D"},{"v0":120,"v1":121,"cMask":[],"color":"9101D"},{"v0":122,"v1":123,"cMask":[],"color":"9101D"},{"v0":124,"v1":125,"cMask":[],"color":"9101D"},{"v0":126,"v1":127,"cMask":[],"color":"9101D"},{"v0":128,"v1":129,"cMask":[],"color":"9101D"},{"v0":130,"v1":131,"cMask":[],"color":"9101D"},{"v0":132,"v1":133,"cMask":[],"color":"333945"},{"v0":134,"v1":135,"cMask":[],"color":"333945"},{"v0":136,"v1":137,"cMask":[],"color":"333945"},{"v0":138,"v1":139,"cMask":[],"color":"333945"},{"v0":140,"v1":141,"cMask":[],"color":"333945"},{"v0":142,"v1":143,"cMask":[],"color":"333945"},{"v0":144,"v1":145,"cMask":[],"color":"333945"},{"v0":146,"v1":147,"cMask":[],"color":"333945"},{"v0":148,"v1":149,"cMask":[],"color":"333945"},{"v0":150,"v1":151,"cMask":[],"color":"333945"},{"v0":152,"v1":153,"cMask":[],"color":"333945"},{"v0":154,"v1":155,"cMask":[],"color":"333945"},{"v0":156,"v1":157,"cMask":[],"color":"333945"},{"v0":158,"v1":159,"cMask":[],"color":"333945"},{"v0":160,"v1":161,"cMask":[],"color":"333945"},{"v0":162,"v1":163,"cMask":[],"color":"333945"},{"v0":164,"v1":165,"cMask":[],"color":"333945"},{"v0":166,"v1":167,"cMask":[],"color":"333945"},{"v0":168,"v1":169,"cMask":[],"color":"333945"},{"v0":170,"v1":171,"cMask":[],"color":"333945"},{"v0":172,"v1":173,"cMask":[],"color":"333945"},{"v0":174,"v1":175,"cMask":[],"color":"333945"},{"v0":176,"v1":177,"cMask":[],"color":"333945"},{"v0":178,"v1":179,"cMask":[],"color":"333945"},{"v0":180,"v1":181,"cMask":[],"color":"333945"},{"v0":182,"v1":183,"cMask":[],"color":"333945"},{"v0":184,"v1":185,"cMask":[],"color":"333945"},{"v0":186,"v1":187,"cMask":[],"color":"333945"},{"v0":188,"v1":189,"cMask":[],"color":"333945"},{"v0":190,"v1":191,"cMask":[],"color":"333945"},{"v0":192,"v1":193,"cMask":[],"color":"333945"},{"v0":194,"v1":195,"cMask":[],"color":"333945"},{"v0":196,"v1":197,"cMask":[],"color":"333945"},{"v0":198,"v1":199,"cMask":[],"color":"333945"}],"planes":[{"normal":[0,1],"dist":-300},{"normal":[0,-1],"dist":-300},{"normal":[1,0],"dist":-710},{"normal":[-1,0],"dist":-710},{"normal":[-1,0],"dist":-310,"bCoef":0,"cMask":["c1"]},{"normal":[1,0],"dist":-310,"bCoef":0,"cMask":["c0"]}],"goals":[{"p0":[-608.3,-85],"p1":[-608.3,85],"team":"red"},{"p0":[608.3,85],"p1":[608.3,-85],"team":"blue"}],"discs":[{"radius":5.8,"bCoef":0.412,"invMass":1.5,"color":"FFA500","cGroup":["ball","kick","score"]},{"pos":[-600,85],"radius":5.4,"invMass":0,"color":"3B424F"},{"pos":[-600,-85],"radius":5.4,"invMass":0,"color":"3B424F"},{"pos":[600,85],"radius":5.4,"invMass":0,"color":"3B424F"},{"pos":[600,-85],"radius":5.4,"invMass":0,"color":"3B424F"}],"playerPhysics":{"bCoef":0,"acceleration":0.11,"kickingAcceleration":0.083,"kickStrength":4.545},"ballPhysics":"disc0","spawnDistance":366.5}',
  '4v4': '{"name":"Bazinga x4","width":810,"height":350,"bg":{"type":"hockey","width":700,"height":320,"kickOffRadius":100,"color":"555555"},"vertexes":[{"x":-701,"y":-320,"cMask":["ball"]},{"x":701,"y":-320,"cMask":["ball"]},{"x":-701,"y":320,"cMask":["ball"]},{"x":701,"y":320,"cMask":["ball"]},{"x":-700,"y":85,"cMask":["ball"]},{"x":-700,"y":321,"cMask":["ball"]},{"x":700,"y":85,"cMask":["ball"]},{"x":700,"y":321,"cMask":["ball"]},{"x":-700,"y":-321,"cMask":["ball"]},{"x":-700,"y":-85,"cMask":["ball"]},{"x":700,"y":-321,"cMask":["ball"]},{"x":700,"y":-85,"cMask":["ball"]},{"x":-740,"y":-85,"bCoef":0.2,"cMask":["ball"],"cGroup":["ball"]},{"x":-700,"y":-85,"bCoef":0.2,"cMask":["ball"],"cGroup":["ball"]},{"x":-740,"y":85,"bCoef":0.2,"cMask":["ball"],"cGroup":["ball"]},{"x":-700,"y":85,"bCoef":0.2,"cMask":["ball"],"cGroup":["ball"]},{"x":-740,"y":-86,"bCoef":0.2,"cMask":["ball"],"cGroup":["ball"]},{"x":-740,"y":86,"bCoef":0.2,"cMask":["ball"],"cGroup":["ball"]},{"x":740,"y":-86,"bCoef":0.2,"cMask":["ball"],"cGroup":["ball"]},{"x":740,"y":86,"bCoef":0.2,"cMask":["ball"],"cGroup":["ball"]},{"x":740,"y":-85,"bCoef":0.2,"cMask":["ball"],"cGroup":["ball"]},{"x":700,"y":-85,"bCoef":0.2,"cMask":["ball"],"cGroup":["ball"]},{"x":740,"y":85,"bCoef":0.2,"cMask":["ball"],"cGroup":["ball"]},{"x":700,"y":85,"bCoef":0.2,"cMask":["ball"],"cGroup":["ball"]},{"x":-700,"y":-85,"cMask":["wall"]},{"x":-700,"y":85,"cMask":["wall"]},{"x":700,"y":-85,"cMask":["wall"]},{"x":700,"y":85,"cMask":["wall"]},{"x":-400,"y":-318.5,"cMask":["wall"]},{"x":400,"y":-318.5,"cMask":["wall"]},{"x":-700,"y":-270,"cMask":["wall"]},{"x":-470,"y":-75,"cMask":["wall"]},{"x":-700,"y":270,"cMask":["wall"]},{"x":-470,"y":65,"cMask":["wall"]},{"x":-470,"y":-75,"cMask":["wall"]},{"x":-470,"y":65,"cMask":["wall"]},{"x":0,"y":320.3820275364941,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-319.83437484123357,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":700,"y":270,"cMask":["wall"]},{"x":470,"y":65,"cMask":["wall"]},{"x":700,"y":-270,"cMask":["wall"]},{"x":470,"y":-75,"cMask":["wall"]},{"x":470,"y":-75,"cMask":["wall"]},{"x":470,"y":65,"cMask":["wall"]},{"x":0,"y":-100,"bCoef":0,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-345,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":345,"bCoef":0,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":100,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":100,"bCoef":0,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":0,"y":-100,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["blueKO"]},{"x":0,"y":100,"bCoef":0,"cMask":["red","blue"],"cGroup":["redKO"]},{"x":0,"y":-100,"bCoef":0.1,"cMask":["red","blue"],"cGroup":["redKO"]},{"x":0,"y":100,"cMask":["wall"]},{"x":0,"y":345,"cMask":["wall"]},{"x":0,"y":-345,"cMask":["wall"]},{"x":0,"y":-100,"cMask":["wall"]},{"x":0,"y":100,"cMask":["wall"]},{"x":0,"y":-100,"cMask":["wall"]},{"x":0,"y":100,"cMask":["wall"]},{"x":0,"y":-100,"cMask":["wall"]}],"segments":[{"v0":0,"v1":1,"bias":-10,"cMask":["ball"],"color":"F8F8F8"},{"v0":2,"v1":3,"bias":10,"cMask":["ball"],"color":"F8F8F8"},{"v0":4,"v1":5,"bias":10,"cMask":["ball"],"color":"F8F8F8"},{"v0":6,"v1":7,"bias":-10,"cMask":["ball"],"color":"F8F8F8"},{"v0":8,"v1":9,"bias":10,"cMask":["ball"],"color":"F8F8F8"},{"v0":10,"v1":11,"bias":-10,"cMask":["ball"],"color":"F8F8F8"},{"v0":12,"v1":13,"bias":-10,"bCoef":0.2,"cMask":["ball"],"cGroup":["ball"],"color":"FFFFFF"},{"v0":14,"v1":15,"bias":10,"bCoef":0.2,"cMask":["ball"],"cGroup":["ball"],"color":"FFFFFF"},{"v0":17,"v1":16,"bias":-10,"bCoef":0.2,"curve":25,"curveF":4.510708503662057,"cMask":["ball"],"cGroup":["ball"],"color":"FFFFFF"},{"v0":18,"v1":19,"bias":-10,"bCoef":0.2,"curve":25,"curveF":4.510708503662057,"cMask":["ball"],"cGroup":["ball"],"color":"FFFFFF"},{"v0":20,"v1":21,"bias":10,"bCoef":0.2,"cMask":["ball"],"cGroup":["ball"],"color":"FFFFFF"},{"v0":22,"v1":23,"bias":-10,"bCoef":0.2,"cMask":["ball"],"cGroup":["ball"],"color":"FFFFFF"},{"v0":24,"v1":25,"cMask":["wall"],"color":"A3A3A3"},{"v0":26,"v1":27,"cMask":["wall"],"color":"A3A3A3"},{"v0":30,"v1":31,"curve":89.99999999999999,"curveF":1.0000000000000002,"cMask":["wall"],"color":"F8F8F8"},{"v0":33,"v1":32,"curve":89.99999999999999,"curveF":1.0000000000000002,"cMask":["wall"],"color":"F8F8F8"},{"v0":34,"v1":35,"cMask":["wall"],"color":"F8F8F8"},{"v0":38,"v1":39,"curve":89.99999999999999,"curveF":1.0000000000000002,"cMask":["wall"],"color":"F8F8F8"},{"v0":41,"v1":40,"curve":89.99999999999999,"curveF":1.0000000000000002,"cMask":["wall"],"color":"F8F8F8"},{"v0":42,"v1":43,"cMask":["wall"],"color":"F8F8F8"},{"v0":44,"v1":45,"bCoef":0.1,"vis":false,"cMask":["red","blue"],"cGroup":["redKO","blueKO"],"color":"F8F8F8"},{"v0":46,"v1":47,"bCoef":0.1,"vis":false,"cMask":["red","blue"],"cGroup":["redKO","blueKO"],"color":"F8F8F8"},{"v0":48,"v1":49,"bCoef":0.1,"curve":180,"curveF":6.123233995736766e-17,"vis":false,"cMask":["red","blue"],"cGroup":["blueKO"],"color":"F8F8F8"},{"v0":51,"v1":50,"bCoef":0.1,"curve":180,"curveF":6.123233995736766e-17,"vis":false,"cMask":["red","blue"],"cGroup":["redKO"],"color":"F8F8F8"},{"v0":52,"v1":53,"cMask":["wall"],"color":"F8F8F8"},{"v0":54,"v1":55,"cMask":["wall"],"color":"F8F8F8"},{"v0":56,"v1":57,"curve":180,"curveF":6.123233995736766e-17,"cMask":["wall"],"color":"F8F8F8"},{"v0":59,"v1":58,"curve":180,"curveF":6.123233995736766e-17,"cMask":["wall"],"color":"F8F8F8"}],"planes":[{"normal":[0,1],"dist":-348.2861757312205,"cMask":["red","blue"]},{"normal":[0,-1],"dist":-347.06134384639995,"cMask":["red","blue"]},{"normal":[-1,0],"dist":-807.2112305951543,"cMask":["red","blue"]},{"normal":[1,0],"dist":-808.9250548639338,"cMask":["red","blue"]}],"goals":[{"p0":[-707.5912486600221,-84.22096224635555],"p1":[-707.5912486600221,85.77903775364445],"team":"red"},{"p0":[708.2805100245886,-85.58360543750378],"p1":[708.2805100245886,84.41639456249622],"team":"blue"}],"discs":[{"radius":6.25,"bCoef":0.4,"invMass":1.5,"color":"FFCC00","cGroup":["ball","kick","score"]},{"pos":[-700,-85],"radius":6,"bCoef":1,"invMass":0,"color":"A3A3A3"},{"pos":[-700,85],"radius":6,"bCoef":1,"invMass":0,"color":"A3A3A3"},{"pos":[700,-85],"radius":6,"bCoef":1,"invMass":0,"color":"A3A3A3"},{"pos":[700,85],"radius":6,"bCoef":1,"invMass":0,"color":"A3A3A3"}],"playerPhysics":{"bCoef":0,"acceleration":0.11,"kickingAcceleration":0.083,"cGroup":["red","blue"]},"ballPhysics":"disc0","spawnDistance":366.5,"redSpawnPoints":[[-150,0],[-500,0],[-300,-150],[-300,150],[-750,300],[-750,-300]],"blueSpawnPoints":[[150,0],[500,0],[300,-150],[300,150],[750,300],[750,-300]]}',
  '5v5': '{"name":"AF Official 5v5 by Vitão ®","width":810,"height":350,"bg":{"kickOffRadius":80,"color":"1D2431"},"vertexes":[{"x":-750,"y":-95,"bCoef":0.1,"cMask":["ball"]},{"x":-785,"y":-95,"bCoef":0.1,"cMask":["ball"]},{"x":-784,"y":-96,"bCoef":0.1,"cMask":["ball"]},{"x":-784,"y":96,"bCoef":0.1,"cMask":["ball"]},{"x":-785,"y":95,"bCoef":0.1,"cMask":["ball"]},{"x":-750,"y":95,"bCoef":0.1,"cMask":["ball"]},{"x":750,"y":95,"bCoef":0.1,"cMask":["ball"]},{"x":785,"y":95,"bCoef":0.1,"cMask":["ball"]},{"x":784,"y":96,"bCoef":0.1,"cMask":["ball"]},{"x":784,"y":-96,"bCoef":0.1,"cMask":["ball"]},{"x":785,"y":-95,"bCoef":0.1,"cMask":["ball"]},{"x":750,"y":-95,"bCoef":0.1,"cMask":["ball"]},{"x":-750,"y":-346.5,"cMask":["ball"]},{"x":-750,"y":-90,"cMask":["ball"]},{"x":-750,"y":90,"cMask":["ball"]},{"x":-750,"y":346.5,"cMask":["ball"]},{"x":-751.5,"y":345,"cMask":["ball"]},{"x":751.5,"y":345,"cMask":["ball"]},{"x":750,"y":346.5,"cMask":["ball"]},{"x":750,"y":90,"cMask":["ball"]},{"x":750,"y":-90,"cMask":["ball"]},{"x":750,"y":-346.5,"cMask":["ball"]},{"x":751.5,"y":-345,"cMask":["ball"]},{"x":-751.5,"y":-345,"cMask":["ball"]},{"x":-750,"y":-95,"cMask":[]},{"x":-750,"y":95,"cMask":[]},{"x":750,"y":95,"cMask":[]},{"x":750,"y":-95,"cMask":[]},{"x":-375,"y":343,"cMask":[]},{"x":-375,"y":-343,"cMask":[]},{"x":375,"y":-343,"cMask":[]},{"x":375,"y":343,"cMask":[]},{"x":-522.5,"y":-1,"cMask":[]},{"x":-522.5,"y":1,"cMask":[]},{"x":-522.5,"y":-2,"cMask":[]},{"x":-522.5,"y":2,"cMask":[]},{"x":0,"y":-80,"cMask":["red","blue"],"cGroup":["redKO"]},{"x":0,"y":80,"cMask":["red","blue"],"cGroup":["redKO"]},{"x":0,"y":-375,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":375,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"x":0,"y":-343,"cMask":[]},{"x":0,"y":-80,"cMask":[]},{"x":0,"y":343,"cMask":[]},{"x":0,"y":80,"cMask":[]},{"x":522.5,"y":-1,"cMask":[]},{"x":522.5,"y":1,"cMask":[]},{"x":522.5,"y":-2,"cMask":[]},{"x":522.5,"y":2,"cMask":[]},{"x":-375,"y":-145,"cMask":[]},{"x":-375,"y":145,"cMask":[]},{"x":375,"y":145,"cMask":[]},{"x":375,"y":-145,"cMask":[]},{"x":-748,"y":135,"cMask":[]},{"x":-668.5,"y":135,"cMask":[]},{"x":-668.5,"y":-135,"cMask":[]},{"x":-748,"y":-135,"cMask":[]},{"x":-670,"y":135.5,"cMask":[]},{"x":-670,"y":-135.5,"cMask":[]},{"x":748,"y":135,"cMask":[]},{"x":668.5,"y":135,"cMask":[]},{"x":668.5,"y":-135,"cMask":[]},{"x":748,"y":-135,"cMask":[]},{"x":670,"y":135.5,"cMask":[]},{"x":670,"y":-135.5,"cMask":[]},{"x":-50,"y":30,"cMask":[]},{"x":-25,"y":-30,"cMask":[]},{"x":11,"y":30,"cMask":[]},{"x":20,"y":-30,"cMask":[]},{"x":-42.5,"y":30,"cMask":[]},{"x":-17.5,"y":-30,"cMask":[]},{"x":-52,"y":30,"cMask":[]},{"x":-27,"y":-30,"cMask":[]},{"x":-40.5,"y":30,"cMask":[]},{"x":-15.5,"y":-30,"cMask":[]},{"x":-33,"y":30,"cMask":[]},{"x":-8,"y":-30,"cMask":[]},{"x":-31,"y":30,"cMask":[]},{"x":-6,"y":-30,"cMask":[]},{"x":-29,"y":30,"cMask":[]},{"x":-4,"y":-30,"cMask":[]},{"x":-27,"y":30,"cMask":[]},{"x":-2,"y":-30,"cMask":[]},{"x":-25,"y":30,"cMask":[]},{"x":0,"y":-30,"cMask":[]},{"x":5,"y":30,"cMask":[]},{"x":0,"y":-30,"cMask":[]},{"x":3,"y":30,"cMask":[]},{"x":-2,"y":-30,"cMask":[]},{"x":1,"y":30,"cMask":[]},{"x":-4,"y":-30,"cMask":[]},{"x":-1,"y":30,"cMask":[]},{"x":-6,"y":-30,"cMask":[]},{"x":-3,"y":30,"cMask":[]},{"x":-8,"y":-30,"cMask":[]},{"x":-21,"y":19,"cMask":[]},{"x":-5,"y":19,"cMask":[]},{"x":-21,"y":17,"cMask":[]},{"x":-5,"y":17,"cMask":[]},{"x":-21,"y":15,"cMask":[]},{"x":-5,"y":15,"cMask":[]},{"x":-21,"y":13,"cMask":[]},{"x":-5,"y":13,"cMask":[]},{"x":-21,"y":11,"cMask":[]},{"x":-5,"y":11,"cMask":[]},{"x":13,"y":30,"cMask":[]},{"x":22,"y":-30,"cMask":[]},{"x":15,"y":30,"cMask":[]},{"x":24,"y":-30,"cMask":[]},{"x":17,"y":30,"cMask":[]},{"x":26,"y":-30,"cMask":[]},{"x":19,"y":30,"cMask":[]},{"x":28,"y":-30,"cMask":[]},{"x":19,"y":-29,"cMask":[]},{"x":49,"y":-29,"cMask":[]},{"x":19,"y":-27,"cMask":[]},{"x":49,"y":-27,"cMask":[]},{"x":19,"y":-25,"cMask":[]},{"x":49,"y":-25,"cMask":[]},{"x":19,"y":-23,"cMask":[]},{"x":49,"y":-23,"cMask":[]},{"x":19,"y":-21,"cMask":[]},{"x":49,"y":-21,"cMask":[]},{"x":23,"y":-6,"cMask":[]},{"x":42,"y":-6,"cMask":[]},{"x":23,"y":-4,"cMask":[]},{"x":42,"y":-4,"cMask":[]},{"x":23,"y":-2,"cMask":[]},{"x":42,"y":-2,"cMask":[]},{"x":23,"y":0,"cMask":[]},{"x":42,"y":0,"cMask":[]},{"x":23,"y":2,"cMask":[]},{"x":42,"y":2,"cMask":[]},{"x":-52,"y":27,"cMask":[]},{"x":-27,"y":-33,"cMask":[]},{"x":9,"y":27,"cMask":[]},{"x":18,"y":-33,"cMask":[]},{"x":-44.5,"y":27,"cMask":[]},{"x":-19.5,"y":-33,"cMask":[]},{"x":-54,"y":27,"cMask":[]},{"x":-29,"y":-33,"cMask":[]},{"x":-42.5,"y":27,"cMask":[]},{"x":-17.5,"y":-33,"cMask":[]},{"x":-35,"y":27,"cMask":[]},{"x":-10,"y":-33,"cMask":[]},{"x":-33,"y":27,"cMask":[]},{"x":-8,"y":-33,"cMask":[]},{"x":-31,"y":27,"cMask":[]},{"x":-6,"y":-33,"cMask":[]},{"x":-29,"y":27,"cMask":[]},{"x":-4,"y":-33,"cMask":[]},{"x":-27,"y":27,"cMask":[]},{"x":-2,"y":-33,"cMask":[]},{"x":3,"y":27,"cMask":[]},{"x":-2,"y":-33,"cMask":[]},{"x":1,"y":27,"cMask":[]},{"x":-4,"y":-33,"cMask":[]},{"x":-1,"y":27,"cMask":[]},{"x":-6,"y":-33,"cMask":[]},{"x":-3,"y":27,"cMask":[]},{"x":-8,"y":-33,"cMask":[]},{"x":-5,"y":27,"cMask":[]},{"x":-10,"y":-33,"cMask":[]},{"x":-23,"y":16,"cMask":[]},{"x":-7,"y":16,"cMask":[]},{"x":-23,"y":14,"cMask":[]},{"x":-7,"y":14,"cMask":[]},{"x":-23,"y":12,"cMask":[]},{"x":-7,"y":12,"cMask":[]},{"x":-23,"y":10,"cMask":[]},{"x":-7,"y":10,"cMask":[]},{"x":-23,"y":8,"cMask":[]},{"x":-7,"y":8,"cMask":[]},{"x":11,"y":27,"cMask":[]},{"x":20,"y":-33,"cMask":[]},{"x":13,"y":27,"cMask":[]},{"x":22,"y":-33,"cMask":[]},{"x":15,"y":27,"cMask":[]},{"x":24,"y":-33,"cMask":[]},{"x":17,"y":27,"cMask":[]},{"x":26,"y":-33,"cMask":[]},{"x":17,"y":-32,"cMask":[]},{"x":47,"y":-32,"cMask":[]},{"x":17,"y":-30,"cMask":[]},{"x":47,"y":-30,"cMask":[]},{"x":17,"y":-28,"cMask":[]},{"x":47,"y":-28,"cMask":[]},{"x":17,"y":-26,"cMask":[]},{"x":47,"y":-26,"cMask":[]},{"x":17,"y":-24,"cMask":[]},{"x":47,"y":-24,"cMask":[]},{"x":21,"y":-9,"cMask":[]},{"x":40,"y":-9,"cMask":[]},{"x":21,"y":-7,"cMask":[]},{"x":40,"y":-7,"cMask":[]},{"x":21,"y":-5,"cMask":[]},{"x":40,"y":-5,"cMask":[]},{"x":21,"y":-3,"cMask":[]},{"x":40,"y":-3,"cMask":[]},{"x":21,"y":-1,"cMask":[]},{"x":40,"y":-1,"cMask":[]}],"segments":[{"v0":0,"v1":1,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":3,"v1":2,"bias":-10,"bCoef":0.1,"curve":35,"curveF":3.1715948023632126,"cMask":["ball"],"color":"717F98"},{"v0":4,"v1":5,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":6,"v1":7,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":9,"v1":8,"bias":-10,"bCoef":0.1,"curve":35,"curveF":3.1715948023632126,"cMask":["ball"],"color":"717F98"},{"v0":10,"v1":11,"bias":10,"bCoef":0.1,"cMask":["ball"],"color":"717F98"},{"v0":12,"v1":13,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":14,"v1":15,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":16,"v1":17,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":18,"v1":19,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":20,"v1":21,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":22,"v1":23,"bias":10,"cMask":["ball"],"color":"717F98"},{"v0":24,"v1":25,"cMask":[],"color":"3B424F"},{"v0":26,"v1":27,"cMask":[],"color":"3B424F"},{"v0":28,"v1":29,"cMask":[],"color":"161C26"},{"v0":30,"v1":31,"cMask":[],"color":"161C26"},{"v0":33,"v1":32,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":32,"v1":33,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":35,"v1":34,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":34,"v1":35,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":38,"v1":36,"vis":false,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":39,"v1":37,"vis":false,"cMask":["red","blue"],"cGroup":["redKO","blueKO"]},{"v0":37,"v1":36,"curve":180,"curveF":6.123233995736766e-17,"vis":false,"cMask":["red","blue"],"cGroup":["blueKO"]},{"v0":36,"v1":37,"curve":180,"curveF":6.123233995736766e-17,"vis":false,"cMask":["red","blue"],"cGroup":["redKO"]},{"v0":40,"v1":41,"cMask":[],"color":"161C26"},{"v0":42,"v1":43,"cMask":[],"color":"161C26"},{"v0":43,"v1":41,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":41,"v1":43,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":45,"v1":44,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":44,"v1":45,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":47,"v1":46,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":46,"v1":47,"curve":180,"curveF":6.123233995736766e-17,"cMask":[],"color":"161C26"},{"v0":48,"v1":49,"curve":89.99999999999999,"curveF":1.0000000000000002,"cMask":[],"color":"161C26"},{"v0":50,"v1":51,"curve":89.99999999999999,"curveF":1.0000000000000002,"cMask":[],"color":"161C26"},{"v0":52,"v1":53,"cMask":[],"color":"161C26"},{"v0":54,"v1":55,"cMask":[],"color":"161C26"},{"v0":56,"v1":57,"cMask":[],"color":"161C26"},{"v0":58,"v1":59,"cMask":[],"color":"161C26"},{"v0":60,"v1":61,"cMask":[],"color":"161C26"},{"v0":62,"v1":63,"cMask":[],"color":"161C26"},{"v0":64,"v1":65,"cMask":[],"color":"9101D"},{"v0":66,"v1":67,"cMask":[],"color":"9101D"},{"v0":68,"v1":69,"cMask":[],"color":"9101D"},{"v0":70,"v1":71,"cMask":[],"color":"9101D"},{"v0":72,"v1":73,"cMask":[],"color":"9101D"},{"v0":74,"v1":75,"cMask":[],"color":"9101D"},{"v0":76,"v1":77,"cMask":[],"color":"9101D"},{"v0":78,"v1":79,"cMask":[],"color":"9101D"},{"v0":80,"v1":81,"cMask":[],"color":"9101D"},{"v0":82,"v1":83,"cMask":[],"color":"9101D"},{"v0":84,"v1":85,"cMask":[],"color":"9101D"},{"v0":86,"v1":87,"cMask":[],"color":"9101D"},{"v0":88,"v1":89,"cMask":[],"color":"9101D"},{"v0":90,"v1":91,"cMask":[],"color":"9101D"},{"v0":92,"v1":93,"cMask":[],"color":"9101D"},{"v0":94,"v1":95,"cMask":[],"color":"9101D"},{"v0":96,"v1":97,"cMask":[],"color":"9101D"},{"v0":98,"v1":99,"cMask":[],"color":"9101D"},{"v0":100,"v1":101,"cMask":[],"color":"9101D"},{"v0":102,"v1":103,"cMask":[],"color":"9101D"},{"v0":104,"v1":105,"cMask":[],"color":"9101D"},{"v0":106,"v1":107,"cMask":[],"color":"9101D"},{"v0":108,"v1":109,"cMask":[],"color":"9101D"},{"v0":110,"v1":111,"cMask":[],"color":"9101D"},{"v0":112,"v1":113,"cMask":[],"color":"9101D"},{"v0":114,"v1":115,"cMask":[],"color":"9101D"},{"v0":116,"v1":117,"cMask":[],"color":"9101D"},{"v0":118,"v1":119,"cMask":[],"color":"9101D"},{"v0":120,"v1":121,"cMask":[],"color":"9101D"},{"v0":122,"v1":123,"cMask":[],"color":"9101D"},{"v0":124,"v1":125,"cMask":[],"color":"9101D"},{"v0":126,"v1":127,"cMask":[],"color":"9101D"},{"v0":128,"v1":129,"cMask":[],"color":"9101D"},{"v0":130,"v1":131,"cMask":[],"color":"9101D"},{"v0":132,"v1":133,"cMask":[],"color":"333945"},{"v0":134,"v1":135,"cMask":[],"color":"333945"},{"v0":136,"v1":137,"cMask":[],"color":"333945"},{"v0":138,"v1":139,"cMask":[],"color":"333945"},{"v0":140,"v1":141,"cMask":[],"color":"333945"},{"v0":142,"v1":143,"cMask":[],"color":"333945"},{"v0":144,"v1":145,"cMask":[],"color":"333945"},{"v0":146,"v1":147,"cMask":[],"color":"333945"},{"v0":148,"v1":149,"cMask":[],"color":"333945"},{"v0":150,"v1":151,"cMask":[],"color":"333945"},{"v0":152,"v1":153,"cMask":[],"color":"333945"},{"v0":154,"v1":155,"cMask":[],"color":"333945"},{"v0":156,"v1":157,"cMask":[],"color":"333945"},{"v0":158,"v1":159,"cMask":[],"color":"333945"},{"v0":160,"v1":161,"cMask":[],"color":"333945"},{"v0":162,"v1":163,"cMask":[],"color":"333945"},{"v0":164,"v1":165,"cMask":[],"color":"333945"},{"v0":166,"v1":167,"cMask":[],"color":"333945"},{"v0":168,"v1":169,"cMask":[],"color":"333945"},{"v0":170,"v1":171,"cMask":[],"color":"333945"},{"v0":172,"v1":173,"cMask":[],"color":"333945"},{"v0":174,"v1":175,"cMask":[],"color":"333945"},{"v0":176,"v1":177,"cMask":[],"color":"333945"},{"v0":178,"v1":179,"cMask":[],"color":"333945"},{"v0":180,"v1":181,"cMask":[],"color":"333945"},{"v0":182,"v1":183,"cMask":[],"color":"333945"},{"v0":184,"v1":185,"cMask":[],"color":"333945"},{"v0":186,"v1":187,"cMask":[],"color":"333945"},{"v0":188,"v1":189,"cMask":[],"color":"333945"},{"v0":190,"v1":191,"cMask":[],"color":"333945"},{"v0":192,"v1":193,"cMask":[],"color":"333945"},{"v0":194,"v1":195,"cMask":[],"color":"333945"},{"v0":196,"v1":197,"cMask":[],"color":"333945"},{"v0":198,"v1":199,"cMask":[],"color":"333945"}],"planes":[{"normal":[0,1],"dist":-375},{"normal":[0,-1],"dist":-375},{"normal":[1,0],"dist":-860},{"normal":[-1,0],"dist":-810},{"normal":[-1,0],"dist":-375,"bCoef":0,"cMask":["c1"]},{"normal":[1,0],"dist":-375,"bCoef":0,"cMask":["c0"]}],"goals":[{"p0":[-758.3,-90],"p1":[-758.3,90],"team":"red"},{"p0":[758.3,90],"p1":[758.3,-90],"team":"blue"}],"discs":[{"radius":5.8,"bCoef":0.412,"invMass":1.5,"color":"FFA500","cGroup":["ball","kick","score"]},{"pos":[-750,90],"radius":5.4,"invMass":0,"color":"3B424F"},{"pos":[-750,-95],"radius":5.4,"invMass":0,"color":"3B424F"},{"pos":[750,90],"radius":5.4,"invMass":0,"color":"3B424F"},{"pos":[750,-95],"radius":5.4,"invMass":0,"color":"3B424F"}],"playerPhysics":{"bCoef":0,"acceleration":0.11,"kickingAcceleration":0.083,"kickStrength":4.545},"ballPhysics":"disc0","spawnDistance":366.5}',

  // Agrega más si es necesario
};

let mapaActual = null;

function sistemaSecundario() {
  const jugadores = room.getPlayerList();
  const rojos = jugadores.filter(p => p.team === 1);
  const azules = jugadores.filter(p => p.team === 2);
  const totalEquipos = rojos.length + azules.length;

  // CASO 1: Si no hay jugadores en equipos y hay espectadores
  if (totalEquipos === 0 && jugadores.length > 0) {
    // Pasar el primer espectador a rojo
    const espectadores = jugadores.filter(p => p.team === 0);
    if (espectadores.length > 0) {
      room.setPlayerTeam(espectadores[0].id, 1);
      // Volver a llamar después de mover
      setTimeout(sistemaSecundario, 100);
      return;
    }
  }

  // CASO 2: Si hay jugadores pero están desbalanceados (ej: 1v0)
  if (rojos.length === 0 || azules.length === 0) {
    const equipoConJugadores = rojos.length > 0 ? rojos : azules;
    if (equipoConJugadores.length === 1) {
      // Solo un jugador, mapa práctica
      cambiarMapa('practica');
      return;
    }
  }

  // CASO 3: Límite 4 por equipo
  const limite = 4;
  
  // Sacar al ÚLTIMO de la fila (los más recientes) si hay más de 4
  if (rojos.length > limite) {
    const excedentes = rojos.slice(-(rojos.length - limite)); // Últimos sobrantes
    excedentes.forEach(jugador => {
      room.setPlayerTeam(jugador.id, 0);
    });
  }
  
  if (azules.length > limite) {
    const excedentes = azules.slice(-(azules.length - limite)); // Últimos sobrantes
    excedentes.forEach(jugador => {
      room.setPlayerTeam(jugador.id, 0);
    });
  }

  // Recontar después de ajustar límites
  const rojosAjust = jugadores.filter(p => p.team === 1).length;
  const azulesAjust = jugadores.filter(p => p.team === 2).length;
  const diferencia = Math.abs(rojosAjust - azulesAjust);

  // Balancear solo si hay diferencia mayor a 0
  if (diferencia > 0) {
    const equipoExceso = rojosAjust > azulesAjust ? 
      jugadores.filter(p => p.team === 1) : 
      jugadores.filter(p => p.team === 2);
    
    // Sacar a los ÚLTIMOS del equipo con exceso
    const sobrantes = equipoExceso.slice(-diferencia);
    sobrantes.forEach(jugador => {
      room.setPlayerTeam(jugador.id, 0);
    });
  }

  // Determinar mapa después de todos los ajustes
  const rojosFinal = jugadores.filter(p => p.team === 1).length;
  const azulesFinal = jugadores.filter(p => p.team === 2).length;
  const totalFinal = rojosFinal + azulesFinal;
  const minimo = Math.min(rojosFinal, azulesFinal);

  let mapaElegido;
  if (totalFinal === 0 || totalFinal === 1) {
    mapaElegido = 'practica';
  } else if (minimo <= 2) {
    mapaElegido = '1v1';
  } else if (minimo === 3) {
    mapaElegido = '3v3';
  } else {
    mapaElegido = '4v4';
  }

  // Cambiar mapa
  cambiarMapa(mapaElegido);
}

function cambiarMapa(nombreMapa) {
  if (nombreMapa !== mapaActual && MAPAS[nombreMapa]) {
    room.setCustomStadium(MAPAS[nombreMapa]);
    mapaActual = nombreMapa;
    if (room.stopGame) room.stopGame();
    if (room.startGame) room.startGame();
  }
}




// ████████╗██╗░░░██╗░██████╗██╗███╗░░██╗██╗
// ╚══██╔══╝██║░░░██║██╔════╝██║████╗░██║██║
// ░░░██║░░░██║░░░██║╚█████╗░██║██╔██╗██║██║
// ░░░██║░░░██║░░░██║░╚═══██╗██║██║╚████║██║
// ░░░██║░░░╚██████╔╝██████╔╝██║██║░╚███║███████╗
// ░░░╚═╝░░░░╚═════╝░╚═════╝░╚═╝╚═╝░░╚══╝╚══════╝
// SISTEMA DE ROLES TUSINI EDITION v3.0

const ROLES_CONFIG = {
    "Hijueputini": { 
        winsRequired: 0, 
        color: getRandomColor(),
        chatColor: getRandomColor().toString(16),
        symbol: "🦛", 
        tag: "🦛 ʜɪᴊᴜᴇᴘᴜᴛɪɴɪ", 
        description: "ʜɪᴊᴜᴇᴘᴜᴛɪɴɪ ᴍᴀʟᴘᴀʀɪᴅᴏ ᴍᴜɪᴛᴏ",
        permissions: {
            admin: false,
            chatSpecial: false
        }
    },
    "Moso": { 
        winsRequired: 10, 
        color: getRandomColor(),
        chatColor: getRandomColor().toString(16),
        symbol: "💁‍♂️", 
        tag: "💁‍♂️ ᴍᴏsᴏ", 
        description: "ᴇʟ ᴍᴏꜱᴏ ꜰᴀᴠᴏʀɪᴛᴏ ᴅᴇ ʟᴀ ᴇᴘᴀ",
        permissions: {
            admin: false,
            chatSpecial: false
        }
    },
    "Migajero": { 
        winsRequired: 25, 
        color: getRandomColor(),
        chatColor: getRandomColor().toString(16),
        symbol: "🍞", 
        tag: "🍞 ᴍɪɢᴀᴊᴇʀᴏ", 
        description: "ᴇʟ ᴘʀᴏᴘɪᴏ ᴀʟᴇ",
        permissions: {
            admin: false,
            chatSpecial: false
        }
    },
    "Cachon": { 
        winsRequired: 40, 
        color: getRandomColor(),
        chatColor: getRandomColor().toString(16),
        symbol: "🦌", 
        tag: "🦌 ᴄᴀᴄʜᴏ́ɴ", 
        description: "ᴄᴀᴄʜᴏɴ ɴɪ ʟᴀ ᴠᴀʟᴇʀʏ",
        permissions: {
            admin: false,
            chatSpecial: true
        }
    },
    "Yina Calderon": { 
        winsRequired: 60, 
        color: getRandomColor(),
        chatColor: getRandomColor().toString(16),
        symbol: "🧌", 
        tag: "🧌 ʏɪɴᴀ ᴄᴀʟᴅᴇʀᴏ́ɴ", 
        description: "ᴍᴀʟᴜᴄᴀ",
        permissions: {
            admin: false,
            chatSpecial: true
        }
    },
    "Burrito Caremonda": { 
        winsRequired: 80, 
        color: getRandomColor(),
        chatColor: getRandomColor().toString(16),
        symbol: "🫏", 
        tag: "🫏 ʙᴜʀʀɪᴛᴏ ᴄᴀʀᴇᴍᴏɴᴅᴀ", 
        description: "ʙᴜʀʀɪᴛᴏ ᴄᴀʀᴇᴍᴏɴᴅᴀ sᴇɴᴛᴀᴅᴏ ᴄᴏɴ sᴜ ᴄᴀᴍɪsᴀ ʙᴀᴄᴀɴᴀ ᴅᴇʟ ᴊᴜɴɪᴏʀ ᴅᴇ ʙᴀʀʀᴀɴǫᴜɪʟʟᴀ",
        permissions: {
            admin: false,
            chatSpecial: true
        }
    },
    "Epa Colombia": { 
        winsRequired: 100, 
        color: getRandomColor(),
        chatColor: getRandomColor().toString(16),
        symbol: "🫓", 
        tag: "🫓 ᴇᴘᴀ ᴄᴏʟᴏᴍʙɪᴀ", 
        description: "ᴀʀᴇᴘᴇʀᴀ",
        permissions: {
            admin: false,
            chatSpecial: true
        }
    },
    "Uribe": { 
        winsRequired: 150, 
        color: getRandomColor(),
        chatColor: getRandomColor().toString(16),
        symbol: "👔", 
        tag: "👔 ᴜʀɪʙᴇ", 
        description: " ᴇxᴘʀᴇsɪᴅᴇɴᴛᴇ ",
        permissions: {
            admin: false,
            chatSpecial: true
        }
    },
    "Admin": { 
        winsRequired: -999999999999, 
        color: 0xFF5555,
        chatColor: "#FF5555",
        symbol: "👑", 
        tag: "👑 ᴀᴅᴍɪɴ", 
        description: "ᴀᴅᴍɪɴɪsᴛʀᴀᴅᴏʀ ᴅᴇ ʟᴀ sᴀʟᴀ",
        permissions: {
            admin: true,
            chatSpecial: true
        }
    }
};

// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃      SISTEMA DE ROLES COMPLETO v3.0   ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
const roleSystem = {
    
resetStats: function(player, targetName) {
    if (!player.admin) {
        enviarMensajePrivado(player.id, "❌ sᴏʟᴏ ʟᴏs ᴀᴅᴍɪɴs ᴘᴜᴇᴅᴇɴ ʀᴇsᴇᴛᴇᴀʀ ᴇsᴛᴀᴅɪ́sᴛɪᴄᴀs", 0xFF5555);
        return false;
    }

    let targetPlayer;
    
    if (targetName) {
        targetPlayer = encontrarJugadorPorNombre(targetName);
        if (!targetPlayer) {
            enviarMensajePrivado(player.id, "❌ ᴊᴜɢᴀᴅᴏʀ ɴᴏ ᴇɴᴄᴏɴᴛʀᴀᴅᴏ", 0xFF5555);
            return false;
        }
    } else {
        targetPlayer = player;
    }

    // Resetear estadísticas
    playerStats[targetPlayer.id] = {
        wins: 0,
        goals: 0,
        assists: 0,
        cs: 0,
        lastKnownName: targetPlayer.name
    };

    // Actualizar rol
    roleSystem.updatePlayerNameWithRole(targetPlayer);

    enviarMensajeGlobal(
        `🔄 @${player.name} ʀᴇsᴇᴛᴇᴏ́ ʟᴀs ᴇsᴛᴀᴅɪ́sᴛɪᴄᴀs ᴅᴇ @${targetPlayer.name}`,
        getRandomColor()
    );

    return true;
},

updatePlayerNameWithRole: function(player) {
    if (!player || !player.id || !state.rolesEnabled) return;
    
    try {
        const stats = playerStats[player.id] || { wins: 0, losses: 0 };
        let currentRole = this.getCurrentRole(stats.wins);
        
        if (deadPlayers.has(player.id)) {
            currentRole = "Muerto";
        }
        
        const roleConfig = ROLES_CONFIG[currentRole] || ROLES_CONFIG["Hijueputini"];
        const nameWithoutTags = player.name.replace(
            new RegExp(`\\s*(${Object.values(ROLES_CONFIG).map(r => r.tag).join('|')})\\s*$`), 
            ''
        ).trim();
        
        const newName = `${nameWithoutTags} ${roleConfig.tag}`.trim();
        
        if (player.name !== newName) {
            room.setPlayerDiscProperties(player.id, { name: newName });
        }
    } catch (e) {
        console.error("Error actualizando nombre:", e);
        // Desactivar temporalmente el sistema de roles
        state.rolesEnabled = false;
        setTimeout(() => { state.rolesEnabled = true; }, 30000);
    }
},

    // Función mejorada para obtener rol actual
    getCurrentRole: function(wins) {
        let currentRole = "Tusini Tusinelli";
        let highestWins = -Infinity;

        for (const [role, config] of Object.entries(ROLES_CONFIG)) {
            if (wins >= config.winsRequired && config.winsRequired > highestWins) {
                currentRole = role;
                highestWins = config.winsRequired;
            }
        }
        return currentRole;
    },

    // Función para obtener color del rol (mejorado)
    getRoleColor: function(wins) {
        const currentRole = this.getCurrentRole(wins);
        return ROLES_CONFIG[currentRole]?.color || 0xAAAAAA;
    },

    // Función para obtener tag del rol (con formato mejorado)
    getRoleTag: function(wins) {
        const currentRole = this.getCurrentRole(wins);
        return ROLES_CONFIG[currentRole]?.tag || "🐽 Tusini Tusinelli";
    },

    // Función mejorada para actualizar nombre con rol
    updatePlayerNameWithRole: function(player) {
        if (!player || !player.id) return;

        const stats = playerStats[player.id] || { wins: 0, losses: 0 };
        let currentRole = this.getCurrentRole(stats.wins);

        // Aplicar rol de muerto si corresponde
        if (deadPlayers.has(player.id)) {
            currentRole = "Muerto";
        }

        const roleConfig = ROLES_CONFIG[currentRole] || ROLES_CONFIG["Tusini Tusinelli"];
        
        // Limpiar nombre de tags antiguos
        const nameWithoutTags = player.name.replace(
            new RegExp(`\\s*(${Object.values(ROLES_CONFIG).map(r => r.tag).join('|')})\\s*$`), 
            ''
        ).trim();

        const newName = `${nameWithoutTags} ${roleConfig.tag}`.trim();

        if (player.name !== newName) {
            try {
                room.setPlayerDiscProperties(player.id, { name: newName });
            } catch (e) {
                console.error("Error updating player name:", e);
            }
        }
    },

    // Función para calcular índice W/L
    calculateWLIndex: function(playerId) {
        const stats = playerStats[playerId] || { wins: 0, losses: 0 };
        return stats.wins - stats.losses;
    },

    // Función para calcular porcentaje de victorias
    calculateWinRate: function(playerId) {
        const stats = playerStats[playerId] || { wins: 0, losses: 0 };
        const totalGames = stats.wins + stats.losses;
        return totalGames > 0 ? Math.round((stats.wins / totalGames) * 100) : 0;
    },

    // Función mejorada para añadir victoria
    addWin: function(playerId) {
        const player = room.getPlayer(playerId);
        if (!player || player.team === 0 || !playersInGame.has(playerId)) return false;

        if (!playerStats[playerId]) {
            playerStats[playerId] = { wins: 0, losses: 0 };
        }

        const oldWins = playerStats[playerId].wins;
        const oldRole = this.getCurrentRole(oldWins);

        playerStats[playerId].wins++;

        const newWins = playerStats[playerId].wins;
        const newRole = this.getCurrentRole(newWins);
        const wlIndex = this.calculateWLIndex(playerId);

        // Mensaje de ascenso mejorado
        if (oldRole !== newRole) {
            const roleConfig = ROLES_CONFIG[newRole];
            room.sendAnnouncement(
                `✨✨✨✨✨✨✨✨✨✨✨✨\n` +
                `🎉 ¡${player.name} ASCENDIÓ A ${newRole.toUpperCase()}! 🎉\n` +
                `📜 ${roleConfig.description}\n` +
                `✨✨✨✨✨✨✨✨✨✨✨✨`,
                null, roleConfig.color, "bold", 2
            );
        }

        room.sendAnnouncement(
            `✅ ¡Victoria registrada para ${player.name}!\n` +
            `🏆 Récord: ${playerStats[playerId].wins}W - ${playerStats[playerId].losses}L\n` +
            `📊 Índice W/L: ${wlIndex} (${this.calculateWinRate(playerId)}% de victorias)`,
            null, 0x4CAF50, "bold"
        );

        this.updatePlayerNameWithRole(player);
        guardarEstadisticas();
        return true;
    },

    // Función mejorada para añadir derrota
    addLoss: function(playerId) {
        const player = room.getPlayer(playerId);
        if (!player || player.team === 0 || !playersInGame.has(playerId)) return false;

        if (!playerStats[playerId]) {
            playerStats[playerId] = { wins: 0, losses: 0 };
        }

        const oldWins = playerStats[playerId].wins;
        const oldRole = this.getCurrentRole(oldWins);

        playerStats[playerId].losses++;

        const newWins = playerStats[playerId].wins;
        const newRole = this.getCurrentRole(newWins);
        const wlIndex = this.calculateWLIndex(playerId);

        // Mensaje de descenso mejorado
        if (oldRole !== newRole) {
            room.sendAnnouncement(
                `⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡\n` +
                `🚨 ¡${player.name} DESCENDIÓ A ${newRole.toUpperCase()}! 🚨\n` +
                `📉 ${ROLES_CONFIG[newRole].description}\n` +
                `⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡⚡`,
                null, 0xFF5252, "bold", 2
            );
        }

        // Mensaje especial por muchas derrotas
        if (wlIndex === -100) {
            room.sendAnnouncement(
                `💀💀💀💀💀💀💀💀💀💀💀💀\n` +
                `🚨 ¡${player.name} HA ALCANZADO -100 EN ÍNDICE W/L! 🚨\n` +
                `💀💀💀💀💀💀💀💀💀💀💀💀`,
                null, 0xFF0000, "bold", 2
            );
        }

        room.sendAnnouncement(
            `❌ Derrota registrada para ${player.name}\n` +
            `🏆 Récord: ${playerStats[playerId].wins}W - ${playerStats[playerId].losses}L\n` +
            `📊 Índice W/L: ${wlIndex} (${this.calculateWinRate(playerId)}% de victorias)`,
            null, 0xFF5252, "bold"
        );

        this.updatePlayerNameWithRole(player);
        guardarEstadisticas();
        return true;
    },

    // Función mejorada para mostrar top jugadores
    showTopPlayers: function(playerId = null) {
        try {
            const uniquePlayers = {};
            const topPlayers = Object.entries(playerStats)
                .map(([id, stats]) => {
                    if (uniquePlayers[id]) return null;
                    uniquePlayers[id] = true;
                    
                    const player = room.getPlayer(parseInt(id));
                    return {
                        id: id,
                        name: player ? player.name : (stats.lastKnownName || "Jugador desconocido"),
                        wins: stats.wins || 0,
                        losses: stats.losses || 0,
                        wlIndex: (stats.wins || 0) - (stats.losses || 0),
                        winRate: this.calculateWinRate(parseInt(id))
                    };
                })
                .filter(p => p !== null && (p.wins + p.losses) > 0)
                .sort((a, b) => b.wlIndex - a.wlIndex)
                .slice(0, 5);

            if (topPlayers.length === 0) {
                const msg = "📊 No hay suficientes datos para mostrar el top";
                playerId ? room.sendAnnouncement(msg, playerId, 0x42A5FF) : room.sendAnnouncement(msg, null, 0x42A5FF);
                return;
            }

            let message = "🏆 𝗧𝗢𝗣 𝟱 𝗝𝗨𝗚𝗔𝗗𝗢𝗥𝗘𝗦 (por Índice W/L)\n";
            message += "══════════════════════════\n";

            topPlayers.forEach((p, index) => {
                const role = this.getCurrentRole(p.wins);
                const roleConfig = ROLES_CONFIG[role];
                message += `🏅 ${index + 1}. ${p.name} ${roleConfig.symbol}\n`;
                message += `   📈 ${p.wins}W - ${p.losses}L (${p.wlIndex}) | WR: ${p.winRate}%\n`;
                message += `   🎖️ ${role}\n`;
                message += "──────────────────────────\n";
            });

            if (playerId) {
                room.sendAnnouncement(message, playerId, 0x42A5FF, "bold", 2);
            } else {
                room.sendAnnouncement(message, null, 0x42A5FF, "bold", 2);
            }

        } catch (error) {
            console.error("Error en showTopPlayers:", error);
            const errorMsg = "⚠️ Error al generar el top. Intenta nuevamente.";
            playerId ? room.sendAnnouncement(errorMsg, playerId, 0xFF0000) : room.sendAnnouncement(errorMsg, null, 0xFF0000);
        }
    },

    // Función mejorada para mostrar estadísticas
    showAllStats: function(playerId) {
        const stats = playerStats[playerId] || { wins: 0, losses: 0, goals: 0, assists: 0, cs: 0 };
        const player = room.getPlayer(playerId);
        const role = this.getCurrentRole(stats.wins);
        const roleConfig = ROLES_CONFIG[role];
        
        const winRate = this.calculateWinRate(playerId);
        const wlIndex = this.calculateWLIndex(playerId);

        const message = `
╔══════════════════════╗
║    📊 𝗘𝗦𝗧𝗔𝗗𝗜𝗦𝗧𝗜𝗖𝗔𝗦    ║
╠══════════════════════╣
║ 🎮 ${player.name}
║ 🏅 ${roleConfig.symbol} ${role}
╠══════════════════════╣
║ 🏆 ${stats.wins}W ${stats.losses}L
║ 📈 Índice W/L: ${wlIndex}
║ 📊 Win Rate: ${winRate}%
╠══════════════════════╣
║ ⚽ Goles: ${stats.goals}
║ 🎯 Asistencias: ${stats.assists}
║ 🧤 Clean Sheets: ${stats.cs}
╚══════════════════════╝
        `;

        room.sendAnnouncement(message, playerId, roleConfig.color, "bold", 2);
    },

    // Nueva función para manejar mensajes de chat con estilos según rol
    handleChatMessage: function(playerId, message) {
        const player = room.getPlayer(playerId);
        if (!player) return;

        const stats = playerStats[playerId] || { wins: 0 };
        const role = this.getCurrentRole(stats.wins);
        const roleConfig = ROLES_CONFIG[role];
        
        // Formatear mensaje según privilegios
        let formattedMessage = message;
        if (roleConfig.permissions.chatSpecial) {
            formattedMessage = `✨ ${message} ✨`;
        }

        // Enviar mensaje con estilo según rol
        room.sendAnnouncement(
            `${player.name}: ${formattedMessage}`,
            null,
            roleConfig.chatColor,
            "bold",
            0
        );
        
        return false; // Previene el mensaje original
    }
};

// Función para inicializar el sistema de roles
function initRoleSystem() {
    // Asegurarse que todos los jugadores tengan sus roles actualizados
    room.getPlayerList().forEach(player => {
        roleSystem.updatePlayerNameWithRole(player);
    });
    
    console.log("✅ Sistema de Roles Tusini v3.0 cargado correctamente");
}

















































// FUNCIONES ESPECIALES

// Colores mejorados para evitar avatares oscuros
const UNIFORMES_EQUIPOS = [
    {
        nombre: "JUNIOR",
        colores: "FF0000 FFFFFF FF0000", // Rojo con blanco
        equipo: "red"
    },
    {
        nombre: "NACIONAL", 
        colores: "008000 FFFFFF 008000", // Verde con blanco
        equipo: "blue"
    },
    {
        nombre: "MILLONARIOS",
        colores: "0000FF FFFFFF 0000FF", // Azul con blanco
        equipo: "red"
    },
    {
        nombre: "AMÉRICA",
        colores: "FF0000 FFFFFF FF0000", // Rojo con blanco
        equipo: "blue"
    },
    {
        nombre: "REAL MADRID",
        colores: "FFFFFF 000000 FFFFFF", // Blanco
        equipo: "red"
    },
    {
        nombre: "BARCELONA", 
        colores: "0000FF FF0000 0000FF", // Azul y rojo
        equipo: "blue"
    }
];
// ======================
// SISTEMA DE PICK MEJORADO Y AUTOMATIZADO
// ======================

let sistemaPick = {
    activo: false,
    fase: 'inactivo',
    capitanRed: null,
    capitanBlue: null,
    jugadoresDisponibles: [],
    equipoRed: [],
    equipoBlue: [],
    pickActual: 0,
    timeoutPick: null,
    uniformes: {
        red: null,
        blue: null
    }
};

// Función para determinar modalidad según jugadores
function determinarModalidad() {
    const jugadoresTotales = room.getPlayerList().filter(p => p.id !== 0 && !jugadoresAFK.has(p.id)).length;
    const jugadoresEnBanca = room.getPlayerList().filter(p => p.team === 0 && p.id !== 0 && !jugadoresAFK.has(p.id)).length;
    
    if (jugadoresTotales >= 8) return 4; // 4v4
    if (jugadoresTotales >= 6) return 3; // 3v3  
    if (jugadoresTotales >= 4) return 2; // 2v2
    return 1; // 1v1
}

// Función para generar orden de pick según modalidad
function generarOrdenPick(modalidad) {
    const picksNecesarios = (modalidad * 2) - 2; // -2 porque ya hay capitanes
    
    let orden = [];
    for (let i = 0; i < picksNecesarios; i++) {
        if (i % 2 === 0) {
            orden.push('blue'); // Blue pickea primero para balancear
        } else {
            orden.push('red');
        }
    }
    return orden;
}

// Función mejorada para verificar y activar pick
function verificarYActivarPick() {
    if (sistemaPick.activo) return;
    
    const jugadores = room.getPlayerList().filter(p => p.id !== 0 && !jugadoresAFK.has(p.id));
    const redCount = jugadores.filter(p => p.team === 1).length;
    const blueCount = jugadores.filter(p => p.team === 2).length;
    const specCount = jugadores.filter(p => p.team === 0).length;
    
    // Balance automático: si hay desbalance >1, mover de banca
    if (Math.abs(redCount - blueCount) > 1 && specCount > 0) {
        const equipoNecesitado = redCount < blueCount ? 1 : 2;
        const jugadorBalance = jugadores.find(p => p.team === 0);
        if (jugadorBalance) {
            room.setPlayerTeam(jugadorBalance.id, equipoNecesitado);
            enviarMensajeGlobal(`⚖️ @${jugadorBalance.name} movido para balance`, getRandomColor());
        }
    }
    
    // Activar pick si hay suficientes jugadores en banca
    const modalidad = determinarModalidad();
    const picksNecesarios = (modalidad * 2) - 2;
    
    if (specCount >= 2 && jugadores.length >= (modalidad * 2)) {
        if (room.getScores() !== null) {
            room.stopGame();
        }
        
        setTimeout(() => {
            iniciarSistemaPickAutomatico(modalidad);
        }, 1000);
    }
}

// Función mejorada para iniciar pick
function iniciarSistemaPickAutomatico(modalidad) {
    const jugadoresActivos = room.getPlayerList().filter(p => p.id !== 0 && !jugadoresAFK.has(p.id));
    const jugadoresEnBanca = jugadoresActivos.filter(p => p.team === 0);
    
    if (jugadoresEnBanca.length < 2) return;

    // Limpiar estado anterior
    sistemaPick.activo = true;
    sistemaPick.fase = 'pickEnCurso';
    sistemaPick.jugadoresDisponibles = [];
    sistemaPick.equipoRed = [];
    sistemaPick.equipoBlue = [];
    sistemaPick.pickActual = 0;

    // Seleccionar capitanes por joinOrder
    const jugadoresOrdenados = jugadoresEnBanca.sort((a, b) => a.joinOrder - b.joinOrder);
    sistemaPick.capitanRed = jugadoresOrdenados[0];
    sistemaPick.capitanBlue = jugadoresOrdenados[1];

    // Mover capitanes
    room.setPlayerTeam(sistemaPick.capitanRed.id, 1);
    room.setPlayerTeam(sistemaPick.capitanBlue.id, 2);

    // Jugadores disponibles
    sistemaPick.jugadoresDisponibles = jugadoresOrdenados.slice(2);

    sistemaPick.equipoRed = [sistemaPick.capitanRed];
    sistemaPick.equipoBlue = [sistemaPick.capitanBlue];
    
    // Generar orden de pick según modalidad
    sistemaPick.ordenPick = generarOrdenPick(modalidad);
    
    // Aplicar uniformes
    aplicarUniformesAleatorios();

    enviarMensajeGlobal(
        `🎯 **PICK ${modalidad}v${modalidad}**\n` +
        `👑 @${sistemaPick.capitanRed.name} vs @${sistemaPick.capitanBlue.name}`,
        getRandomColor()
    );

    setTimeout(() => {
        siguientePickAutomatico();
    }, 1000);
}

// Función mejorada para siguiente pick
function siguientePickAutomatico() {
    if (!sistemaPick.activo || sistemaPick.pickActual >= sistemaPick.ordenPick.length) {
        finalizarPickAutomatico();
        return;
    }

    if (sistemaPick.jugadoresDisponibles.length === 0) {
        finalizarPickAutomatico();
        return;
    }

    const equipoActual = sistemaPick.ordenPick[sistemaPick.pickActual];
    const capitan = equipoActual === 'red' ? sistemaPick.capitanRed : sistemaPick.capitanBlue;
    
    // Verificar capitán conectado
    if (!room.getPlayer(capitan.id)) {
        const jugadorAuto = sistemaPick.jugadoresDisponibles[0];
        realizarPickAutomatico(jugadorAuto.id, equipoActual, true);
        return;
    }

    // Mensaje solo al capitán
    const listaJugadores = sistemaPick.jugadoresDisponibles.map((jug, index) => 
        `${index + 1}. ${jug.name}`
    ).join('\n');

    enviarMensajePrivado(capitan.id,
        `🎯 **ELIGE**\n${listaJugadores}`,
        getRandomColor()
    );

    sistemaPick.fase = 'esperandoPick';
    
    // Timeout reducido a 8 segundos
    sistemaPick.timeoutPick = setTimeout(() => {
        if (sistemaPick.fase === 'esperandoPick') {
            const jugadorAuto = sistemaPick.jugadoresDisponibles[0];
            realizarPickAutomatico(jugadorAuto.id, equipoActual, true);
        }
    }, 8000);
}

// Función para realizar pick
function realizarPickAutomatico(jugadorId, equipo, esAutomatico = false) {
    const jugador = sistemaPick.jugadoresDisponibles.find(j => j.id === jugadorId);
    if (!jugador) return;

    sistemaPick.jugadoresDisponibles = sistemaPick.jugadoresDisponibles.filter(j => j.id !== jugadorId);
    
    if (equipo === 'red') {
        sistemaPick.equipoRed.push(jugador);
        room.setPlayerTeam(jugadorId, 1);
    } else {
        sistemaPick.equipoBlue.push(jugador);
        room.setPlayerTeam(jugadorId, 2);
    }

    const capitan = equipo === 'red' ? sistemaPick.capitanRed : sistemaPick.capitanBlue;
    
    if (esAutomatico) {
        enviarMensajeGlobal(`⏰ @${capitan.name} - @${jugador.name} auto`, 0xFFB74D);
    } else {
        enviarMensajeGlobal(`✅ @${capitan.name} → @${jugador.name}`, getRandomColor());
    }

    sistemaPick.pickActual++;
    sistemaPick.fase = 'pickEnCurso';
    
    clearTimeout(sistemaPick.timeoutPick);
    
    if (sistemaPick.pickActual < sistemaPick.ordenPick.length && sistemaPick.jugadoresDisponibles.length > 0) {
        setTimeout(() => {
            siguientePickAutomatico();
        }, 500); // Reducido a 0.5s
    } else {
        finalizarPickAutomatico();
    }
}

function finalizarPickAutomatico() {
    sistemaPick.activo = false;
    sistemaPick.fase = 'inactivo'
    
    enviarMensajeGlobal(`🏁 Pick finalizado - Iniciando...`, getRandomColor());

    setTimeout(() => {
        if (room.getScores() === null) {
            room.startGame();
        }
    }, 1000);
}


// ======================
// SISTEMA DE UNIFORMES CORREGIDO
// ======================

function aplicarUniformesAleatorios() {
    const uniformesRed = UNIFORMES_EQUIPOS.filter(u => u.equipo === "red");
    const uniformesBlue = UNIFORMES_EQUIPOS.filter(u => u.equipo === "blue");
    
    sistemaPick.uniformes.red = uniformesRed[Math.floor(Math.random() * uniformesRed.length)];
    sistemaPick.uniformes.blue = uniformesBlue[Math.floor(Math.random() * uniformesBlue.length)];
    
    // Aplicar colores correctamente
    try {
        const coloresRed = sistemaPick.uniformes.red.colores.split(' ');
        const coloresBlue = sistemaPick.uniformes.blue.colores.split(' ');
        
        room.setTeamColors(1, 
            parseInt(coloresRed[0], 16),
            parseInt(coloresRed[1], 16), 
            parseInt(coloresRed[2], 16)
        );
        
        room.setTeamColors(2,
            parseInt(coloresBlue[0], 16),
            parseInt(coloresBlue[1], 16),
            parseInt(coloresBlue[2], 16)
        );
    } catch (error) {
        console.error("Error en uniformes:", error);
    }
}


// Función para obtener color aleatorio de paleta oscura armónica
function getRandomColor() {
    const darkColors = [
        0x8B4513, // SaddleBrown - marrón oscuro cálido
        0x2F4F4F, // DarkSlateGray - gris pizarra oscuro
        0x800080, // Purple - púrpura oscuro
        0x483D8B, // DarkSlateBlue - azul pizarra oscuro
        0x556B2F, // DarkOliveGreen - verde oliva oscuro
        0x8B008B, // DarkMagenta - magenta oscuro
        0x9932CC, // DarkOrchid - orquídea oscura
        0x8B0000, // DarkRed - rojo oscuro
        0x4B0082, // Indigo - índigo
        0x2E8B57, // SeaGreen - verde mar oscuro
        0x696969, // DimGray - gris oscuro
        0x778899, // LightSlateGray - gris pizarra claro
        0x5F9EA0, // CadetBlue - azul cadete
        0x8FBC8F, // DarkSeaGreen - verde mar oscuro
        0xB8860B, // DarkGoldenrod - oro oscuro
        0xCD5C5C, // IndianRed - rojo indio
        0xDA70D6, // Orchid - orquídea
        0xBA55D3, // MediumOrchid - orquídea media
        0x9370DB, // MediumPurple - púrpura medio
        0x6A5ACD  // SlateBlue - azul pizarra
    ];
    return darkColors[Math.floor(Math.random() * darkColors.length)];
}























// ======================
// MANEJADORES DE COMANDOS
// ======================
const commandHandlers = {
"!comandos": (player) => {
  const mensaje = 
      "╔══════════════════════════════════╗\n" +
      "       🎮 ＣＯＭＡＮＤＯＳ 🎮       \n" +
      "╠══════════════════════════════════╣\n" +
      "⚽ !size • !indice • !dado • !votekick • !bb • !afk • !azar • !insulto • !troll • !rcm • !firma\n" +
      "🎭 !frase • !discord • !admin • !ruleta [1-10] • !chiste • !ship • !horoscopo [signo]\n" +
      "🔮 !8ball [pregunta] • !doxxeo [@jugador] • !doxxeame • !his • !contar • !lag • !ki • !atki • !silent • !dado20 • !clima\n" +
      "🫣 !twerk • !fuck • !simio • !kiss • !hug • !banana • !kill\n" +
      "🛠️ !mapa [practice/x2/x4] • !rr • !swap • !fill • !mute @jugador minutos • !rstats @jug • !clearbans\n" +
      "📊 !stats • !allstats [@jugador] • !top • !roles • !ms • !votar [pregunta] • !si • !no\n" +
      "💰 !apostar [red/blue] • !simular • !celebracion\n" +
      "🤫 !anonimo [mensaje] • !trivia • !a • !b • !c • !aceptar • !cancelar\n" +
      "╚══════════════════════════════════╝";

  enviarMensajePrivado(player.id, mensaje, getRandomColor());
  return false;
},

"!banana": (player) => {
  const sizes = [0.5, 0.8, ...Array.from({length: 27}, (_, i) => i + 1), 16.5, 27.5];
  const size = sizes[Math.floor(Math.random() * sizes.length)];

  enviarMensajeGlobal(
      `🍌 **ɪɴꜰᴏʀᴍᴇ ʙɪᴏᴍéᴛʀɪᴄᴏ**\n` +
      `👤 ᴜsᴜᴀʀɪᴏ: @${player.name} • 📐 ᴍᴇᴅɪᴄɪóɴ: ${size.toFixed(1)} ᴄᴍ\n` +
      `🔍 ᴍéᴛᴏᴅᴏ: ᴇsᴄáɴᴇʀ ʟásᴇʀ ᴄᴇʀᴛɪꜰɪᴄᴀᴅᴏ (ɪsᴏ 6969)\n` +
      `💡 ɴᴏᴛᴀ: "${size < 10 ? "¿ᴇʀᴇs ᴍᴜᴊᴇʀ?" : size > 20 ? "¡ɪɴʜᴀʙɪʟɪᴛᴀᴅᴏ ᴘᴏʀ ᴠᴇɴᴛᴀᴊᴀ!" : "¡ʟᴏ ʙᴜsᴄᴀ ᴇʟ ꜰʙɪ ᴘᴏʀ ᴜsᴏ ᴅᴇ ʀɪꜰʟᴇs ɪʟᴇɢᴀʟᴇs!"}"`,
   getRandomColor());
  return false;
},

"!lag": (player, targetName) => {
  const target = encontrarJugadorPorNombre(targetName);
  if (!target) return enviarMensajePrivado(player.id, "❌ ᴊᴜɢᴀᴅᴏʀ ɴᴏ ᴇɴᴄᴏɴᴛʀᴀᴅᴏ. ¿ᴀᴄᴀsᴏ ᴇs ɪɴᴠɪsɪʙʟᴇ?", 0xFF5555);

  const hardware = hardwareReal[Math.floor(Math.random() * hardwareReal.length)];
  const ping = Math.floor(Math.random() * 999) + (player.id % 2 === 0 ? 1000 : 0);

  const soluciones = ["ᴄᴏᴍᴘʀᴀʀ ᴜɴ ᴘᴄ ɴᴜᴇᴠᴏ", "ᴍᴜᴅᴀʀᴛᴇ ᴀ ᴄᴏʀᴇᴀ ᴅᴇʟ ɴᴏʀᴛᴇ", "ᴀᴄᴇᴘᴛᴀʀ ᴛᴜ ᴅᴇsᴛɪɴᴏ"];
  const solucionAleatoria = soluciones[Math.floor(Math.random() * soluciones.length)];

  enviarMensajeGlobal(
      `🛠️ **ᴀɴáʟɪsɪs ᴛéᴄɴɪᴄᴏ ᴀᴠᴀɴᴢᴀᴅᴏ**\n` +
      `👨‍💻 ᴊᴜɢᴀᴅᴏʀ: @${target.name} • 📶 ᴘɪɴɢ: ${ping}ᴍs\n` +
      `💻 ʜᴀʀᴅᴡᴀʀᴇ: ${hardware.modelo} • ⚠️ ᴘʀᴏʙʟᴇᴍᴀ: ${hardware.problema}\n` +
      `📌 sᴏʟᴜᴄɪóɴ: "${solucionAleatoria}"`,
      getRandomColor()
  );
  return false;
},

"!silent": (player) => {
  const ahora = Date.now();
  const jugadoresActivos = room.getPlayerList().filter(p => p.id !== 0 && !jugadoresAFK.has(p.id));

  if (jugadoresActivos.length < 4) {
      return enviarMensajePrivado(player.id, "❌ sᴇ ʀᴇǫᴜɪᴇʀᴇɴ ≥4 ᴊᴜɢᴀᴅᴏʀᴇs ᴀᴄᴛɪᴠᴏs", 0xFF5555);
  }
  if (ahora - lastSilent < 180000) {
      const minutosRestantes = Math.ceil((180000 - (ahora - lastSilent)) / 60000);
      return enviarMensajePrivado(player.id, `⏳ ᴄᴏᴏʟᴅᴏᴡɴ: ${minutosRestantes} ᴍɪɴᴜᴛᴏ(s) ʀᴇsᴛᴀɴᴛᴇs`, 0xFF5555);
  }

  silentMode = true;
  lastSilent = ahora;
  enviarMensajeGlobal(
      `🔇 **ᴍᴏʀᴅᴀsᴀ ᴄᴏᴍᴜɴɪᴛᴀʀɪᴀ ᴀᴄᴛɪᴠᴀᴅᴀ**\n` +
      `👮‍♂️ ᴀᴜᴛᴏʀɪᴅᴀᴅ: @${player.name} • ⏰ ᴅᴜʀᴀᴄɪóɴ: 30 sᴇɢᴜɴᴅᴏs\n` +
      `📜 ʀᴀᴢóɴ: "${["sᴘᴀᴍ ᴅᴇ ᴍᴇᴍᴇs", "ᴅᴇᴍᴀsɪᴀᴅᴀ ᴄʀᴇᴀᴛɪᴠɪᴅᴀᴅ", "ᴏʀᴅᴇɴ ᴘúʙʟɪᴄᴏ"].random()}"`,
      getRandomColor()
  );

  setTimeout(() => {
      silentMode = false;
      enviarMensajeGlobal("🔊 **sᴇ ʀᴇsᴛᴀʙʟᴇᴄᴇɴ ʟᴏs ᴅᴇʀᴇᴄʜᴏs ʜᴜᴍᴀɴᴏs.**\n¡ᴘᴜᴇᴅᴇɴ ᴠᴏʟᴠᴇʀ ᴀ ᴍᴏʟᴇsᴛᴀʀ!", getRandomColor());
  }, 30000);

  return false;
},

"!ki": (player) => {
  if (deadPlayers.has(player.id)) {
      return enviarMensajePrivado(player.id, "💀 ʏᴀ ᴇsᴛás ᴍᴜᴇʀᴛᴏ. ᴜsᴀ !ʀᴇᴠɪᴠɪʀ ᴘᴀʀᴀ ᴠᴏʟᴠᴇʀ", 0x666666);
  }

  if (!kiPlayers[player.id]) {
      kiPlayers[player.id] = { charge: 0, overload: 0 };
  }

  const kiData = kiPlayers[player.id];
  kiData.charge = Math.min(kiData.charge + Math.floor(Math.random() * 30) + 10, 150);

  if (kiData.charge > 100) {
      kiData.overload += kiData.charge - 100;
      enviarMensajeGlobal(
          `⚠️ @${player.name} ᴇsᴛá sᴏʙʀᴇᴄᴀʀɢᴀɴᴅᴏ sᴜ ᴋɪ! (${kiData.overload}/100)\n` +
          `💀 sɪ ʟʟᴇɢᴀ ᴀ 100: ¡ᴍᴏʀɪʀás!`,
          getRandomColor()
      );

      if (kiData.overload >= 100) {
          deadPlayers.add(player.id);
          roleSystem.updatePlayerNameWithRole(player);
          enviarMensajeGlobal(
              `☠️ **@${player.name} ʜᴀ ᴍᴜᴇʀᴛᴏ** ᴘᴏʀ sᴏʙʀᴇᴄᴀʀɢᴀ ᴅᴇ ᴋɪ\n` +
              `⚰️ ᴀʜᴏʀᴀ ᴇs ᴜɴ ᴇsᴘᴇᴄᴛʀᴏ. ᴜsᴀ !ʀᴇᴠɪᴠɪʀ ᴘᴀʀᴀ ʀᴇɢʀᴇsᴀʀ`,
              getRandomColor()
          );
          return false;
      }
  }

  const barras = "▰".repeat(Math.floor(kiData.charge / 30)) + "▱".repeat(5 - Math.floor(kiData.charge / 30));

  enviarMensajeGlobal(
      `🌀 **ᴇsᴛᴀᴅᴏ ᴅᴇ ᴋɪ**\n` +
      `👤 ${player.name}: ${barras} ${kiData.charge}%\n` +
      `💬 ${kiData.charge >= 100 ? "¡ᴀᴛᴀǫᴜᴇ ᴅɪsᴘᴏɴɪʙʟᴇ!" : "sɪɢᴜᴇ ᴄᴀʀɢᴀɴᴅᴏ..."}`,
      kiData.charge >= 100 ? getRandomColor() : getRandomColor()
  );
  return false;
},

"!revivir": (player) => {
  if (!deadPlayers.has(player.id)) {
      return enviarMensajePrivado(player.id, "✅ ʏᴀ ᴇsᴛás ᴠɪᴠᴏ", getRandomColor());
  }

  deadPlayers.delete(player.id);
  kiPlayers[player.id] = { charge: 0, overload: 0 };
  roleSystem.updatePlayerNameWithRole(player);

  enviarMensajeGlobal(
      `✨ **@${player.name} ʜᴀ ʀᴇᴠɪᴠɪᴅᴏ**\n` +
      `❤️ ¡ʙɪᴇɴᴠᴇɴɪᴅᴏ ᴅᴇ ᴠᴜᴇʟᴛᴀ ᴀʟ ᴍᴜɴᴅᴏ ᴅᴇ ʟᴏs ᴠɪᴠᴏs!`,
      getRandomColor()
  );
  return false;
},

"!atki": (player, targetName) => {
  if (!kiPlayers[player.id] || kiPlayers[player.id].charge < 100) {
      const emojis = ["🤡", "👶", "💩"];
      const emojiAleatorio = emojis[Math.floor(Math.random() * emojis.length)];
      const consejos = ["ᴜsᴀ !ᴋɪ ᴘʀɪᴍᴇʀᴏ", "ᴄᴏᴍᴇ ᴍás ᴘʀᴏᴛᴇíɴᴀ", "ᴅᴇᴊᴀ ᴅᴇ ʜᴀᴄᴇʀ ᴇʟ ʀɪᴅíᴄᴜʟᴏ"];
      const consejoAleatorio = consejos[Math.floor(Math.random() * consejos.length)];

      enviarMensajeGlobal(
          `💥 **ꜰᴀʟʟᴏ éᴘɪᴄᴏ**\n` +
          `@${player.name} ɪɴᴛᴇɴᴛó ᴜɴ ᴀᴛᴀǫᴜᴇ ᴋɪ...\n` +
          `❌ ᴇɴᴇʀɢíᴀ ɪɴsᴜꜰɪᴄɪᴇɴᴛᴇ (${kiPlayers[player.id]?.charge || 0}%) ${emojiAleatorio}\n` +
          `📌 ᴄᴏɴsᴇᴊᴏ: "${consejoAleatorio}"`,
          getRandomColor()
      );
      return false;
  }

  const target = encontrarJugadorPorNombre(targetName);
  if (!target) return enviarMensajePrivado(player.id, "❌ ᴏʙᴊᴇᴛɪᴠᴏ ɴᴏ ᴇɴᴄᴏɴᴛʀᴀᴅᴏ. ¿ᴀᴛᴀᴄᴀʀás ᴀʟ ᴀɪʀᴇ?", 0xFF5555);

  const ataques = [
      { nombre: "ᴋᴀᴍᴇʜᴀᴍᴇʜᴀ", efecto: "ᴅᴇsᴛʀᴜʏó ᴇʟ ᴍᴀᴘᴀ" },
      { nombre: "ꜰɪɴᴀʟ ꜰʟᴀsʜ", efecto: "ᴄʀᴇó ᴜɴ ᴀɢᴜᴊᴇʀᴏ ɴᴇɢʀᴏ" },
      { nombre: "ɢᴇɴᴋɪᴅᴀᴍᴀ", efecto: "ꜰʀᴇɴᴀᴅᴏ ᴘᴏʀ ᴄᴏᴘʏʀɪɢʜᴛ" }
  ];
  const ataque = ataques[Math.floor(Math.random() * ataques.length)];

  enviarMensajeGlobal(
      `💥 **ᴀᴛᴀǫᴜᴇ ᴋɪ**\n` +
      `👤 ᴀᴛᴀᴄᴀɴᴛᴇ: @${player.name} • 🎯 ᴠíᴄᴛɪᴍᴀ: @${target.name}\n` +
      `☄️ ᴛéᴄɴɪᴄᴀ: ${ataque.nombre} • 💀 ᴅᴀñᴏ: ${Math.floor(Math.random() * 9000) + 1000}\n` +
      `📌 ᴇꜰᴇᴄᴛᴏ: ${ataque.efecto}`,
      getRandomColor()
  );

  kiPlayers[player.id].charge = 0;
  return false;
},

"!rcn": (player) => {
  const jugadores = room.getPlayerList().filter(p => p.id !== 0);
  const jugadorAleatorio = jugadores[Math.floor(Math.random() * jugadores.length)];

  const noticias = [
      `📡 **ᴀᴄᴛᴜᴀʟɪᴢᴀᴄɪóɴ 1.5.0**: sᴇ ᴄᴏʀʀɪɢɪó ᴇʟ ʙᴜɢ ǫᴜᴇ ᴘᴇʀᴍɪᴛíᴀ ᴊᴜɢᴀʀ ʙɪᴇɴ. ᴀʜᴏʀᴀ ᴛᴏᴅᴏs ᴛᴇɴᴅʀáɴ ${Math.floor(Math.random() * 100)}% ᴍás ᴅᴇ ʟᴀɢ.`,
      `🏆 **ᴇɴᴛʀᴇᴠɪsᴛᴀ ᴇxᴄʟᴜsɪᴠᴀ**: "${jugadorAleatorio ? jugadorAleatorio.name : "ᴜɴ ᴊᴜɢᴀᴅᴏʀ ᴀɴóɴɪᴍᴏ"}" ᴄᴏɴꜰɪᴇsᴀ: "ᴍɪs ᴘᴀsᴇs ʜᴏʀʀɪʙʟᴇs sᴏɴ ᴇsᴛʀᴀᴛᴇɢɪᴀ, ɴᴏ ɪɴᴄᴏᴍᴘᴇᴛᴇɴᴄɪᴀ".`,
      `🌐 **ᴛᴇᴄɴᴏʟᴏɢíᴀ**: ɴᴜᴇᴠᴏ ᴇsᴛᴜᴅɪᴏ ᴄᴏɴꜰɪʀᴍᴀ ǫᴜᴇ ᴇʟ 100% ᴅᴇ ʟᴏs ᴀᴜᴛᴏɢᴏʟᴇs sᴏɴ ᴄᴜʟᴘᴀ ᴅᴇʟ ᴛᴇᴄʟᴀᴅᴏ.`,
      `⚖️ **ᴘᴏʟéᴍɪᴄᴀ**: ᴜsᴜᴀʀɪᴏ "${jugadorAleatorio ? jugadorAleatorio.name : "ᴜɴ ᴊᴜɢᴀᴅᴏʀ"}" ᴅᴇᴍᴀɴᴅᴀ ᴀ ʜᴀxʙᴀʟʟ ᴘᴏʀ "ʜᴀᴄᴇʀʟᴇ ᴘᴇʀᴅᴇʀ sᴜ ᴅɪɢɴɪᴅᴀᴅ".`,
      `📊 **ᴇsᴛᴀᴅísᴛɪᴄᴀs**: ᴇʟ ${Math.floor(Math.random() * 100)}% ᴅᴇ ʟᴏs ᴊᴜɢᴀᴅᴏʀᴇs ɴᴏ sᴀʙᴇ ǫᴜé ᴇs ᴇʟ ᴏꜰꜰsɪᴅᴇ (ʏ ᴇʟ ʀᴇsᴛᴏ ᴍɪᴇɴᴛᴇ).`
  ];

  const noticiaAleatoria = noticias[Math.floor(Math.random() * noticias.length)];
  const fuentes = ["ᴀʀɪᴀʟ 12", "ᴜɴ ᴛᴡᴇᴇᴛ ᴅᴇ 2013", "ʟᴏ sᴏñé ᴀɴᴏᴄʜᴇ"];
  const fuenteAleatoria = fuentes[Math.floor(Math.random() * fuentes.length)];

  enviarMensajeGlobal(
      `📺 **ɴᴏᴛɪᴄɪᴇʀᴏ ʀᴄɴ ⚠️ ᴛʀᴀɴsᴍɪsɪóɴ ᴏꜰɪᴄɪᴀʟ**\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${noticiaAleatoria}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🎙️ ᴘʀᴇsᴇɴᴛᴀᴅᴏʀ: @${player.name} • 📍 ꜰᴜᴇɴᴛᴇ: "${fuenteAleatoria}"`,
      getRandomColor()
  );
  return false;
},

"!kill": (player, targetName) => {
  if (deadPlayers.has(player.id)) {
      return enviarMensajePrivado(player.id, "💀 ʟᴏs ᴍᴜᴇʀᴛᴏs ɴᴏ ᴘᴜᴇᴅᴇɴ ᴍᴀᴛᴀʀ", 0x666666);
  }

  const target = encontrarJugadorPorNombre(targetName);
  if (!target) return enviarMensajePrivado(player.id, "❌ ᴊᴜɢᴀᴅᴏʀ ɴᴏ ᴇɴᴄᴏɴᴛʀᴀᴅᴏ", 0xFF5555);

  if (deadPlayers.has(target.id)) {
      return enviarMensajeGlobal(
          `💀 @${player.name} ɪɴᴛᴇɴᴛó ᴍᴀᴛᴀʀ ᴀ @${target.name}...\n` +
          `👻 ᴘᴇʀᴏ ʏᴀ ᴇsᴛá ᴍᴜᴇʀᴛᴏ (ǫᴜé ᴄʀᴜᴇʟ)`,
          getRandomColor()
      );
  }

  deadPlayers.add(target.id);
  roleSystem.updatePlayerNameWithRole(target);

  const metodos = [
      `⚔️ ${player.name} ᴇᴊᴇᴄᴜᴛó ᴀ ${target.name} ᴄᴏɴ ᴜɴ ᴄᴏᴍʙᴏ ᴅᴇ 360 ɴᴏ-sᴄᴏᴘᴇ`,
      `💀 ${player.name} ᴇʟɪᴍɪɴó ᴀ ${target.name} ᴄᴏɴ ᴜɴ ꜰᴀᴛᴀʟɪᴛʏ`,
      `☠️ ${player.name} ᴇɴᴠᴇɴᴇɴó ᴇʟ ᴄᴏɴᴛʀᴏʟ ᴅᴇ ${target.name}`
  ];
  const mensaje = metodos[Math.floor(Math.random() * metodos.length)];

  enviarMensajeGlobal(
      `${mensaje}\n` +
      `⚰️ @${target.name} ᴀʜᴏʀᴀ ᴇs ᴜɴ ᴇsᴘᴇᴄᴛʀᴏ. ᴜsᴀ !ʀᴇᴠɪᴠɪʀ ᴘᴀʀᴀ ʀᴇɢʀᴇsᴀʀ`,
      getRandomColor()
  );
  return false;
},

"!clearbans": (player) => {
  if (!player.admin) {
      enviarMensajePrivado(player.id, "❌ sᴏʟᴏ ᴀᴅᴍɪɴs ᴘᴜᴇᴅᴇɴ ᴜsᴀʀ ᴇsᴛᴇ ᴄᴏᴍᴀɴᴅᴏ", 0xFF5555);
      return false;
  }

  const eraAdmin = player.admin;
  room.setPlayerAdmin(0, true);
  room.sendChat("/clear_bans");

  enviarMensajeGlobal(`♻️ ${player.name} ʟɪᴍᴘɪó ᴛᴏᴅᴏs ʟᴏs ʙᴀɴs ᴅᴇ ʟᴀ sᴀʟᴀ`, getRandomColor());
  console.log(`ʙᴀɴs ʟɪᴍᴘɪᴀᴅᴏs ᴘᴏʀ ${player.name} (${player.id})`);

  setTimeout(() => {
      if (eraAdmin) room.setPlayerAdmin(player.id, true);
      room.setPlayerAdmin(0, false);
  }, 1000);

  return false;
},

"!simio": (player, mensaje) => {
  if (comandos.checkCooldown(player.id, "!simio")) {
      const segundos = comandos.getCooldownTime(player.id, "!simio");
      enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ʜᴀʙʟᴀʀ ᴄᴏᴍᴏ sɪᴍɪᴏ ᴏᴛʀᴀ ᴠᴇᴢ`, 0xFFB74D);
      return false;
  }

  if (!mensaje) {
      enviarMensajePrivado(player.id, "❌ ᴜsᴏ: !sɪᴍɪᴏ [ᴍᴇɴsᴀᴊᴇ]", 0xFF6D6D);
      return false;
  }

  const vocalesSimio = ["ᴀᴀ", "ᴏᴏ", "ᴀᴏ", "ᴜᴀ", "ᴜᴜ", "ᴇᴇ", "ᴏᴇ", "ᴀᴇ"];
  let mensajeSimio = "";

  mensaje.split(" ").forEach(palabra => {
      const silabas = Math.max(1, Math.floor(palabra.length / 2));
      for (let i = 0; i < silabas; i++) {
          mensajeSimio += vocalesSimio[Math.floor(Math.random() * vocalesSimio.length)] + " ";
      }
  });

  enviarMensajeGlobal(
      `🐵 @${player.name} ᴅɪᴄᴇ ᴇɴ sɪᴍɪᴏ: ${mensajeSimio.trim()}\n` +
      `🤔 ᴛʀᴀᴅᴜᴄᴄɪóɴ ʜᴜᴍᴀɴᴀ: "${mensaje}"`,
      getRandomColor()
  );

  comandos.setCooldown(player.id, "!simio");
  return false;
},

// ======================
// SISTEMA DE VOTACIÓN
// ======================
"!votar": (player, pregunta) => {
  if (!votacion) {
      if (!pregunta) return enviarMensajePrivado(player.id, "❌ ᴇᴊᴇᴍᴘʟᴏ: !ᴠᴏᴛᴀʀ ¿ᴍᴇᴊᴏʀ ᴊᴜɢᴀᴅᴏʀ?", 0xFF5555);

      votacion = { pregunta, si: [], no: [], iniciador: player.name };

      enviarMensajeGlobal(
          `🗳️ ɴᴜᴇᴠᴀ ᴠᴏᴛᴀᴄɪóɴ: "${pregunta}"\n` +
          `✅ ᴠᴏᴛᴀ ᴄᴏɴ !sɪ • ❌ ᴠᴏᴛᴀ ᴄᴏɴ !ɴᴏ\n` +
          `⏳ ʟᴀ ᴠᴏᴛᴀᴄɪóɴ ᴅᴜʀᴀʀá 1 ᴍɪɴᴜᴛᴏ ʏ 30 sᴇɢᴜɴᴅᴏs`,
          getRandomColor(), "bold"
      );

      votacionTimeout = setTimeout(() => {
          if (votacion) {
              const totalVotos = votacion.si.length + votacion.no.length;
              enviarMensajeGlobal(
                  `⏰ ᴠᴏᴛᴀᴄɪóɴ ꜰɪɴᴀʟɪᴢᴀᴅᴀ: "${votacion.pregunta}"\n` +
                  `✅ ${votacion.si.length} ᴠᴏᴛᴏs ᴀ ꜰᴀᴠᴏʀ • ❌ ${votacion.no.length} ᴠᴏᴛᴏs ᴇɴ ᴄᴏɴᴛʀᴀ\n` +
                  `📊 ᴛᴏᴛᴀʟ ᴠᴏᴛᴏs: ${totalVotos} • 📢 ${votacion.iniciador} ᴘʀᴏᴘᴜsᴏ: ${votacion.pregunta}`,
                  getRandomColor(), "bold"
              );
              votacion = null;
          }
      }, 90000);

      return false;
  } else {
      return enviarMensajeGlobal(
          `ℹ️ ᴠᴏᴛᴀᴄɪóɴ ᴇɴ ᴄᴜʀsᴏ: "${votacion.pregunta}"\n` +
          `✅ ${votacion.si.length} ᴠᴏᴛᴏs | ❌ ${votacion.no.length} ᴠᴏᴛᴏs`,
          getRandomColor()
      );
  }
},

"!si": (player) => {
  if (!votacion) return enviarMensajePrivado(player.id, "❌ ɴᴏ ʜᴀʏ ᴠᴏᴛᴀᴄɪóɴ ᴀᴄᴛɪᴠᴀ", 0xFF5555);
  if (votacion.si.includes(player.id) || votacion.no.includes(player.id)) {
      return enviarMensajePrivado(player.id, "❌ ʏᴀ ᴠᴏᴛᴀsᴛᴇ ᴇɴ ᴇsᴛᴀ ᴠᴏᴛᴀᴄɪóɴ", 0xFF5555);
  }
  votacion.si.push(player.id);
  enviarMensajeGlobal(`✅ ${player.name} ᴠᴏᴛó sɪ (ᴛᴏᴛᴀʟ: ${votacion.si.length})`, getRandomColor());
  return false;
},

"!no": (player) => {
  if (!votacion) return enviarMensajePrivado(player.id, "❌ ɴᴏ ʜᴀʏ ᴠᴏᴛᴀᴄɪóɴ ᴀᴄᴛɪᴠᴀ", 0xFF5555);
  if (votacion.si.includes(player.id) || votacion.no.includes(player.id)) {
      return enviarMensajePrivado(player.id, "❌ ʏᴀ ᴠᴏᴛᴀsᴛᴇ ᴇɴ ᴇsᴛᴀ ᴠᴏᴛᴀᴄɪóɴ", 0xFF5555);
  }
  votacion.no.push(player.id);
  enviarMensajeGlobal(`❌ ${player.name} ᴠᴏᴛó ɴᴏ (ᴛᴏᴛᴀʟ: ${votacion.no.length})`, getRandomColor());
  return false;
},

"!contar": (player, numerosInput) => {
  if (cargandoContador) {
      enviarMensajePrivado(player.id, "🔄 ᴇʟ ᴄᴏɴᴛᴀᴅᴏʀ sᴇ ᴇsᴛá ᴄᴀʀɢᴀɴᴅᴏ, ɪɴᴛᴇɴᴛᴀ ɴᴜᴇᴠᴀᴍᴇɴᴛᴇ ᴇɴ ᴜɴᴏs sᴇɢᴜɴᴅᴏs", 0xFFB74D);
      return false;
  }

  if (!numerosInput) {
      enviarMensajeGlobal(
          `📌 ᴄᴏɴᴛᴀᴅᴏʀ ᴀᴄᴛᴜᴀʟ: ${contador} • 👉 sɪɢᴜɪᴇɴᴛᴇ ɴúᴍᴇʀᴏ: ${siguienteNumero}\n` +
          `ℹ️ ᴜsᴏ: !ᴄᴏɴᴛᴀʀ <ɴúᴍᴇʀᴏ> ᴏ !ᴄᴏɴᴛᴀʀ <sᴇʀɪᴇ ᴅᴇ ɴúᴍᴇʀᴏs>`,
          getRandomColor()
      );
      return false;
  }

  const numeros = numerosInput.split(/\s+/).map(num => parseInt(num)).filter(num => !isNaN(num));

  if (numeros.length === 0) {
      enviarMensajePrivado(player.id, "❌ ɪɴɢʀᴇsᴀ ɴúᴍᴇʀᴏs ᴠáʟɪᴅᴏs. ᴇᴊᴇᴍᴘʟᴏ: !ᴄᴏɴᴛᴀʀ 1 2 3", 0xFF5555);
      return false;
  }

  if (numeros[0] !== siguienteNumero) {
      enviarMensajeGlobal(
          `❌ ${player.name} ᴇᴍᴘᴇᴢó ᴄᴏɴ ${numeros[0]} - ¡ᴅᴇʙíᴀ sᴇʀ ${siguienteNumero}!\n` +
          `🔢 ᴄᴏɴᴛᴀᴅᴏʀ ᴀᴄᴛᴜᴀʟ: ${contador} • 👉 ᴜsᴀ !ᴄᴏɴᴛᴀʀ ᴘᴀʀᴀ ᴠᴇʀ ᴇʟ sɪɢᴜɪᴇɴᴛᴇ ɴúᴍᴇʀᴏ`,
          getRandomColor()
      );
      return false;
  }

  let ultimoCorrecto = contador;
  let numerosCorrectos = 0;

  for (const num of numeros) {
      if (num === siguienteNumero) {
          contador = num;
          siguienteNumero++;
          ultimoCorrecto = num;
          numerosCorrectos++;
      } else {
          break;
      }
  }

  guardarContador().catch(error => {
      console.error("ᴇʀʀᴏʀ ᴀʟ ɢᴜᴀʀᴅᴀʀ ᴄᴏɴᴛᴀᴅᴏʀ:", error);
      enviarMensajePrivado(player.id, "⚠️ ʜᴜʙᴏ ᴜɴ ᴇʀʀᴏʀ ᴀʟ ɢᴜᴀʀᴅᴀʀ ᴇʟ ᴄᴏɴᴛᴀᴅᴏʀ", 0xFF5555);
  });

  let mensaje;
  if (numeros.length === 1) {
      mensaje = `✅ ${player.name} ᴅɪᴊᴏ ${contador} - ¡ᴄᴏʀʀᴇᴄᴛᴏ!`;
  } else if (numerosCorrectos === numeros.length) {
      mensaje = `🎉 ${player.name} ᴄᴏɴᴛó ʜᴀsᴛᴀ ${ultimoCorrecto} ᴄᴏʀʀᴇᴄᴛᴀᴍᴇɴᴛᴇ!`;
  } else {
      mensaje = `⚠️ ${player.name} ᴄᴏɴᴛó ʜᴀsᴛᴀ ${ultimoCorrecto} (ꜰᴀʟʟó ᴇɴ ${numeros[numerosCorrectos]})`;
  }

  mensaje += `\n🔢 sɪɢᴜɪᴇɴᴛᴇ ɴúᴍᴇʀᴏ: ${siguienteNumero} • ℹ️ ᴜsᴀ !ᴄᴏɴᴛᴀʀ ᴘᴀʀᴀ ᴄᴏɴᴛɪɴᴜᴀʀ`;

  enviarMensajeGlobal(mensaje, numerosCorrectos > 0 ? getRandomColor() : getRandomColor(), "bold");
  return false;
},

// ======================
// SISTEMA DE FIRMAS
// ======================
"!firma": (player, texto) => {
  if (!texto) {
      if (firmas[player.id]) {
          return enviarMensajeGlobal(`📜 ꜰɪʀᴍᴀ ᴅᴇ ${player.name}: "${firmas[player.id].texto}"`, getRandomColor());
      }
      return enviarMensajePrivado(player.id, "❌ ᴇᴊᴇᴍᴘʟᴏ: !ꜰɪʀᴍᴀ ᴇʟ ᴍᴇᴊᴏʀ ᴊᴜɢᴀᴅᴏʀ", 0xFF5555);
  }

  const fontTransforms = [
      t => t,
      t => t.split('').map(c => String.fromCodePoint(c.charCodeAt(0) + 65248)).join(''),
      t => t.split('').map(c => c + '̶').join(''),
      t => t.toUpperCase(),
      t => t.split('').map(c => c + '⃝').join('')
  ];

  const randomFont = Math.floor(Math.random() * fontTransforms.length);
  firmas[player.id] = {
      texto: fontTransforms[randomFont](texto),
      fontType: randomFont
  };

  enviarMensajeGlobal(`📜 ${player.name} ʜᴀ ᴇsᴛᴀʙʟᴇᴄɪᴅᴏ sᴜ ꜰɪʀᴍᴀ: "${firmas[player.id].texto}"`, getRandomColor());
  return false;
},

// ======================
// COMANDOS DE INTERACCIÓN
// ======================
"!twerk": (player, targetName) => {
  if (comandos.checkCooldown(player.id, "!twerk")) {
      const segundos = comandos.getCooldownTime(player.id, "!twerk");
      enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴏᴛʀᴏ ᴘᴇʀʀᴇᴏ`, 0xFFB74D);
      return false;
  }

  const target = targetName ? validarJugador(player, targetName) : null;
  const twerks = target ? [
      `🍑 ${player.name} ʟᴇ ʜᴀᴄᴇ ᴜɴ ᴛᴡᴇʀᴋ sᴇɴsᴜᴀʟ ᴀ ${target.name} (≧◡≦) ♪`,
      `💃 ${player.name} ᴘᴇʀʀᴇᴀ ᴘᴇʟɪɢʀᴏsᴀᴍᴇɴᴛᴇ ᴄᴇʀᴄᴀ ᴅᴇ ${target.name}`
  ] : [
      `🍑 ${player.name} ɪɴɪᴄɪᴀ ᴜɴᴀ sᴇsɪóɴ ᴅᴇ ᴛᴡᴇʀᴋ sᴀʟᴠᴀᴊᴇ`,
      `💥 ${player.name} ʀᴏᴍᴘᴇ ᴇʟ sᴜᴇʟᴏ ᴄᴏɴ sᴜ ᴘᴇʀʀᴇᴏ ɪɴᴛᴇɴsᴏ`
  ];

  enviarMensajeGlobal(twerks[Math.floor(Math.random() * twerks.length)], getRandomColor());
  comandos.setCooldown(player.id, "!twerk");
  return false;
},

"!kiss": (player, targetName) => {
  if (comandos.checkCooldown(player.id, "!kiss")) {
      const segundos = comandos.getCooldownTime(player.id, "!kiss");
      enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴏᴛʀᴏ ʙᴇsᴏ`, 0xFFB6C1);
      return false;
  }

  const target = validarJugador(player, targetName);
  if (!target) return false;

  const besos = [
      `💋 ${player.name} ᴅᴀ ᴜɴ ᴅᴜʟᴄᴇ ʙᴇsᴏ ᴇɴ ʟᴀ ᴍᴇᴊɪʟʟᴀ ᴀ ${target.name} (> ^_^)>`,
      `😘 ${player.name} sᴏʀᴘʀᴇɴᴅᴇ ᴀ ${target.name} ᴄᴏɴ ᴜɴ ʙᴇsᴏ ꜰʀᴀɴᴄés ᴀᴘᴀsɪᴏɴᴀᴅᴏ`
  ];

  enviarMensajeGlobal(besos[Math.floor(Math.random() * besos.length)], getRandomColor());
  comandos.setCooldown(player.id, "!kiss");
  return false;
},

"!fuck": (player, targetName) => {
  if (comandos.checkCooldown(player.id, "!fuck")) {
      const segundos = comandos.getCooldownTime(player.id, "!fuck");
      enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴇsᴛᴇ ᴄᴏᴍᴀɴᴅᴏ`, 0xFFB74D);
      return false;
  }

  const target = validarJugador(player, targetName);
  if (!target) return false;

  const acciones = [
      `💏 ${player.name} sᴇ ᴇɴʀᴏʟʟᴀ ᴀᴘᴀsɪᴏɴᴀᴅᴀᴍᴇɴᴛᴇ ᴄᴏɴ ${target.name} ᴅᴇᴛʀás ᴅᴇʟ ᴀʀᴄᴏ`,
      `🍌 ${player.name} ʟᴇ ᴅᴀ ᴇʟ ᴘʟáᴛᴀɴᴏ ᴀ ${target.name} (ʟɪᴛᴇʀᴀʟᴍᴇɴᴛᴇ)`
  ];

  enviarMensajeGlobal(acciones[Math.floor(Math.random() * acciones.length)], getRandomColor());
  comandos.setCooldown(player.id, "!fuck");
  return false;
},

"!hug": (player, targetName) => {
  const target = validarJugador(player, targetName);
  if (!target) return false;

  const abrazos = [
      `🤗 ${player.name} ᴀʙʀᴀᴢᴀ ꜰᴜᴇʀᴛᴇᴍᴇɴᴛᴇ ᴀ ${target.name} (༼ つ ◕_◕ ༽つ)`,
      `🫂 ${player.name} ʏ ${target.name} ᴄᴏᴍᴘᴀʀᴛᴇɴ ᴜɴ ᴀʙʀᴀᴢᴏ ᴇᴍᴏᴛɪᴠᴏ`
  ];

  enviarMensajeGlobal(abrazos[Math.floor(Math.random() * abrazos.length)], getRandomColor());
  return false;
},

// ======================
// COMANDOS DE JUEGO
// ======================
"!dado20": (player) => {
  const resultado = Math.floor(Math.random() * 20) + 1;
  const critico = resultado === 20 ? "‼️ ᴄʀíᴛɪᴄᴏ ‼️" : resultado === 1 ? "💀 ᴘɪꜰɪᴀ 💀" : "";
  enviarMensajeGlobal(`🎲 ${player.name} ʟᴀɴᴢᴀ ᴜɴ ᴅᴀᴅᴏ ᴅᴇ 20 ᴄᴀʀᴀs...\n⚡ ʀᴇsᴜʟᴛᴀᴅᴏ: ${resultado} ${critico}`, getRandomColor(), "bold");
  return false;
},

"!trivia": (player, targetName) => {
  if (triviaEnCurso) {
      enviarMensajePrivado(player.id, "❌ ʏᴀ ʜᴀʏ ᴜɴᴀ ᴛʀɪᴠɪᴀ ᴇɴ ᴄᴜʀsᴏ", 0xFF5555);
      return false;
  }

  if (!targetName) {
      jugadoresTrivia = [player.id];
      puntos[player.id] = 0;
      iniciarTrivia();
      return false;
  }

  const target = encontrarJugadorPorNombre(targetName);
  if (!target) {
      enviarMensajePrivado(player.id, "❌ ᴊᴜɢᴀᴅᴏʀ ɴᴏ ᴇɴᴄᴏɴᴛʀᴀᴅᴏ", 0xFF5555);
      return false;
  }

  jugadoresTrivia = [player.id, target.id];
  puntos[player.id] = 0;
  puntos[target.id] = 0;

  enviarMensajePrivado(
      target.id,
      `⚔️ ${player.name} ᴛᴇ ᴅᴇsᴀꜰíᴀ ᴀ ᴜɴᴀ ᴛʀɪᴠɪᴀ!\nᴇsᴄʀɪʙᴇ !ᴀᴄᴇᴘᴛᴀʀ ᴘᴀʀᴀ ᴊᴜɢᴀʀ ᴏ ɪɢɴᴏʀᴀ ᴘᴀʀᴀ ʀᴇᴄʜᴀᴢᴀʀ.`,
      getRandomColor()
  )

  enviarMensajeGlobal(
      `📢 ${player.name} ʜᴀ ᴅᴇsᴀꜰɪᴀᴅᴏ ᴀ ${target.name} ᴀ ᴜɴᴀ ᴛʀɪᴠɪᴀ (ᴇsᴘᴇʀᴀɴᴅᴏ ʀᴇsᴘᴜᴇsᴛᴀ...)`,
      getRandomColor()
  )

  setTimeout(() => {
      if (!triviaEnCurso && jugadoresTrivia.length === 2) {
          enviarMensajeGlobal(`⌛ ${target.name} ɴᴏ ᴀᴄᴇᴘᴛó ᴇʟ ᴅᴇsᴀꜰíᴏ`, getRandomColor());
          jugadoresTrivia = [];
      }
  }, 15000);

  return false;
},

"!aceptar": (player) => {
  if (triviaEnCurso || jugadoresTrivia.length !== 2 || jugadoresTrivia.includes(player.id)) {
      return false;
  }

  if (jugadoresTrivia[1] === player.id) {
      iniciarTrivia();
  }
  return false;
},

"!cancelar": (player) => {
  if (!triviaEnCurso && jugadoresTrivia.length > 0 && jugadoresTrivia[0] === player.id) {
      enviarMensajeGlobal(`❌ ${player.name} ʜᴀ ᴄᴀɴᴄᴇʟᴀᴅᴏ ʟᴀ ᴛʀɪᴠɪᴀ.`, getRandomColor());
      jugadoresTrivia = [];
      puntos = {};
  }
  return false;
},

"!reglastrivia": (player) => {
  enviarMensajePrivado(player.id, 
      `📜 ʀᴇɢʟᴀs ᴅᴇ ᴛʀɪᴠɪᴀ:\n` +
      `- ɪɴᴅɪᴠɪᴅᴜᴀʟ ᴏ 1ᴠs1 (!ᴛʀɪᴠɪᴀ ᴏ !ᴛʀɪᴠɪᴀ @ᴊᴜɢᴀᴅᴏʀ)\n` +
      `- 6 ᴘʀᴇɢᴜɴᴛᴀs ᴠᴀʀɪᴀᴅᴀs • 10 sᴇɢᴜɴᴅᴏs ᴘᴏʀ ᴘʀᴇɢᴜɴᴛᴀ\n` +
      `- +5 ᴘᴜɴᴛᴏs ᴘᴏʀ ʀᴇsᴘᴜᴇsᴛᴀ ᴄᴏʀʀᴇᴄᴛᴀ • -3 ᴘᴏʀ ɪɴᴄᴏʀʀᴇᴄᴛᴀ\n` +
      `- -1 ᴘᴜɴᴛᴏ ᴘᴏʀ ɴᴏ ʀᴇsᴘᴏɴᴅᴇʀ • ʀᴇsᴘᴏɴᴅᴇ ᴄᴏɴ !ᴀ, !ʙ ᴏ !ᴄ`,
      getRandomColor()
  );
  return false;
},

"!a": (player) => {
  if (!triviaEnCurso) return false;
  return handleTriviaAnswer(player, "a");
},

"!b": (player) => {
  if (!triviaEnCurso) return false;
  return handleTriviaAnswer(player, "b");
},

"!c": (player) => {
  if (!triviaEnCurso) return false;
  return handleTriviaAnswer(player, "c");
},

"!horoscopo": (player, signo) => {
  const signosValidos = ["ᴀʀɪᴇs", "ᴛᴀᴜʀᴏ", "ɢᴇᴍɪɴɪs", "ᴄᴀɴᴄᴇʀ", "ʟᴇᴏ", "ᴠɪʀɢᴏ", 
                       "ʟɪʙʀᴀ", "ᴇsᴄᴏʀᴘɪᴏ", "sᴀɢɪᴛᴀʀɪᴏ", "ᴄᴀᴘʀɪᴄᴏʀɴɪᴏ", "ᴀᴄᴜᴀʀɪᴏ", "ᴘɪsᴄɪs"];

  if (!signo || !signosValidos.includes(signo.toLowerCase())) {
      enviarMensajePrivado(player.id, "❌ sɪɢɴᴏ ɪɴᴠáʟɪᴅᴏ. ᴇᴊᴇᴍᴘʟᴏ: !ʜᴏʀᴏsᴄᴏᴘᴏ ᴀᴄᴜᴀʀɪᴏ", 0xFF6D6D);
      return false;
  }

  const predicciones = [
      `ʜᴏʏ sᴇʀá ᴜɴ ᴅíᴀ... ɪɢᴜᴀʟ ᴅᴇ ᴍᴀʟᴏ ǫᴜᴇ ᴀʏᴇʀ. ᴇᴠɪᴛᴀ ᴘᴀᴛᴇᴀʀ ʙᴀʟᴏɴᴇs.`,
      `ʟᴏs ᴀsᴛʀᴏs ᴘʀᴇᴅɪᴄᴇɴ ᴀᴜᴛᴏɢᴏʟᴇs. ᴜsᴀ ᴇʟ ʙᴏᴛóɴ 'ʀᴇᴘᴏʀᴛᴀʀ' ᴄᴏᴍᴏ ᴀᴍᴜʟᴇᴛᴏ.`,
      `ᴍᴇʀᴄᴜʀɪᴏ ʀᴇᴛʀóɢʀᴀᴅᴏ ᴀꜰᴇᴄᴛᴀʀá ᴛᴜ ᴄᴏᴏʀᴅɪɴᴀᴄɪóɴ. ᴏ ǫᴜɪᴢá sᴏʟᴏ ᴇʀᴇs ᴍᴀʟᴏ.`,
      `ᴛᴜ sᴜᴇʀᴛᴇ ᴄᴀᴍʙɪᴀʀá ᴄᴜᴀɴᴅᴏ ᴇɴᴄᴜᴇɴᴛʀᴇs ʟᴀ ᴛᴇᴄʟᴀ 'ɢᴀɴᴀʀ' (ɴᴏ ᴇxɪsᴛᴇ).`,
      `ᴊúᴘɪᴛᴇʀ ᴀʟɪɴᴇᴀᴅᴏ ᴄᴏɴ ᴍᴀʀᴛᴇ: ʙᴜᴇɴ ᴅíᴀ ᴘᴀʀᴀ... sᴘᴇᴄᴛᴇᴀʀ.`,
      `ᴘʀᴇᴅɪᴄᴄɪóɴ: ${player.name} sᴇɢᴜɪʀá sɪɴ ᴇɴᴛᴇɴᴅᴇʀ ᴏꜰꜰsɪᴅᴇ ʜᴏʏ.`,
      `ᴇʟ ᴜɴɪᴠᴇʀsᴏ ᴄᴏɴsᴘɪʀᴀ ᴄᴏɴᴛʀᴀ ᴛɪ. ʙᴜᴇɴᴏ, ᴇɴ ʀᴇᴀʟɪᴅᴀᴅ ᴛᴏᴅᴏs.`
  ];

  const emojisSignos = {
      aries: "♈", tauro: "♉", geminis: "♊", cancer: "♋", leo: "♌", 
      virgo: "♍", libra: "♎", escorpio: "♏", sagitario: "♐", 
      capricornio: "♑", acuario: "♒", piscis: "♓"
  };

  const prediccion = predicciones[Math.floor(Math.random() * predicciones.length)];
  const emoji = emojisSignos[signo.toLowerCase()];

  enviarMensajeGlobal(
      `${emoji} ʜᴏʀósᴄᴏᴘᴏ ${signo.toUpperCase()} ${emoji}\n` +
      `📜 ${prediccion}\n` +
      `✨ ᴄᴏɴsᴇᴊᴏ: ${Math.random() > 0.5 ? "ɴᴏ ᴊᴜᴇɢᴜᴇs ʜᴏʏ" : "ᴍᴇᴊᴏʀ ᴘʀᴜᴇʙᴀ ᴏᴛʀᴏ ᴊᴜᴇɢᴏ"}`,
      getRandomColor()
  );
  return false;
},

"!ship": (player, args) => {
  const nombres = args.split(/\s+/).filter(Boolean);

  if (nombres.length === 0) {
      return enviarMensajePrivado(player.id, "❌ ᴜsᴀ: !sʜɪᴘ @ᴊᴜɢᴀᴅᴏʀ1 @ᴊᴜɢᴀᴅᴏʀ2", 0xFF6D6D);
  }

  let jugador1, jugador2;

  if (nombres.length === 1) {
      jugador1 = player;
      jugador2 = encontrarJugadorPorNombre(nombres[0]);

      if (!jugador2) {
          return enviarMensajePrivado(player.id, "❌ ᴊᴜɢᴀᴅᴏʀ ɴᴏ ᴇɴᴄᴏɴᴛʀᴀᴅᴏ", 0xFF6D6D);
      }
  } else {
      jugador1 = encontrarJugadorPorNombre(nombres[0]);
      jugador2 = encontrarJugadorPorNombre(nombres[1]);

      if (!jugador1 || !jugador2) {
          return enviarMensajePrivado(player.id, "❌ ᴜɴᴏ ᴏ ᴀᴍʙᴏs ᴊᴜɢᴀᴅᴏʀᴇs ɴᴏ ᴇɴᴄᴏɴᴛʀᴀᴅᴏs", 0xFF6D6D);
      }
  }

  const shipName = (jugador1.name.substring(0, 2) + jugador2.name.substring(jugador2.name.length - 2)).toUpperCase();
  const porcentaje = Math.floor(Math.random() * 100) + 1;
  const emojiShip = SHIP_EMOJIS[Math.floor(Math.random() * SHIP_EMOJIS.length)];
  const fraseShip = SHIP_PHRASES[Math.floor(Math.random() * SHIP_PHRASES.length)];

  const mensajeShip = 
      `⚠️💖⚠️ ${player.name} sʜɪᴘᴇᴏ ᴀ ${jugador1.name} ʏ ${jugador2.name}!!!\n` +
      `✨ ${jugador1.name} ʏ ${jugador2.name} ${fraseShip}\n` +
      `💌 ɴᴏᴍʙʀᴇ ᴅᴇʟ sʜɪᴘ: ${shipName} • 📈 ᴄᴏᴍᴘᴀᴛɪʙɪʟɪᴅᴀᴅ: ${porcentaje}% ${emojiShip}`;

  enviarMensajeGlobal(mensajeShip, getRandomColor());
  return false;
},

"!troll": (player, targetName) => {
  if (!targetName) {
      enviarMensajePrivado(player.id, "❌ ᴜsᴀ: !ᴛʀᴏʟʟ @ᴊᴜɢᴀᴅᴏʀ", 0xFF5555);
      return false;
  }

  const target = encontrarJugadorPorNombre(targetName);
  if (!target) {
      enviarMensajePrivado(player.id, "❌ ᴊᴜɢᴀᴅᴏʀ ɴᴏ ᴇɴᴄᴏɴᴛʀᴀᴅᴏ", 0xFF5555);
      return false;
  }

  const accion = TROLL_ACTIONS[Math.floor(Math.random() * TROLL_ACTIONS.length)]
      .replace("{jugador1}", player.name)
      .replace("{jugador2}", target.name);

  enviarMensajeGlobal(
      `🤡 ${player.name} ᴛʀᴏʟʟᴇó ᴀ ${target.name}:\n${accion}`,
      getRandomColor()
  );

  return false;
},

"!size": (player) => {
  if (comandos.checkCooldown(player.id, "!size")) {
      const segundos = comandos.getCooldownTime(player.id, "!size");
      enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴜsᴀʀ ᴇsᴛᴇ ᴄᴏᴍᴀɴᴅᴏ ɴᴜᴇᴠᴀᴍᴇɴᴛᴇ`, 0xFFB74D);
      return false;
  }

  const numero = Math.floor(Math.random() * 27) + 1;
  enviarMensajeGlobal(`📏 ᴀ ${player.name} ʟᴇ ᴍɪᴅᴇ ${numero} ᴄᴍ`, getRandomColor());

  comandos.setCooldown(player.id, "!size");
  return false;
},

"!indice": (player) => {
  if (comandos.checkCooldown(player.id, "!indice")) {
      const segundos = comandos.getCooldownTime(player.id, "!indice");
      enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴜsᴀʀ ᴇsᴛᴇ ᴄᴏᴍᴀɴᴅᴏ ɴᴜᴇᴠᴀᴍᴇɴᴛᴇ`, 0xFFB74D);
      return false;
  }

  const numero = Math.floor(Math.random() * 100) + 1;
  enviarMensajeGlobal(`📊 ɪ́ɴᴅɪᴄᴇ ᴅᴇ ᴍᴀʟᴏ ᴅᴇ ${player.name}: ${numero}%`, getRandomColor());

  comandos.setCooldown(player.id, "!indice");
  return false;
},

"!dado": (player) => {
  if (comandos.checkCooldown(player.id, "!dado")) {
      const segundos = comandos.getCooldownTime(player.id, "!dado");
      enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴜsᴀʀ ᴇsᴛᴇ ᴄᴏᴍᴀɴᴅᴏ ɴᴜᴇᴠᴀᴍᴇɴᴛᴇ`, 0xFFB74D);
      return false;
  }

  const numero = Math.floor(Math.random() * 6) + 1;
  enviarMensajeGlobal(`🎲 ${player.name} sᴀᴄó ᴜɴ ${numero}`, getRandomColor());

  comandos.setCooldown(player.id, "!dado");
  return false;
},

"!discord": (player) => {
  enviarMensajePrivado(player.id, 
      "╔══════════════════╗\n   💬 ᴅɪsᴄᴏʀᴅ sᴇʀᴠᴇʀ   \n╚══════════════════╝\n" +
      "ʜᴛᴛᴘs://ᴅɪsᴄᴏʀᴅ.ɢɢ/6ᴋᴅ2x22ɢᴅʏ", 
      getRandomColor()
  );
  return false;
},

"!frase": (player) => {
  if (comandos.checkCooldown(player.id, "!frase")) {
      const segundos = comandos.getCooldownTime(player.id, "!frase");
      enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴏᴛʀᴀ ꜰʀᴀsᴇ.`, 0xFFB74D);
      return false;
  }

  const frase = getRandomPhrase(frasesAleatorias);
  enviarMensajeGlobal(frase.texto, getRandomColor());

  comandos.setCooldown(player.id, "!frase");
  return false;
},

"!bb": (player) => {
  const frase = getRandomPhrase(frasesKick);
  room.kickPlayer(player.id, frase, false);
  enviarMensajeGlobal(`${frase} - ${player.name} ꜰᴜᴇ ᴇxᴘᴜʟsᴀᴅᴏ`, getRandomColor());
  return false;
},

"!ruleta": (player, numero) => {
  if (!numero || isNaN(numero)) {
      enviarMensajePrivado(player.id, "❌ ᴜsᴏ: !ʀᴜʟᴇᴛᴀ [ɴúᴍᴇʀᴏ ᴅᴇʟ 1 ᴀʟ 10]", 0xFF6D6D);
      return false;
  }

  const num = parseInt(numero);
  if (num < 1 || num > 10) {
      enviarMensajePrivado(player.id, "❌ ᴇʟ ɴúᴍᴇʀᴏ ᴅᴇʙᴇ ᴇsᴛᴀʀ ᴇɴᴛʀᴇ 1 ʏ 10", 0xFF6D6D);
      return false;
  }

  if (comandos.checkCooldown(player.id, "!ruleta")) {
      const segundos = comandos.getCooldownTime(player.id, "!ruleta");
      enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴊᴜɢᴀʀ ᴏᴛʀᴀ ʀᴜʟᴇᴛᴀ.`, 0xFFB74D);
      return false;
  }

  const ganador = Math.floor(Math.random() * 10) + 1;
  if (num === ganador) {
      const frase = getRandomPhrase(frasesRuletaGanar);
      enviarMensajeGlobal(frase.replace("{numero}", num), getRandomColor());
  } else {
      const frase = getRandomPhrase(frasesRuletaPerder);
      enviarMensajeGlobal(frase.replace("{numero}", num), getRandomColor());
  }

  comandos.setCooldown(player.id, "!ruleta");
  return false;
},

"!ms": (player) => {
  if (comandos.checkCooldown(player.id, "!ms")) {
      const segundos = comandos.getCooldownTime(player.id, "!ms");
      enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴜsᴀʀ ᴇsᴛᴇ ᴄᴏᴍᴀɴᴅᴏ ɴᴜᴇᴠᴀᴍᴇɴᴛᴇ`, 0xFFB74D);
      return false;
  }

  const frase = frasesMusi[Math.floor(Math.random() * frasesMusi.length)];
  enviarMensajeGlobal(`💬 ${frase}`, getRandomColor());

  comandos.setCooldown(player.id, "!ms");
  return false;
},

// ======================
// SISTEMA DE ESTADÍSTICAS Y ROLES
// ======================
"!stats": (player) => {
  roleSystem.showAllStats(player.id);
  return false;
},

"!allstats": (player, targetName) => {
  if (!targetName) {
      roleSystem.showAllStats(player.id);
  } else {
      const targetPlayer = room.getPlayerList().find(p => 
          p.name.toLowerCase().includes(targetName.toLowerCase())
      );
      if (targetPlayer) {
          roleSystem.showAllStats(targetPlayer.id);
      } else {
          enviarMensajePrivado(player.id, "❌ ᴊᴜɢᴀᴅᴏʀ ɴᴏ ᴇɴᴄᴏɴᴛʀᴀᴅᴏ", 0xFF6D6D);
      }
  }
  return false;
},

"!rstats": (player, targetName) => {
  return roleSystem.resetStats(player, targetName);
},

"!top": (player) => {
  roleSystem.showTopPlayers();
  return false;
},

"!roles": (player) => {
  let message = "🎖️ ʀᴏʟᴇs ᴅɪsᴘᴏɴɪʙʟᴇs:\n";
  message += "━━━━━━━━━━━━━━━━━━━━━━━━\n";

  Object.entries(ROLES_CONFIG).forEach(([role, config]) => {
      message += `${config.tag}: ${config.description} • ➤ ᴠɪᴄᴛᴏʀɪᴀs: ${config.winsRequired}\n`;
  });

  message += "━━━━━━━━━━━━━━━━━━━━━━━━";
  enviarMensajePrivado(player.id, message, getRandomColor());
  return false;
},

"!topgoles": (player) => {
  const top = Object.entries(playerStats)
    .sort((a, b) => (b[1].goals || 0) - (a[1].goals || 0))
    .slice(0, 10)
    .map(([id, stats], i) => 
      `${i+1}. ${stats.lastKnownName || "ᴊᴜɢᴀᴅᴏʀ"}: ${stats.goals || 0}ɢ`);

  enviarMensajeGlobal("🏆 ᴛᴏᴘ 10 ɢᴏʟᴇᴀᴅᴏʀᴇs: " + top.join(" • "), getRandomColor());
  return false;
},

"!topasistencias": (player) => {
  const top = Object.entries(playerStats)
    .sort((a, b) => (b[1].assists || 0) - (a[1].assists || 0))
    .slice(0, 10)
    .map(([id, stats], i) => 
      `${i+1}. ${stats.lastKnownName || "ᴊᴜɢᴀᴅᴏʀ"}: ${stats.assists || 0}ᴀ`);

  enviarMensajeGlobal("🎯 ᴛᴏᴘ 10 ᴀsɪsᴛᴇɴᴄɪᴀs: " + top.join(" • "), getRandomColor());
  return false;
},

"!topcs": (player) => {
  const top = Object.entries(playerStats)
    .sort((a, b) => (b[1].cs || 0) - (a[1].cs || 0))
    .slice(0, 10)
    .map(([id, stats], i) => 
      `${i+1}. ${stats.lastKnownName || "ᴊᴜɢᴀᴅᴏʀ"}: ${stats.cs || 0}ᴄs`);

  enviarMensajeGlobal("🧤 ᴛᴏᴘ 10 ᴄʟᴇᴀɴ sʜᴇᴇᴛs: " + top.join(" • "), getRandomColor());
  return false;
},

// ======================
// COMANDOS DE ADMINISTRACIÓN
// ======================
"!rr": (player) => {
  if (!player.admin) {
      enviarMensajePrivado(player.id, "❌ sᴏʟᴏ ᴀᴅᴍɪɴs ᴘᴜᴇᴅᴇɴ ʀᴇɪɴɪᴄɪᴀʀ ᴇʟ ᴘᴀʀᴛɪᴅᴏ", 0xFF6D6D);
      return false;
  }

  enviarMensajeGlobal("🔄 ʀᴇɪɴɪᴄɪᴀɴᴅᴏ ᴘᴀʀᴛɪᴅᴏ ᴇɴ 1 sᴇɢᴜɴᴅᴏ...", getRandomColor());

  setTimeout(() => {
      room.stopGame();
      setTimeout(() => {
          room.startGame();
      }, 500);
  }, 1000);

  return false;
},

"!swap": (player) => {
  if (!player.admin) {
      enviarMensajePrivado(player.id, "❌ sᴏʟᴏ ᴀᴅᴍɪɴs ᴘᴜᴇᴅᴇɴ ᴄᴀᴍʙɪᴀʀ ᴇǫᴜɪᴘᴏs", 0xFF6D6D);
      return false;
  }

  const players = room.getPlayerList();
  players.forEach(p => {
      if (p.team !== 0) {
          room.setPlayerTeam(p.id, p.team === 1 ? 2 : 1);
      }
  });
  enviarMensajeGlobal("🔄 ᴇǫᴜɪᴘᴏs ɪɴᴛᴇʀᴄᴀᴍʙɪᴀᴅᴏs ᴘᴏʀ ᴀᴅᴍɪɴ", getRandomColor());
  return false;
},

"!fill": (player) => {
  if (!player.admin) {
      enviarMensajePrivado(player.id, "❌ sᴏʟᴏ ᴀᴅᴍɪɴs ᴘᴜᴇᴅᴇɴ ᴜsᴀʀ !ꜰɪʟʟ", 0xFF6D6D);
      return false;
  }

  const players = room.getPlayerList();
  const specPlayers = players.filter(p => p.team === 0 && p.id !== 0 && !jugadoresAFK.has(p.id));
  const redCount = players.filter(p => p.team === 1).length;
  const blueCount = players.filter(p => p.team === 2).length;

  if (redCount >= MAX_JUGADORES_POR_EQUIPO && blueCount >= MAX_JUGADORES_POR_EQUIPO) {
      enviarMensajeGlobal("⚖️ ʏᴀ ʜᴀʏ 4ᴠ4. ɴᴏ sᴇ ᴘᴜᴇᴅᴇ ʟʟᴇɴᴀʀ ᴍás.", getRandomColor());
      return false;
  }

  if (specPlayers.length === 0) {
      enviarMensajeGlobal("👀 ɴᴏ ʜᴀʏ ᴊᴜɢᴀᴅᴏʀᴇs ᴅɪsᴘᴏɴɪʙʟᴇs ᴇɴ ᴇsᴘᴇᴄᴛᴀᴅᴏʀ.", getRandomColor());
      return false;
  }

  let targetTeam = redCount <= blueCount ? 1 : 2;
  let movedPlayers = 0;

  specPlayers.forEach(p => {
      if ((targetTeam === 1 && redCount + movedPlayers < MAX_JUGADORES_POR_EQUIPO) || 
          (targetTeam === 2 && blueCount + movedPlayers < MAX_JUGADORES_POR_EQUIPO)) {
          room.setPlayerTeam(p.id, targetTeam);
          movedPlayers++;
          targetTeam = targetTeam === 1 ? 2 : 1;
      }
  });

  enviarMensajeGlobal(
      `🔀 ${movedPlayers} ᴊᴜɢᴀᴅᴏʀ(ᴇs) ᴍᴏᴠɪᴅᴏs ᴀ ᴇǫᴜɪᴘᴏs (${redCount + (targetTeam === 2 ? movedPlayers : 0)}ᴠ${blueCount + (targetTeam === 1 ? movedPlayers : 0)})`, 
      getRandomColor()
  );
  return false;
},

"!afk": (player) => {
  if (jugadoresAFK.has(player.id)) {
      jugadoresAFK.delete(player.id);
      enviarMensajePrivado(player.id, "✅ ʏᴀ ɴᴏ ᴇsᴛás ᴀꜰᴋ", getRandomColor());
  } else {
      if (player.team !== 0) {
          room.setPlayerTeam(player.id, 0);
      }
      jugadoresAFK.add(player.id);
      enviarMensajePrivado(player.id, "💤 ᴀʜᴏʀᴀ ᴇsᴛás ᴀꜰᴋ (ɴᴏ ᴛᴇ ᴍᴏᴠᴇʀáɴ ᴅᴇ ᴇsᴘᴇᴄᴛᴀᴅᴏʀᴇs)", getRandomColor());
  }
  return false;
},

"!mute": (player, args) => {
  if (!player.admin) {
      enviarMensajePrivado(player.id, "❌ sᴏʟᴏ ᴀᴅᴍɪɴs ᴘᴜᴇᴅᴇɴ ᴜsᴀʀ !ᴍᴜᴛᴇ", 0xFF6D6D);
      return false;
  }

  const [nombre, minutosStr] = args.split(/ (.+)/);
  const minutos = parseInt(minutosStr);

  if (!nombre || isNaN(minutos) || minutos < 1 || minutos > 60) {
      enviarMensajePrivado(player.id, "❌ ᴜsᴏ: !ᴍᴜᴛᴇ @ɴᴏᴍʙʀᴇ ᴍɪɴᴜᴛᴏs (1-60)", 0xFF6D6D);
      return false;
  }

  const target = encontrarJugadorPorNombre(nombre);
  if (!target) {
      enviarMensajePrivado(player.id, "❌ ᴊᴜɢᴀᴅᴏʀ ɴᴏ ᴇɴᴄᴏɴᴛʀᴀᴅᴏ", 0xFF6D6D);
      return false;
  }

  const tiempoMute = Date.now() + minutos * 60000;
  jugadoresMuteados.set(target.id, tiempoMute);
  enviarMensajeGlobal(`🔇 ${target.name} ᴍᴜᴛᴇᴀᴅᴏ ᴘᴏʀ ${minutos} ᴍɪɴᴜᴛᴏ(s)`, getRandomColor());

  setTimeout(() => {
      if (jugadoresMuteados.has(target.id)) {
          jugadoresMuteados.delete(target.id);
          enviarMensajePrivado(target.id, "🎤 ʏᴀ ᴘᴜᴇᴅᴇs ʜᴀʙʟᴀʀ ᴅᴇ ɴᴜᴇᴠᴏ", getRandomColor());
      }
  }, minutos * 60000);

  return false;
},

"!8ball": (player, pregunta) => {
    if (!pregunta || !pregunta.trim().endsWith("?")) {
        enviarMensajePrivado(player.id, "❌ ʜᴀᴢ ᴜɴᴀ ᴘʀᴇɢᴜɴᴛᴀ ᴛᴇʀᴍɪɴᴀᴅᴀ ᴇɴ '?': !8ʙᴀʟʟ ¿ɢᴀɴᴀʀé ᴇʟ ᴘᴀʀᴛɪᴅᴏ?", 0xFF6D6D);
        return false;
    }

    if (comandos.checkCooldown(player.id, "!8ball")) {
        const segundos = comandos.getCooldownTime(player.id, "!8ball");
        enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴄᴏɴsᴜʟᴛᴀʀ ᴏᴛʀᴀ ᴠᴇᴢ.`, 0xFFB74D);
        return false;
    }

    const respuestas = [
        "⚽ sɪ́, ᴘᴇʀᴏ sᴏʟᴏ sɪ ᴊᴜᴇɢᴀs ᴄᴏɴ ʟᴀs ᴍᴀɴᴏs (ᴏʜ ᴡᴀɪᴛ...)",
        "💀 ɴᴏ. ʏ ᴄᴀᴅᴀ ᴠᴇᴢ ǫᴜᴇ ᴘʀᴇɢᴜɴᴛᴀs, ᴜɴ ᴄᴏɴᴇᴊᴏ ᴍᴜᴇʀᴇ",
        "🍌 50% sɪ́, 50% ɴᴏ, 100% ǫᴜᴇ ʀᴇsʙᴀʟᴀʀᴀ́s",
        "🌀 ʟᴏs ᴀsᴛʀᴏs ᴅɪᴄᴇɴ ǫᴜᴇ sɪ́... ᴘᴇʀᴏ ᴛᴜ ᴄᴏɴᴇxɪᴏ́ɴ ᴅɪᴄᴇ ǫᴜᴇ ɴᴏ",
        "❌ ᴍᴀ́s ᴄʟᴀʀᴏ ǫᴜᴇ ᴇʟ ᴘɪɴɢ ᴅᴇ ᴜɴ sᴀᴛᴇ́ʟɪᴛᴇ: ɴᴏ",
        "🍀 sɪ́, ᴘᴇʀᴏ sᴏʟᴏ sɪ ᴀᴄᴇᴘᴛᴀs ǫᴜᴇ ꜰᴜᴇ ᴘᴜʀᴀ sᴜᴇʀᴛᴇ",
        "⌛ ʀᴇɪɴᴛᴇɴᴛᴀ ᴅᴇsᴘᴜᴇ́s ᴅᴇʟ ʀᴇɪɴɪᴄɪᴏ ᴅᴇʟ ᴜɴɪᴠᴇʀsᴏ",
        "🎯 ɴɪ ᴇɴ ᴇsᴛᴇ ʜɪᴛʙᴏx ɴɪ ᴇɴ ᴇʟ ᴘʀᴏ́xɪᴍᴏ",
        "🍷 ᴅᴇꜰɪɴɪᴛɪᴠᴀᴍᴇɴᴛᴇ... (ɴᴏᴛᴀ: ᴇʟ ᴏʀᴀ́ᴄᴜʟᴏ ᴇsᴛᴀʙᴀ ʙᴏʀʀᴀᴄʜᴏ)",
        "📜 ʟᴀ ʀᴇsᴘᴜᴇsᴛᴀ ᴇsᴛᴀ́ ᴇɴ ᴇʟ ᴘᴀᴛᴄʜ ɴᴏᴛᴇs ǫᴜᴇ ɴᴀᴅɪᴇ ʟᴇᴇ",
        "💢 sᴏʟᴏ sɪ ᴘᴀsᴀs ᴇʟ ᴛᴜᴛᴏʀɪᴀʟ sɪɴ ʀᴀɢᴇǫᴜɪᴛ",
        "🖥️ ᴅᴇᴘᴇɴᴅᴇ ᴅᴇ ᴄᴜᴀ́ɴᴛᴏs ꜰᴘs ᴛᴇɴɢᴀs",
        "🚫 ᴇʀʀᴏʀ 404: ʀᴇsᴘᴜᴇsᴛᴀ ɴᴏ ᴇɴᴄᴏɴᴛʀᴀᴅᴀ",
        "🤡 ᴄʟᴀʀᴏ, ᴇɴ ᴇʟ ᴜɴɪᴠᴇʀsᴏ ᴅᴏɴᴅᴇ ᴇʀᴇs ʙᴜᴇɴᴏ ᴇɴ ᴇsᴛᴏ"
    ];

    const respuesta = respuestas[Math.floor(Math.random() * respuestas.length)];
    enviarMensajeGlobal(
        `🎱 @${player.name} ᴘʀᴇɢᴜɴᴛᴀ: ${pregunta}\n✨ ʙᴏʟᴀ ᴍᴀ́ɢɪᴄᴀ: "${respuesta}"`,
        getRandomColor()
    );

    comandos.setCooldown(player.id, "!8ball");
    return false;
},

"!doxxeame": (player) => {
    if (comandos.checkCooldown(player.id, "!doxxeame")) {
        const segundos = comandos.getCooldownTime(player.id, "!doxxeame");
        enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴏᴛʀᴏ ᴅᴏxxᴇᴏ.`, 0xFFB74D);
        return false;
    }

    const ipsColombia = ["190.120.231.45", "200.105.178.12", "181.143.67.89"];
    const ipsVenezuela = ["200.35.210.78", "190.202.145.67", "186.94.32.12"];
    const ubicaciones = [
        "ᴍᴇᴅᴇʟʟɪ́ɴ, ᴄᴏʟᴏᴍʙɪᴀ (ᴄᴀʟʟᴇ ᴅᴇʟ ɢᴏʟ ᴘᴇʀᴅɪᴅᴏ)", 
        "ᴄᴀʀᴀᴄᴀs, ᴠᴇɴᴇᴢᴜᴇʟᴀ (ᴀᴠᴇɴɪᴅᴀ ʟᴏs ᴀᴜᴛᴏɢᴏʟᴇs)",
        "ʙᴏɢᴏᴛᴀ́, ᴄᴏʟᴏᴍʙɪᴀ (ᴄᴀʀʀᴇʀᴀ 7 ᴄᴏɴ 'ᴏꜰꜰsɪᴅᴇ')"
    ];
    const datosReales = [
        "ᴊᴜᴇɢᴀ ᴄᴏɴ ʟᴏs ᴘɪᴇs 🦶⚽", 
        "ᴛɪᴇɴᴇ ʟᴀɢ ᴍᴇɴᴛᴀʟ 🧠⌛", 
        "ᴄᴏɴꜰᴜɴᴅᴇ ᴇʟ ᴀᴜᴛᴏᴘᴀsᴇ ᴄᴏɴ ᴜɴ ʀɪᴛᴜᴀʟ sᴀᴛᴀ́ɴɪᴄᴏ 😈🔥"
    ];

    const ip = Math.random() > 0.5 ? 
        ipsColombia[Math.floor(Math.random() * ipsColombia.length)] : 
        ipsVenezuela[Math.floor(Math.random() * ipsVenezuela.length)];
    const ubicacion = ubicaciones[Math.floor(Math.random() * ubicaciones.length)];
    const dato = datosReales[Math.floor(Math.random() * datosReales.length)];

    enviarMensajeGlobal(
        `╔══════════════════════════════╗\n` +
        `🕵️‍♂️ @${player.name} sᴇ ᴅᴏxxᴇᴏ́ ᴠᴏʟᴜɴᴛᴀʀɪᴀᴍᴇɴᴛᴇ\n` +
        `├──────────────────────────────\n` +
        `📌 ɪᴘ: ${ip} • 📍 ᴜʙɪᴄᴀᴄɪᴏ́ɴ: ${ubicacion}\n` +
        `⚽ ᴅᴀᴛᴏ ʀᴇᴀʟ: ${dato}\n` +
        `╚══════════════════════════════╝`,
        getRandomColor()
    );

    comandos.setCooldown(player.id, "!doxxeame");
    return false;
},

"!doxxeo": (player, nombreVictima) => {
    if (!nombreVictima) {
        enviarMensajePrivado(player.id, "❌ ᴇᴊᴇᴍᴘʟᴏ: !ᴅᴏxxᴇᴏ @ᴜsᴜᴀʀɪᴏ", 0xFF6D6D);
        return false;
    }

    if (comandos.checkCooldown(player.id, "!doxxeo")) {
        const segundos = comandos.getCooldownTime(player.id, "!doxxeo");
        enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴏᴛʀᴏ ᴅᴏxxᴇᴏ.`, 0xFFB74D);
        return false;
    }

    const victima = encontrarJugadorPorNombre(nombreVictima);
    if (!victima) {
        enviarMensajePrivado(player.id, "❌ ᴊᴜɢᴀᴅᴏʀ ɴᴏ ᴇɴᴄᴏɴᴛʀᴀᴅᴏ.", 0xFF6D6D);
        return false;
    }

    const ipsColombia = [
        "190.120.231.45", "200.105.178.12", "181.143.67.89",
        "186.80.112.34", "190.254.29.56", "170.52.156.78",
        "181.129.45.90", "190.90.201.33", "200.41.68.155", "186.116.78.99"
    ];
    const ipsVenezuela = [
        "200.35.210.78", "190.202.145.67", "186.94.32.12",
        "200.3.156.45", "190.104.27.89", "190.85.120.34",
        "200.44.192.66", "190.216.88.53", "200.73.91.24", "190.6.77.128"
    ];
    const ubicaciones = [
        "ᴍᴇᴅᴇʟʟɪ́ɴ, ᴄᴏʟᴏᴍʙɪᴀ (ᴄᴀʟʟᴇ ᴅᴇʟ ɢᴏʟ ᴘᴇʀᴅɪᴅᴏ)", 
        "ᴄᴀʀᴀᴄᴀs, ᴠᴇɴᴇᴢᴜᴇʟᴀ (ᴀᴠᴇɴɪᴅᴀ ʟᴏs ᴀᴜᴛᴏɢᴏʟᴇs)",
        "ʙᴜʟᴇᴠᴀʀ ᴅᴇ ʟᴏs ᴀᴜᴛᴏɢᴏʟᴇs (ᴋᴍ 3 ᴅᴇ ʟᴀ ᴀᴜᴛᴏᴘɪsᴛᴀ ᴅᴇ ʟᴀ ᴅᴇʀʀᴏᴛᴀ)",
        "ᴄᴀʟʟᴇᴊᴏ́ɴ ᴅᴇʟ ʟᴀɢ ᴄʀᴏ́ɴɪᴄᴏ (ᴇsǫᴜɪɴᴀ ᴄᴏɴ ʟᴀ ᴀᴠᴇɴɪᴅᴀ ᴅᴇʟ ᴛɪᴍᴇᴏᴜᴛ)",
        "ᴜʀʙᴀɴɪᴢᴀᴄɪᴏ́ɴ ʟᴏs ᴀʟᴍᴏsᴛ ɢᴏʟ (sᴇᴄᴛᴏʀ 404 - ɴᴏ ᴇɴᴄᴏɴᴛʀᴀᴅᴏ)",
        "ʀᴇsɪᴅᴇɴᴄɪᴀs ᴇʟ ᴄᴏɴᴛʀᴏʟ ᴄʜᴜᴇᴄᴏ (ᴀʟ ʟᴀᴅᴏ ᴅᴇʟ ᴄʏʙᴇʀ ᴄᴀꜰᴇ 'ʀᴀᴍ ᴇxᴘʟᴏᴛᴀᴅᴏ')",
        "ᴀᴠᴇɴɪᴅᴀ ʟᴏs ᴘᴀsᴇs ʜᴏʀʀɪʙʟᴇs (ᴇɴᴛʀᴇ ʟᴀ ᴄᴀʟʟᴇ ᴅᴇʟ ᴏꜰꜰsɪᴅᴇ ʏ ᴇʟ ᴄᴀʟʟᴇᴊᴏ́ɴ ᴅᴇʟ ʀᴀɢᴇǫᴜɪᴛ)",
        "ʙᴀʀʀɪᴏ ᴛᴇᴄʟᴀᴅᴏ ᴍᴏᴄʜᴏ (ᴢᴏɴᴀ ᴅᴇ ᴛᴇᴄʟᴀs ꜰᴀʟᴛᴀɴᴛᴇs)",
        "ᴄᴏɴᴊᴜɴᴛᴏ ʀᴇsɪᴅᴇɴᴄɪᴀʟ ᴇʟ ᴅʀɪʙʟᴇ ɪᴍᴘᴏsɪʙʟᴇ (ᴇᴅɪꜰɪᴄɪᴏ ʟᴀɢ, ᴘɪsᴏ 10, ᴀᴘᴛᴏ. 300ᴍs)",
        "ʙᴜʟᴇᴠᴀʀ ᴅᴇ ʟᴏs ᴍᴀʟᴏs ᴍᴇᴍᴇs (ꜰʀᴇɴᴛᴇ ᴀʟ ᴇsᴛᴀᴅɪᴏ ᴅᴇ ʟᴏs ᴄʜɪsᴛᴇs ʀᴇᴘᴇ)",
        "ᴜʀʙᴀɴɪᴢᴀᴄɪᴏ́ɴ ʟᴀ ᴘᴀɴᴛᴀʟʟᴀ ᴀᴢᴜʟ (sᴇᴄᴛᴏʀ ᴄᴛʀʟ+ᴀʟᴛ+ᴅᴇʟ)",
        "ᴄᴀʟʟᴇ ᴅᴇʟ ɢᴏʟ ꜰᴀɴᴛᴀsᴍᴀ (ᴅᴏɴᴅᴇ ᴛᴏᴅᴏs ᴊᴜʀᴀɴ ǫᴜᴇ ᴇɴᴛʀᴏ́ ᴘᴇʀᴏ ᴇʟ ʀᴇᴘʟᴀʏ ɴᴏ ᴍᴜᴇsᴛʀᴀ ɴᴀᴅᴀ)",
        "ʙᴏɢᴏᴛᴀ́, ᴄᴏʟᴏᴍʙɪᴀ (ᴄᴀʀʀᴇʀᴀ 7 ᴄᴏɴ 'ᴏꜰꜰsɪᴅᴇ')"
    ];

    const datosReales = [
        "ᴊᴜᴇɢᴀ ᴄᴏɴ ʟᴏs ᴘɪᴇs 🦶⚽",
        "ᴛɪᴇɴᴇ ʟᴀɢ ᴍᴇɴᴛᴀʟ 🧠⌛",
        "ᴛɪᴇɴᴇ ᴍᴀ́s ʟᴀɢ ᴍᴇɴᴛᴀʟ ǫᴜᴇ ꜰᴘs ᴇɴ ᴜɴ ᴄɪʙᴇʀᴄᴀꜰᴇ́ ᴅᴇ ʟᴏs 2000 🧠",
        "sᴜ ᴛᴇᴄʟᴀᴅᴏ sᴏʟᴏ ᴛɪᴇɴᴇ 3 ᴛᴇᴄʟᴀs ꜰᴜɴᴄɪᴏɴᴀʟᴇs: ᴡᴀsᴅ (ʟᴀs ᴅᴇᴍᴀ́s ʟᴀs ᴍᴏʀᴅɪᴏ́ ᴅᴇ ʀᴀɢᴇ) 💢",
        "ᴄᴇʟᴇʙʀᴀ ʟᴏs ᴄᴏ́ʀɴᴇʀs ᴄᴏᴍᴏ sɪ ꜰᴜᴇʀᴀɴ ɢᴏʟᴇs (ᴇs ʟᴏ ᴍᴀ́s ᴄᴇʀᴄᴀ ǫᴜᴇ ʟʟᴇɢᴀ ᴀʟ ᴀʀᴄᴏ) ⚽",
        "sᴜ ᴍᴏᴜsᴇ ᴛɪᴇɴᴇ ᴘᴛsᴅ ᴅᴇ ᴛᴀɴᴛᴏ ᴍɪsᴄʟɪᴄᴋᴇᴀʀ (ᴄʟɪᴄᴋ ᴅᴇʀᴇᴄʜᴏ ᴛʀᴀᴜᴍᴀᴅᴏ) 🖱️",
        "ᴄᴏɴꜰᴜɴᴅᴇ ᴇʟ ᴀᴜᴛᴏᴘᴀsᴇ ᴄᴏɴ ᴜɴ ʀɪᴛᴜᴀʟ sᴀᴛᴀ́ɴɪᴄᴏ (ʏ ᴀ ᴠᴇᴄᴇs ꜰᴜɴᴄɪᴏɴᴀ) 😈",
        "ᴛɪᴇɴᴇ ᴍᴀ́s ᴇxᴄᴜsᴀs ǫᴜᴇ ɢᴏʟᴇs ᴇɴ sᴜ ʜɪsᴛᴏʀɪᴀʟ ('¡ᴇʀᴀ ʟᴀɢ!') 📉",
        "ᴊᴜᴇɢᴀ ᴄᴏᴍᴏ sɪ ᴛᴜᴠɪᴇʀᴀ ʟᴏs ᴄᴏɴᴛʀᴏʟᴇs ᴇɴ ᴍᴏᴅᴏ ᴇsᴘᴇᴊᴏ (↑ = ↓, ← = →) 🔄",
        "sᴜ ᴄᴏɴᴇxɪᴏ́ɴ ᴇs ᴍᴀ́s ɪɴᴇsᴛᴀʙʟᴇ ǫᴜᴇ ᴇᴄᴏɴᴏᴍɪ́ᴀ ᴇɴ ᴄʀɪsɪs (ᴘɪɴɢ ᴅᴇ 999ᴍs) 💸",
        "ᴄʀᴇᴇ ǫᴜᴇ ᴇʟ ʙᴏᴛᴏ́ɴ 'ʀᴇᴘᴏʀᴛᴀʀ' ᴅᴀ ᴘᴏᴅᴇʀᴇs ᴇsᴘᴇᴄɪᴀʟᴇs (sᴘᴏɪʟᴇʀ: ɴᴏ) ⚡",
        "ᴛᴀ́ᴄᴛɪᴄᴀ sᴇᴄʀᴇᴛᴀ: ᴄᴏʀʀᴇʀ ᴇɴ ᴄɪ́ʀᴄᴜʟᴏs ʜᴀsᴛᴀ ᴍᴀʀᴇᴀʀ ᴀʟ ʀɪᴠᴀʟ (ʏ ᴀ sɪ́ ᴍɪsᴍᴏ) 🌀"
    ];

    const ip = Math.random() > 0.5 ? 
        ipsColombia[Math.floor(Math.random() * ipsColombia.length)] : 
        ipsVenezuela[Math.floor(Math.random() * ipsVenezuela.length)];
    const ubicacion = ubicaciones[Math.floor(Math.random() * ubicaciones.length)];
    const dato = datosReales[Math.floor(Math.random() * datosReales.length)];

    enviarMensajeGlobal(
        `╔══════════════════════════════╗\n` +
        `🕵️‍♂️ @${player.name} ᴅᴏxxᴇᴏ́ ᴀ @${victima.name}\n` +
        `├──────────────────────────────\n` +
        `📌 ɪᴘ: ${ip} • 📍 ᴜʙɪᴄᴀᴄɪᴏ́ɴ: ${ubicacion}\n` +
        `⚽ ᴅᴀᴛᴏ ʀᴇᴀʟ: ${dato}\n` +
        `╚══════════════════════════════╝`,
        getRandomColor()
    );

    comandos.setCooldown(player.id, "!doxxeo");
    return false;
},

"!celebracion": (player) => {
    if (comandos.checkCooldown(player.id, "!celebracion")) {
        const segundos = comandos.getCooldownTime(player.id, "!celebracion");
        enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴏᴛʀᴀ ᴄᴇʟᴇʙʀᴀᴄɪᴏ́ɴ.`, 0xFFB74D);
        return false;
    }

    const celebraciones = [
        `🦍 ${player.name} ᴄᴇʟᴇʙʀᴀ ᴄᴏᴍᴏ ɢᴏʀɪʟᴀ ɢᴏʟᴘᴇᴀɴᴅᴏ sᴜ ᴘᴇᴄʜᴏ... ʏ sᴇ ʟᴇsɪᴏɴᴀ`,
        `🚀 ${player.name} sɪᴍᴜʟᴀ sᴇʀ ᴜɴ ᴄᴏʜᴇᴛᴇ... ᴘᴇʀᴏ ᴅᴇsᴘᴇɢᴀ ʜᴀᴄɪᴀ sᴜ ᴘʀᴏᴘɪᴏ ᴀʀᴄᴏ`,
        `🍌 ${player.name} ʜᴀᴄᴇ ᴇʟ ᴡᴏʀᴍ ʏ ᴛᴇʀᴍɪɴᴀ ᴄᴏᴍɪᴇɴᴅᴏ ᴛɪᴇʀʀᴀ (ʏ ᴜɴᴀ ʙᴀɴᴀɴᴀ ɪᴍᴀɢɪɴᴀʀɪᴀ)`,
        `🎭 ${player.name} ɪɴᴛᴇʀᴘʀᴇᴛᴀ ᴜɴ ᴅʀᴀᴍᴀ sʜᴀᴋᴇsᴘᴇʀɪᴀɴᴏ ᴛʀᴀs ꜰᴀʟʟᴀʀ ᴇʟ ᴘᴇɴᴀʟ`,
        `🤸 ${player.name} ɪɴᴛᴇɴᴛᴀ ᴍᴏʀᴛᴀʟᴇᴛᴀ ᴄᴇʟᴇʙʀᴀᴛᴏʀɪᴀ... ᴀᴛᴇʀʀɪᴢᴀ ᴇɴ ᴏꜰꜰsɪᴅᴇ`,
        `🧙 ${player.name} ʟᴀɴᴢᴀ ʜᴇᴄʜɪᴢᴏ ᴅᴇ ᴠɪᴄᴛᴏʀɪᴀ... ᴇʟ ʙᴀʟᴏ́ɴ sᴇ ᴛʀᴀɴsꜰᴏʀᴍᴀ ᴇɴ ᴘᴀʟᴏᴍᴀ`,
        `🦸 ${player.name} sᴇ ᴄʀᴇᴇ sᴜᴘᴇʀʜᴇ́ʀᴏᴇ... sᴜ ᴄᴀᴘᴀ sᴇ ᴇɴʀᴇᴅᴀ ᴇɴ ᴇʟ ᴛʀᴀᴠᴇsᴀɴ̃ᴏ`,
        `🍕 ${player.name} ᴄᴇʟᴇʙʀᴀ ᴄᴏɴ ᴘɪᴢᴢᴀ ɪᴍᴀɢɪɴᴀʀɪᴀ... sᴇ ᴍᴀɴᴄʜᴀ ʟᴀ ᴄᴀᴍɪsᴇᴛᴀ`,
        `👾 ${player.name} ʜᴀᴄᴇ ʙᴀɪʟᴇ ᴅᴇ 8-ʙɪᴛs... ɢʟɪᴛᴄʜᴇᴀ ᴇɴ ᴍɪᴛᴀᴅ ᴅᴇ ʟᴀ ᴄᴀɴᴄʜᴀ`,
        `🧟 ${player.name} ᴄᴇʟᴇʙʀᴀ ᴄᴏᴍᴏ ᴢᴏᴍʙɪᴇ... ʟᴏs ʀɪᴠᴀʟᴇs ʜᴜʏᴇɴ (ᴅᴇ ʟᴀ ᴠᴇʀɢᴜ̈ᴇɴᴢᴀ ᴀᴊᴇɴᴀ)`
    ];

    const celebracion = celebraciones[Math.floor(Math.random() * celebraciones.length)];
    enviarMensajeGlobal(`🎉 ${celebracion}`, getRandomColor());

    comandos.setCooldown(player.id, "!celebracion");
    return false;
},

"!simular": (player) => {
    if (comandos.checkCooldown(player.id, "!simular")) {
        const segundos = comandos.getCooldownTime(player.id, "!simular");
        enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴏᴛʀᴀ sɪᴍᴜʟᴀᴄɪᴏ́ɴ.`, 0xFFB74D);
        return false;
    }

    const simulaciones = [
        `🌪️ ʜᴜʀᴀᴄᴀ́ɴ ᴅᴇ ᴍᴇᴍᴇs ᴀʀʀᴀsᴀ ᴄᴀɴᴄʜᴀ. ${player.name} ᴇs ᴄᴜʟᴘᴀʙʟᴇ`,
        `🦄 ᴜɴɪᴄᴏʀɴɪᴏ ʀᴏʙᴀ ᴇʟ ʙᴀʟᴏ́ɴ. ${player.name} ʟᴏ ᴘᴇʀsɪɢᴜᴇ ʏ ᴘɪᴇʀᴅᴇ`,
        `🍌 ʟʟᴜᴇᴠᴇɴ ᴄᴀ́sᴄᴀʀᴀs. ${player.name} ᴇs ʟᴀ ᴜ́ɴɪᴄᴀ ᴠɪ́ᴄᴛɪᴍᴀ`,
        `👻 ꜰᴀɴᴛᴀsᴍᴀ ᴏꜰꜰsɪᴅᴇ ᴘᴏsᴇᴇ ᴀ ${player.name}. ¡ꜰᴀʟʟᴏ́ sᴇɢᴜʀᴏ!`,
        `🤖 ᴅʀᴏɴ ᴅᴇ ᴛɪᴋᴛᴏᴋ ᴅɪsᴛʀᴀᴇ ᴀ ${player.name}. ᴇʀʀᴏʀ 404: ᴇɴꜰᴏǫᴜᴇ`,
        `🍕 ᴏʟᴏʀ ᴀ ᴘɪᴢᴢᴀ ʜɪᴘɴᴏᴛɪᴢᴀ ᴀ ${player.name}. ᴘɪᴇʀᴅᴇ ᴇʟ ʙᴀʟᴏ́ɴ`,
        `🦜 ʟᴏʀᴏ ɢʀɪᴛᴀ '¡ᴍᴀʟᴀ!'. ${player.name} ᴅᴜᴅᴀ ʏ ꜰᴀʟʟᴀ`,
        `📱 ɴᴏᴛɪꜰɪᴄᴀᴄɪᴏ́ɴ ᴅᴇ ᴛɪɴᴅᴇʀ. ${player.name} ᴘɪᴇʀᴅᴇ ʟᴀ ᴊᴜɢᴀᴅᴀ`,
        `🕳️ ᴀɢᴜᴊᴇʀᴏ ᴅᴇ ɢᴜsᴀɴᴏ ᴀᴘᴀʀᴇᴄᴇ. ${player.name} ᴘᴀᴛᴇᴀ ᴀʟ ᴠᴀᴄɪ́ᴏ`,
        `🎮 ᴄᴏɴᴛʀᴏʟ sᴇ ᴅᴇsᴄᴏɴᴇᴄᴛᴀ. ${player.name} ǫᴜᴇᴅᴀ ᴇɴ ᴍᴏᴅᴏ ᴀꜰᴋ`
    ];

    const simulacion = simulaciones[Math.floor(Math.random() * simulaciones.length)];
    enviarMensajeGlobal(simulacion, getRandomColor());

    comandos.setCooldown(player.id, "!simular");
    return false;
},

"!apostar": (player, equipo) => {
    if (!apuestas.votacionAbierta) {
        enviarMensajePrivado(player.id, "❌ ʟᴀs ᴀᴘᴜᴇsᴛᴀs ᴇsᴛᴀ́ɴ ᴄᴇʀʀᴀᴅᴀs", 0xFF6D6D);
        return false;
    }

    if (!equipo || !["ʀᴇᴅ", "ʙʟᴜᴇ"].includes(equipo.toLowerCase())) {
        enviarMensajePrivado(player.id, "❌ ᴜsᴏ: !ᴀᴘᴏsᴛᴀʀ [ʀᴇᴅ/ʙʟᴜᴇ]", 0xFF6D6D);
        return false;
    }

    apuestas.red.delete(player.id);
    apuestas.blue.delete(player.id);

    if (equipo.toLowerCase() === "ʀᴇᴅ") {
        apuestas.red.add(player.id);
        enviarMensajeGlobal(`🔴 ${player.name} ʜᴀ ᴀᴘᴏsᴛᴀᴅᴏ ᴘᴏʀ ʀᴇᴅ`, getRandomColor());
    } else {
        apuestas.blue.add(player.id);
        enviarMensajeGlobal(`🔵 ${player.name} ʜᴀ ᴀᴘᴏsᴛᴀᴅᴏ ᴘᴏʀ ʙʟᴜᴇ`, getRandomColor());
    }

    const tiempoRestante = Math.ceil((TIEMPO_VOTACION * 1000 - (Date.now() - apuestas.tiempoInicio)) / 1000);
    enviarMensajeGlobal(
        `🎰 ᴀᴘᴜᴇsᴛᴀs: 🔴 ${apuestas.red.size} ᴠs 🔵 ${apuestas.blue.size} (${tiempoRestante}s ʀᴇsᴛᴀɴᴛᴇs)`,
        getRandomColor()
    );
    return false;
},

"!insulto": (player, targetName) => {
    if (comandos.checkCooldown(player.id, "!insulto")) {
        const segundos = comandos.getCooldownTime(player.id, "!insulto");
        enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴜsᴀʀ ᴇsᴛᴇ ᴄᴏᴍᴀɴᴅᴏ ɴᴜᴇᴠᴀᴍᴇɴᴛᴇ`, 0xFFB347);
        return false;
    }

    if (!targetName) {
        enviarMensajePrivado(player.id, "❌ ᴜsᴏ: !ɪɴsᴜʟᴛᴏ @ᴊᴜɢᴀᴅᴏʀ", 0xFF6961);
        return false;
    }

    const target = encontrarJugadorPorNombre(targetName);
    if (!target) {
        enviarMensajePrivado(player.id, "❌ ᴊᴜɢᴀᴅᴏʀ ɴᴏ ᴇɴᴄᴏɴᴛʀᴀᴅᴏ", 0xFF6961);
        return false;
    }

    const insulto = getRandomPhrase(insultosDivertidos);
    enviarMensajeGlobal(`💢 ${player.name} ɪɴsᴜʟᴛᴀ ᴀ ${target.name}: ${insulto}`, getRandomColor());

    comandos.setCooldown(player.id, "!insulto");
    return false;
},

"!chiste": (player) => {
    if (comandos.checkCooldown(player.id, "!chiste")) {
        const segundos = comandos.getCooldownTime(player.id, "!chiste");
        enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴜsᴀʀ ᴇsᴛᴇ ᴄᴏᴍᴀɴᴅᴏ ɴᴜᴇᴠᴀᴍᴇɴᴛᴇ`, 0xFFB347);
        return false;
    }

    const chiste = getRandomPhrase(chistes);
    enviarMensajeGlobal(`🎭 ${player.name} ᴄᴜᴇɴᴛᴀ ᴜɴ ᴄʜɪsᴛᴇ: ${chiste}`, getRandomColor());

    comandos.setCooldown(player.id, "!chiste");
    return false;
},

"!clima": (player) => {
    if (comandos.checkCooldown(player.id, "!clima")) {
        const segundos = comandos.getCooldownTime(player.id, "!clima");
        enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴜsᴀʀ ᴇsᴛᴇ ᴄᴏᴍᴀɴᴅᴏ ɴᴜᴇᴠᴀᴍᴇɴᴛᴇ`, 0xFFB347);
        return false;
    }

    const clima = getRandomPhrase(climas);
    enviarMensajeGlobal(`🌤️ ʀᴇᴘᴏʀᴛᴇ ᴅᴇʟ ᴄʟɪᴍᴀ ᴇɴ ʟᴀ sᴀʟᴀ: ${clima}`, getRandomColor());

    comandos.setCooldown(player.id, "!clima");
    return false;
},

"!azar": (player) => {
    const ahora = Date.now();
    const ultimoUso = comandos.cooldowns[`${player.id}_!azar`] || 0;

    if (!player.admin && ahora - ultimoUso < COOLDOWN_SORTEO) {
        const segundos = Math.ceil((COOLDOWN_SORTEO - (ahora - ultimoUso)) / 1000);
        enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴏᴛʀᴏ sᴏʀᴛᴇᴏ.`, 0xFFB347);
        return false;
    }

    const jugadores = room.getPlayerList().filter(p => p.id !== 0 && !jugadoresAFK.has(p.id));
    if (jugadores.length < 3) {
        enviarMensajePrivado(player.id, "❌ sᴇ ɴᴇᴄᴇsɪᴛᴀɴ ᴀʟ ᴍᴇɴᴏs 3 ᴊᴜɢᴀᴅᴏʀᴇs ᴘᴀʀᴀ ᴇʟ sᴏʀᴛᴇᴏ", 0xFF6961);
        return false;
    }

    enviarMensajeGlobal(`🎉 sᴏʀᴛᴇᴏ sᴏʀᴛᴇᴏ!!! @${player.name} ɪɴɪᴄɪᴏ́ ᴜɴ sᴏʀᴛᴇᴏ. ᴇʟ ɢᴀɴᴀᴅᴏʀ sᴇ ᴀɴᴜɴᴄɪᴀʀᴀ́ ᴇɴ 5 sᴇɢᴜɴᴅᴏs...`, getRandomColor());

    setTimeout(() => {
        const ganador = jugadores[Math.floor(Math.random() * jugadores.length)];
        const wins = 3;

        if (roleSystem.addWin(ganador.id, wins)) {
            enviarMensajeGlobal(
                `🏆 ɢᴀɴᴀᴅᴏʀ: ${ganador.name} (+${wins} ᴡɪɴs)\n` +
                `🎉 ¡ꜰᴇʟɪᴄɪᴅᴀᴅᴇs! ᴀʜᴏʀᴀ ᴛɪᴇɴᴇs ${playerStats[ganador.id].wins} ᴠɪᴄᴛᴏʀɪᴀs`,
                getRandomColor()
            );
        }
    }, 5000);

    comandos.setCooldown(player.id, "!azar");
    return false;
},

"!anonimo": (player, mensaje) => {
    if (comandos.checkCooldown(player.id, "anonimo")) {
        const segundos = comandos.getCooldownTime(player.id, "anonimo");
        enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴇɴᴠɪᴀʀ ᴏᴛʀᴏ ᴍᴇɴsᴀᴊᴇ ᴀɴᴏ́ɴɪᴍᴏ`, 0xFFB347);
        return false;
    }

    if (!mensaje) {
        enviarMensajePrivado(player.id, "❌ ᴜsᴏ: !ᴀɴᴏɴɪᴍᴏ [ᴍᴇɴsᴀᴊᴇ]", 0xFF6961);
        return false;
    }

    enviarMensajeGlobal(`🤫 ᴀɴᴏ́ɴɪᴍᴏ: ${mensaje}`, getRandomColor());

    comandos.setCooldown(player.id, "anonimo");
    return false;
},

"!his": (player) => {
    if (comandos.checkCooldown(player.id, "!his")) {
        const segundos = comandos.getCooldownTime(player.id, "!his");
        enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴏᴛʀᴀ ʜɪsᴛᴏʀɪᴀ`, 0xFFB347);
        return false;
    }

    const jugadores = room.getPlayerList()
        .filter(p => p.id !== 0 && !jugadoresAFK.has(p.id))
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

    if (jugadores.length < 3) {
        enviarMensajePrivado(player.id, "❌ sᴇ ɴᴇᴄᴇsɪᴛᴀɴ ᴀʟ ᴍᴇɴᴏs 3 ᴊᴜɢᴀᴅᴏʀᴇs ᴘᴀʀᴀ ᴜɴᴀ ʜɪsᴛᴏʀɪᴀ", 0xFF6961);
        return false;
    }

    let historia = getRandomPhrase(historiasCringe);
    historia = historia.replace("{jugador1}", jugadores[0].name)
                      .replace("{jugador2}", jugadores[1].name)
                      .replace("{jugador3}", jugadores[2].name);

    enviarMensajeGlobal(`📖 ʜɪsᴛᴏʀɪᴀ ᴇ́ᴘɪᴄᴀ:\n${historia}`, getRandomColor());

    comandos.setCooldown(player.id, "!his");
    return false;
},

"!fight": (player, args) => {
    if (comandos.checkCooldown(player.id, "!fight")) {
        const segundos = comandos.getCooldownTime(player.id, "!fight");
        enviarMensajePrivado(player.id, `⏳ ᴇsᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴏᴛʀᴀ ʙᴀᴛᴀʟʟᴀ`, 0xFFB347);
        return false;
    }

    const nombres = args.split(/ (.+)/);
    let jugadoresBatalla = [];

    jugadoresBatalla.push(player);

    if (nombres[0]) {
        const jugador1 = encontrarJugadorPorNombre(nombres[0]);
        if (jugador1) jugadoresBatalla.push(jugador1);
    }

    if (nombres[1]) {
        const jugador2 = encontrarJugadorPorNombre(nombres[1]);
        if (jugador2) jugadoresBatalla.push(jugador2);
    }

    if (jugadoresBatalla.length > 3) {
        enviarMensajePrivado(player.id, "❌ ᴍᴀ́xɪᴍᴏ 2 ᴊᴜɢᴀᴅᴏʀᴇs ᴍᴇɴᴄɪᴏɴᴀᴅᴏs (3 ᴄᴏɴ ᴛᴜ́)", 0xFF6961);
        return false;
    }

    const todosJugadores = room.getPlayerList()
        .filter(p => p.id !== 0 && !jugadoresAFK.has(p.id) && !jugadoresBatalla.some(j => j.id === p.id))
        .sort(() => 0.5 - Math.random());

    while (jugadoresBatalla.length < 3 && todosJugadores.length > 0) {
        jugadoresBatalla.push(todosJugadores.pop());
    }

    if (jugadoresBatalla.length < 2) {
        enviarMensajePrivado(player.id, "❌ sᴇ ɴᴇᴄᴇsɪᴛᴀɴ ᴀʟ ᴍᴇɴᴏs 2 ᴊᴜɢᴀᴅᴏʀᴇs ᴘᴀʀᴀ ᴜɴᴀ ʙᴀᴛᴀʟʟᴀ", 0xFF6961);
        return false;
    }

    const ganador = jugadoresBatalla[Math.floor(Math.random() * jugadoresBatalla.length)];
    let batalla = getRandomPhrase(batallas);

    batalla = batalla.replace("{jugador1}", jugadoresBatalla[0].name)
                     .replace("{jugador2}", jugadoresBatalla[1].name)
                     .replace("{ganador}", ganador.name);

    if (jugadoresBatalla[2]) {
        batalla = batalla.replace("{jugador3}", jugadoresBatalla[2].name);
    }

    enviarMensajeGlobal(`⚔️ ʙᴀᴛᴀʟʟᴀ ᴇᴘɪᴄᴀ!\n${batalla}`, getRandomColor());

    comandos.setCooldown(player.id, "!fight");
    return false;
},

"!topgoles": (player) => {
    const top = Object.entries(playerStats)
        .sort((a, b) => (b[1].goals || 0) - (a[1].goals || 0))
        .slice(0, 10)
        .map(([id, stats], i) => 
            `${i+1}. ${stats.lastKnownName || "ᴊᴜɢᴀᴅᴏʀ"}: ${stats.goals || 0}ɢ`);

    enviarMensajeGlobal("🏆 ᴛᴏᴘ 10 ɢᴏʟᴇᴀᴅᴏʀᴇs: " + top.join(" • "), getRandomColor());
    return false;
},

"!topasistencias": (player) => {
    const top = Object.entries(playerStats)
        .sort((a, b) => (b[1].assists || 0) - (a[1].assists || 0))
        .slice(0, 10)
        .map(([id, stats], i) => 
            `${i+1}. ${stats.lastKnownName || "ᴊᴜɢᴀᴅᴏʀ"}: ${stats.assists || 0}ᴀ`);

    enviarMensajeGlobal("🎯 ᴛᴏᴘ 10 ᴀsɪsᴛᴇɴᴄɪᴀs: " + top.join(" • "), getRandomColor());
    return false;
},

"!topcs": (player) => {
    const top = Object.entries(playerStats)
        .sort((a, b) => (b[1].cs || 0) - (a[1].cs || 0))
        .slice(0, 10)
        .map(([id, stats], i) => 
            `${i+1}. ${stats.lastKnownName || "ᴊᴜɢᴀᴅᴏʀ"}: ${stats.cs || 0}ᴄs`);

    enviarMensajeGlobal("🧤 ᴛᴏᴘ 10 ᴄʟᴇᴀɴ sʜᴇᴇᴛs: " + top.join(" • "), getRandomColor());
    return false;
},

"!votekick": (player, targetName) => {
    if (!targetName) {
        enviarMensajePrivado(player.id, "❌ ᴜsᴏ: !ᴠᴏᴛᴇᴋɪᴄᴋ @ᴊᴜɢᴀᴅᴏʀ", 0xFF5555);
        return false;
    }

    // Verificar si ya hay votación en curso
    if (votacionKick) {
        enviarMensajePrivado(player.id, "❌ ʏᴀ ʜᴀʏ ᴜɴᴀ ᴠᴏᴛᴀᴄɪᴏ́ɴ ᴅᴇ ᴋɪᴄᴋ ᴇɴ ᴄᴜʀsᴏ", 0xFF5555);
        return false;
    }

    const target = encontrarJugadorPorNombre(targetName);
    if (!target) {
        enviarMensajePrivado(player.id, "❌ ᴊᴜɢᴀᴅᴏʀ ɴᴏ ᴇɴᴄᴏɴᴛʀᴀᴅᴏ", 0xFF5555);
        return false;
    }

    if (target.id === player.id) {
        enviarMensajePrivado(player.id, "❌ ɴᴏ ᴘᴜᴇᴅᴇs ᴠᴏᴛᴀʀ ᴘᴏʀ ᴛɪ ᴍɪsᴍᴏ", 0xFF5555);
        return false;
    }

    // Inicializar votación
    const jugadoresTotales = room.getPlayerList().filter(p => p.id !== 0).length;
    const votosNecesarios = Math.ceil(jugadoresTotales * 0.6); // 60%

    votacionKick = {
        objetivo: target.id,
        objetivoNombre: target.name,
        iniciador: player.id,
        votos: new Set([player.id]), // El iniciador ya vota
        votosNecesarios: votosNecesarios,
        tiempoInicio: Date.now()
    };

    enviarMensajeGlobal(
        `🗳️ **ᴠᴏᴛᴀᴄɪᴏ́ɴ ᴅᴇ ᴇxᴘᴜʟsɪᴏ́ɴ**\n` +
        `🎯 ᴏʙᴊᴇᴛɪᴠᴏ: @${target.name}\n` +
        `👤 ɪɴɪᴄɪᴀᴅᴏ ᴘᴏʀ: @${player.name}\n` +
        `📊 ᴠᴏᴛᴏs ɴᴇᴄᴇsᴀʀɪᴏs: ${votosNecesarios}/${jugadoresTotales} (60%)\n` +
        `⏰ ᴅᴜʀᴀᴄɪᴏ́ɴ: 30 sᴇɢᴜɴᴅᴏs\n` +
        `✅ ᴠᴏᴛᴀ ᴄᴏɴ: !sɪᴋɪᴄᴋ\n` +
        `❌ ᴏ ᴠᴏᴛᴀ ᴄᴏɴ: !ɴᴏᴋɪᴄᴋ`,
        getRandomColor()
    );

    // Timer de la votación
    votacionKickTimeout = setTimeout(() => {
        if (votacionKick) {
            const votosActuales = votacionKick.votos.size;
            if (votosActuales >= votacionKick.votosNecesarios) {
                // Kickear al jugador
                room.kickPlayer(votacionKick.objetivo, "ᴇxᴘᴜʟsᴀᴅᴏ ᴘᴏʀ ᴠᴏᴛᴀᴄɪᴏ́ɴ ᴅᴇ ʟᴀ ᴄᴏᴍᴜɴɪᴅᴀᴅ", false);
                enviarMensajeGlobal(
                    `🚫 @${votacionKick.objetivoNombre} ꜰᴜᴇ ᴇxᴘᴜʟsᴀᴅᴏ ᴘᴏʀ ᴠᴏᴛᴀᴄɪᴏ́ɴ\n` +
                    `📊 ᴠᴏᴛᴏs: ${votosActuales}/${votacionKick.votosNecesarios}`,
                    0xFF5555
                );
            } else {
                enviarMensajeGlobal(
                    `❌ ᴠᴏᴛᴀᴄɪᴏ́ɴ ꜰᴀʟʟɪᴅᴀ: @${votacionKick.objetivoNombre} ɴᴏ ꜰᴜᴇ ᴇxᴘᴜʟsᴀᴅᴏ\n` +
                    `📊 ᴠᴏᴛᴏs: ${votosActuales}/${votacionKick.votosNecesarios}`,
                    0xFFB74D
                );
            }
            votacionKick = null;
        }
    }, 30000);

    return false;
},

"!sikick": (player) => {
    if (!votacionKick) {
        enviarMensajePrivado(player.id, "❌ ɴᴏ ʜᴀʏ ᴠᴏᴛᴀᴄɪᴏ́ɴ ᴅᴇ ᴋɪᴄᴋ ᴀᴄᴛɪᴠᴀ", 0xFF5555);
        return false;
    }

    if (votacionKick.votos.has(player.id)) {
        enviarMensajePrivado(player.id, "❌ ʏᴀ ᴠᴏᴛᴀsᴛᴇ ᴇɴ ᴇsᴛᴀ ᴠᴏᴛᴀᴄɪᴏ́ɴ", 0xFF5555);
        return false;
    }

    votacionKick.votos.add(player.id);
    const votosActuales = votacionKick.votos.size;

    enviarMensajeGlobal(
        `✅ @${player.name} ᴠᴏᴛᴏ́ ᴘᴏʀ ᴇxᴘᴜʟsᴀʀ ᴀ @${votacionKick.objetivoNombre}\n` +
        `📊 ᴠᴏᴛᴏs: ${votosActuales}/${votacionKick.votosNecesarios}`,
        getRandomColor()
    );

    return false;
},

"!nokick": (player) => {
    if (!votacionKick) {
        enviarMensajePrivado(player.id, "❌ ɴᴏ ʜᴀʏ ᴠᴏᴛᴀᴄɪᴏ́ɴ ᴅᴇ ᴋɪᴄᴋ ᴀᴄᴛɪᴠᴀ", 0xFF5555);
        return false;
    }

    if (votacionKick.votos.has(player.id)) {
        enviarMensajePrivado(player.id, "❌ ʏᴀ ᴠᴏᴛᴀsᴛᴇ ᴇɴ ᴇsᴛᴀ ᴠᴏᴛᴀᴄɪᴏ́ɴ", 0xFF5555);
        return false;
    }

    // En votación de kick, el voto "no" no se cuenta, solo se ignora
    enviarMensajeGlobal(
        `❌ @${player.name} ᴠᴏᴛᴏ́ ᴇɴ ᴄᴏɴᴛʀᴀ ᴅᴇ ʟᴀ ᴇxᴘᴜʟsɪᴏ́ɴ`,
        getRandomColor()
    );

    return false;
}

};


// ======================
// EVENTOS DE SALA
// ======================
room.onPlayerLeave = function(player) {
   
     if (sistemaPick.activo && 
        (player.id === sistemaPick.capitanRed?.id || player.id === sistemaPick.capitanBlue?.id)) {
        sistemaPick.activo = false;
        sistemaPick.fase = 'inactivo';
        clearTimeout(sistemaPick.timeoutPick);
        enviarMensajeGlobal("❌ Pick cancelado", 0xFF5555);

  }
    
    setTimeout(() => verificarYActivarPick(), 1000);
      setTimeout(sistemaSecundario, 500);
};



room.onTeamGoal = function(team) {
 
  const jugadores = room.getPlayerList().filter(p => p.team === team && p.id !== 0);
    if (jugadores.length > 0) {
        // El último jugador del equipo que tocó el balón antes del gol
        const anotador = ultimoTocador && ultimoTocador.team === team ? ultimoTocador : jugadores[0];
        manejarGol(anotador);
    }
 
    if (!matchStartTime) return;
  const scores = room.getScores();
  addMatchEvent("GOL", `Equipo ${team === 1 ? "ROJO" : "AZUL"} - ${scores.red}-${scores.blue}`);


};



// Función mejorada de notificación
// Reemplaza todas las instancias de room.getRoomName() con:
function getRoomName() {
  // Método 1: Para headless browser
  if (typeof room.getRoomName === 'function') {
      return room.getRoomName();
  }
  // Método 2: Para versión actual
  return room._roomInfo?.name || "🔝 | 𝐒𝐭𝐮𝐩𝐢𝐝 𝐍𝐢𝐠𝐠𝐚 𝐁𝐫𝐚𝐢𝐧 𝐱𝟒 | 🔝";
}

// Función notifyRoomOpened corregida:
async function notifyRoomOpened() {
  try {
      const players = room.getPlayerList().filter(p => p.id !== 0);

      const embed = {
          title: `🔓 ${getRoomName()} SE PRENDIOOO`,  // Usar la nueva función
          description: "¡Únete ahora!",
          color: 0x00FF00,
          fields: [
              { name: "🔝", value : "Sala hecha y creada con fines educativos, eticos y 100% parchables"},
              { name: "Jugadores", value: `${players.length} conectados` },
              { name: "Creado por", value: `iamjsae` }
          ],
          timestamp: new Date().toISOString()
      };

      await sendToDiscord(DISCORD_WEBHOOK_URL, "@here¡Sala abierta!", embed);
  } catch (err) {
      console.error("Error enviando notificación:", err);
  }
}





 
  // 2. Esperar 10 segundos antes de notificar (para evitar notificaciones duplicadas)
  setTimeout(() => {
      if (!notificationSent) {
          notifyRoomOpened();
          notificationSent = true;

          // Mensaje en la sala
          enviarMensajeGlobal(
    "🔔 ɴᴏᴛɪꜰɪᴄᴀᴄɪóɴ ᴇɴᴠɪᴀᴅᴀ ᴀ ᴅɪꜱᴄᴏʀᴅ\n" +
    "📢 ¡ʟᴀ ꜱᴀʟᴀ ᴇꜱᴛá ᴀʙɪᴇʀᴛᴀ ᴀʟ ᴘúʙʟɪᴄᴏ!",
    0x00FF00
);
      }
  }, 10000); // 10 segundos de delay

  // 3. Inicializar contador
  cargarContador().then(() => {
      console.log("✅ Contador inicializado");
  }).catch(console.error);


  // Inicializar contador
  cargarContador().then(() => {
      console.log("✅ Contador inicializado correctamente");
      enviarMensajeGlobal(
          `🔢 Contador global inicializado\n` +
          `📌 Número actual: ${contador}\n` +
          `👉 Siguiente número: ${siguienteNumero}`,
          0x2196F3
      );
  }).catch(error => {
      console.error("Error al inicializar contador:", error);
  })

room.onPlayerBallKick = function(player) {
if (!matchStartTime) return;
  addMatchEvent("PATADA", `${player.name} (${player.id})`);
};


room.onGameStop = function(byPlayer) {
   
    const now = Date.now();
    if (now - lastGameStop < 1000) return;
    lastGameStop = now;

    if (!matchStartTime) return;

  const duration = Date.now() - matchStartTime;
  const scores = room.getScores() || { red: 0, blue: 0 };

  // Crear reporte
  const report = {
      title: `📊 ${getRoomName()} - Resultado final`,
      description: `🔴 ${scores.red} - ${scores.blue} 🔵`,
      color: 0x7289DA,
      fields: [
          {
              name: "Duración",
              value: `${Math.floor(duration/60000)}m ${Math.floor((duration%60000)/1000)}s`,
              inline: true
          }
         
      ]
  };

  // Enviar a Discord
  sendToDiscord(DISCORD_WEBHOOK_URL, null, report)
      .then(() => {
          console.log("Reporte enviado");
          matchStartTime = null;
      })
      .catch(err => {
          console.error("Error enviando reporte:", err);
      });

  // Resetear
  matchStartTime = null;

 

  
  matchStartTimestamp = null;


  



};

 


room.onPlayerJoin = function(player) {

 setTimeout(() => verificarYActivarPick(), 1000);

   if (!playerStats[player.id]) {
    playerStats[player.id] = initPlayerStats();
  }
  playerStats[player.id].lastKnownName = player.name;
  guardarEstadisticas();

  setTimeout(sistemaSecundario, 500);

  if (!playerStats[player.id]) {
      playerStats[player.id] = { 
          wins: 0, 
          losses: 0,
          lastKnownName: player.name  // <-- Añadir esto
      };
  } else {
      playerStats[player.id].lastKnownName = player.name;  // <-- Actualizar nombre
  };


  if (!player.joinOrder) {
      player.joinOrder = Date.now();
  };

// Solo para admins
room.getPlayerList().forEach(p => {
  if (p.admin) {
      room.sendAnnouncement(
          `🔍 Nuevo jugador: ${player.name} | IP: ${player.ip}`,
          p.id, 0x888888
      );
  }
});


  // Inicializar estadísticas si no existen
  if (!playerStats[player.id]) {
      playerStats[player.id] = { 
          wins: 0, 
          losses: 0,
          goals: 0,
          assists: 0,
          lastJoin: Date.now()
      };
  }

  // Mensaje de bienvenida
  enviarMensajeGlobal(`👋 ${player.name} ʜᴀ ᴇɴᴛʀᴀᴅᴏ ᴀʟ ꜱᴇʀᴠɪᴅᴏʀ`, 0x00AAFF);

  // Mensajes privados
enviarMensajePrivado(player.id, `✨ ʙɪᴇɴᴠᴇɴɪᴅᴏ ${player.name} ᴀ ʟᴀ ꜱᴀʟᴀ!`, 0xFFD54F);
enviarMensajePrivado(player.id, `📝 ᴜꜱᴀ !comandos ᴘᴀʀᴀ ᴠᴇʀ ʟᴏ ǫᴜᴇ ᴘᴜᴇᴅᴇꜱ ʜᴀᴄᴇʀ`, 0xFFD54F);

  // Actualizar sistema de roles
  if (roleSystem && roleSystem.updatePlayerNameWithRole) {
      roleSystem.updatePlayerNameWithRole(player);
  }

  // Guardar estadísticas
  if (guardarEstadisticas) {
      guardarEstadisticas();
  }
};

room.onGameStart = function() {
   
aplicarUniformesAleatorios();

     const now = Date.now();
  if (now - (state.lastMatchEnd || 0) < 1000) return;
  state.matchInProgress = true;
  
  // Limpiar estados de jugadores
  const players = room.getPlayerList();
  players.forEach(player => {
    if (player.team !== 0) {
      playerStats[player.id] = playerStats[player.id] || initPlayerStats();
    }
  });
  
  // Iniciar sistemas
  iniciarApuestas();
  matchStartTime = Date.now();
};


 
const now = Date.now();

if (now - lastGameStart >= 1000) {
    lastGameStart = now;
   
    // Obtener jugadores por equipo
    const players = room.getPlayerList();
    const redTeam = players.filter(p => p.team === 1);
    const blueTeam = players.filter(p => p.team === 2);

    // Mostrar formaciones
enviarMensajeGlobal(
    "⚽ ꜰᴏʀᴍᴀᴄɪᴏɴᴇꜱ ɪɴɪᴄɪᴀʟᴇꜱ ⚽\n" +
    "━━━━━━━━━━━━━━━━━━━━━━━━\n" +
    `🔴 ᴇǫᴜɪᴘᴏ ʀᴏᴊᴏ (${redTeam.length} ᴊᴜɢᴀᴅᴏʀᴇꜱ):\n` +
    redTeam.map(p => `• ${p.name}`).join('\n') + "\n" +
    "━━━━━━━━━━━━━━━━━━━━━━━━\n" +
    `🔵 ᴇǫᴜɪᴘᴏ ᴀᴢᴜʟ (${blueTeam.length} ᴊᴜɢᴀᴅᴏʀᴇꜱ):\n` +
    blueTeam.map(p => `• ${p.name}`).join('\n'),
    0xFFFFFF
);

    // Iniciar apuestas automáticamente
    iniciarApuestas();

  
};

// Función onPlayerTeamChange corregida
room.onPlayerTeamChange = function(changedPlayer, byPlayer) {
    
 // Verificar balanceo después de cambios de equipo
    setTimeout(() => {
        verificarYActivarPick();
    }, 2000);

  setTimeout(sistemaSecundario, 500);

  if (changedPlayer.id === 0) {
      room.setPlayerTeam(changedPlayer.id, 0);
    // Bot no puede ser movido
enviarMensajeGlobal("⚠️ ɴᴏ ᴘᴜᴇᴅᴇꜱ ᴍᴏᴠᴇʀ ᴀʟ ʙᴏᴛ ʜᴏꜱᴛ", 0xFF6D6D);

      return false;
  }

  if (jugadoresAFK.has(changedPlayer.id) && changedPlayer.team !== 0) {
      room.setPlayerTeam(changedPlayer.id, 0);
enviarMensajeGlobal(`🚫 ${changedPlayer.name} ᴇꜱᴛá AFK ʏ ɴᴏ ᴘᴜᴇᴅᴇ ꜱᴇʀ ᴍᴏᴠɪᴅᴏ`, 0xFF6D6D);
      return false;
  }

  // Actualizar listas de equipos
  updateTeams(); 

  return true;
  };
// Funciones auxiliares de mensajes (asegúrate de tenerlas implementadas)
function enviarMensajeGlobal(mensaje, color) {
  room.sendAnnouncement(mensaje, null, color, "bold", 1);
}

function enviarMensajePrivado(id, mensaje, color) {
  room.sendAnnouncement(mensaje, id, color, "bold", 1);
};

// Verificar balanceo periódicamente
setInterval(() => {
    verificarYActivarPick();
}, 10000);

// Modificar el manejador de chat para detectar números de pick
const originalOnPlayerChat = room.onPlayerChat;

room.onPlayerChat = function(player, message) {
    // 1. Registrar actividad del jugador
    registrarActividadChat(player);
    
    // 2. Sistema de pick primero (tiene prioridad)
    if (sistemaPick.activo && sistemaPick.fase === 'esperandoPick') {
        const numero = parseInt(message.trim());
        if (!isNaN(numero) && numero >= 1 && numero <= sistemaPick.jugadoresDisponibles.length) {
            const equipoActual = sistemaPick.ordenPick[sistemaPick.pickActual];
            const capitanActual = equipoActual === 'red' ? sistemaPick.capitanRed : sistemaPick.capitanBlue;
            
            // Verificar que el que escribe es el capitán actual
            if (player.id === capitanActual.id) {
                const jugadorElegido = sistemaPick.jugadoresDisponibles[numero - 1];
                realizarPickAutomatico(jugadorElegido.id, equipoActual);
                return false; // Bloquear mensaje del número
            }
        }
    }
    
    // 3. Verificar si está muteado (ANTES de procesar comandos)
    if (jugadoresMuteados.has(player.id)) {
        const tiempoRestante = Math.ceil((jugadoresMuteados.get(player.id) - Date.now()) / 60000);
        enviarMensajePrivado(player.id, `🔇 ᴇꜱᴛáꜱ ᴍᴜᴛᴇᴀᴅᴏ ᴘᴏʀ ${tiempoRestante} ᴍɪɴᴜᴛᴏ(ꜱ) ᴍáꜱ`, 0xFF5555);
        return false;
    }
    
    // 4. Verificar si es un comando (!)
    if (message.startsWith("!")) {
        const args = message.split(" ");
        const comando = args[0].toLowerCase();
        const arg = args.slice(1).join(" ");
        
        // Comandos especiales (!admin y !clave)
        if (comando === "!admin") {
            if (jugadoresVerificando.has(player.id)) {
                enviarMensajePrivado(player.id, "⌛ ʏᴀ ᴇꜱᴛáꜱ ᴇɴ ᴘʀᴏᴄᴇꜱᴏ ᴅᴇ ᴠᴇʀɪꜰɪᴄᴀᴄɪóɴ", 0xFFB74D);
                return false;
            }
            
            jugadoresVerificando.set(player.id, {
                timeout: null,
                intentos: 0
            });
            
            enviarMensajePrivado(player.id, "🔐 ꜱɪꜱᴛᴇᴍᴀ ᴅᴇ ᴠᴇʀɪꜰɪᴄᴀᴄɪóɴ", 0x4FC3F7);
            enviarMensajePrivado(player.id, "1. ᴜꜱᴀ: !clave TU_CONTRASEÑA", 0xEEEEEE);
            enviarMensajePrivado(player.id, "2. ᴇꜱᴘᴇʀᴀ 5 ꜱᴇɢᴜɴᴅᴏꜱ", 0xEEEEEE);
            enviarMensajePrivado(player.id, "3. ᴏʙᴛᴇɴᴅʀáꜱ ᴀᴅᴍɪɴ ᴀᴜᴛᴏᴍáᴛɪᴄᴏ", 0xEEEEEE);
            return false;
        }
        
        if (comando === "!clave") {
            if (!jugadoresVerificando.has(player.id)) {
                enviarMensajePrivado(player.id, "❌ ᴘʀɪᴍᴇʀᴏ ᴜꜱᴀ !admin ᴘᴀʀᴀ ɪɴɪᴄɪᴀʀ", 0xFF6D6D);
                return false;
            }
            
            const estado = jugadoresVerificando.get(player.id);
            estado.intentos++;
            
            if (estado.timeout) clearTimeout(estado.timeout);
            
            if (args[1] === CONTRASEÑA_ADMIN) {
                enviarMensajePrivado(player.id, "✅ ᴄᴏɴᴛʀᴀꜱᴇñᴀ ᴄᴏʀʀᴇᴄᴛᴀ. ᴇꜱᴘᴇʀᴀ 5 ꜱᴇɢᴜɴᴅᴏꜱ...", 0x81C784);
                estado.timeout = setTimeout(() => darAdmin(player.id), TIEMPO_ESPERA);
            } else {
                const mensajeError = `❌ ᴄᴏɴᴛʀᴀꜱᴇñᴀ ɪɴᴄᴏʀʀᴇᴄᴛᴀ (ɪɴᴛᴇɴᴛᴏ ${estado.intentos}/3)`;
                enviarMensajePrivado(player.id, mensajeError, 0xFF6D6D);
                
                if (estado.intentos >= 3) {
                    enviarMensajePrivado(player.id, "⚠️ ᴅᴇᴍᴀꜱɪᴀᴅᴏꜱ ɪɴᴛᴇɴᴛᴏꜱ. ᴜꜱᴀ !admin ɴᴜᴇᴠᴀᴍᴇɴᴛᴇ", 0xFFB74D);
                    jugadoresVerificando.delete(player.id);
                }
            }
            return false;
        }
        
        // Otros comandos - Asegúrate que commandHandlers esté definido
        if (typeof commandHandlers !== 'undefined' && commandHandlers[comando]) {
            if (comandos.adminOnly.has(comando) && !player.admin) {
                enviarMensajePrivado(player.id, "❌ ꜱᴏʟᴏ ᴀᴅᴍɪɴꜱ ᴘᴜᴇᴅᴇɴ ᴜꜱᴀʀ ᴇꜱᴛᴇ ᴄᴏᴍᴀɴᴅᴏ", 0xFF6D6D);
                return false;
            }
            
            if (comandos.checkCooldown(player.id, comando)) {
                const segundos = comandos.getCooldownTime(player.id, comando);
                enviarMensajePrivado(player.id, `⏳ ᴇꜱᴘᴇʀᴀ ${segundos}s ᴘᴀʀᴀ ᴜꜱᴀʀ ᴇꜱᴛᴇ ᴄᴏᴍᴀɴᴅᴏ`, 0xFFB74D);
                return false;
            }
            
            const resultado = commandHandlers[comando](player, arg);
            if (resultado !== false) {
                comandos.setCooldown(player.id, comando);
            }
            return false; // IMPORTANTE: Prevenir que el comando aparezca
        } else {
            enviarMensajePrivado(player.id, "❌ ᴄᴏᴍᴀɴᴅᴏ ɴᴏ ʀᴇᴄᴏɴᴏᴄɪᴅᴏ. ᴜꜱᴀ !comandos", 0xFF6D6D);
            return false;
        }
    }
    
    // 5. Manejo de chat de equipo (t )
    if (message.toLowerCase().startsWith("t ")) {
        const mensajeEquipo = message.substring(2).trim();
        if (!mensajeEquipo) return false;
        
        let configEquipo;
        switch(player.team) {
            case 1: configEquipo = { color: 0xFF5555, prefix: "🔴 " }; break;
            case 2: configEquipo = { color: 0x5555FF, prefix: "🔵 " }; break;
            default: configEquipo = { color: 0xAAAAAA, prefix: "👀 " };
        }
        
        const compañeros = room.getPlayerList().filter(p => p.team === player.team);
        compañeros.forEach(compañero => {
            const prefijo = compañero.id === player.id 
                ? `${configEquipo.prefix}Tú` 
                : `${configEquipo.prefix}${player.name}`;
            
            room.sendAnnouncement(
                `${prefijo}: ${mensajeEquipo}`,
                compañero.id, 
                configEquipo.color, 
                "normal"
            );
        });
        return false;
    }
    
    // 6. Mensaje normal del chat - con rol y color
    const stats = playerStats[player.id] || { wins: 0, losses: 0 };
    const roleColor = roleSystem.getRoleColor(stats.wins);
    const roleTag = roleSystem.getRoleTag(stats.wins);
    const afkTag = jugadoresAFK.has(player.id) ? " 💤" : "";
    
    room.sendAnnouncement(
        `${roleTag} ${player.name}${afkTag}: ${message}`,
        null, roleColor, "normal"
    );
    return false;
};

// Verificar balanceo periódicamente
setInterval(() => {
    verificarYActivarPick();
}, 10000); // Cada 10 segundos

// Verificar cuando alguien cambia de equipo
room.onPlayerTeamChange = function(player) {
      setTimeout(() => verificarYActivarPick(), 1000);
   

};

room.onTeamVictory = function(scores) {
  
  try {
    state.matchInProgress = false;
    state.lastMatchEnd = Date.now();
    
    // Limpiar estados de jugadores
    const players = room.getPlayerList();
    players.forEach(player => {
      if (player.team !== 0) {
        if ((scores.red > scores.blue && player.team === 1) || 
            (scores.blue > scores.red && player.team === 2)) {
          roleSystem.addWin(player.id);
        } else if (scores.red !== scores.blue) {
          roleSystem.addLoss(player.id);
        }
      }
    });
    
    // Resetear estadísticas de partido
    lastTouchPlayerId = null;
    lastKickTime = 0;
    matchEvents = [];
    matchLogs = [];
    
    // Guardar cambios
    guardarEstadisticas();
    
  } catch (error) {
    console.error("Error en onTeamVictory:", error);
    checkRoomState();
  }

  try {
      if (!scores) scores = { red: 0, blue: 0 };
      
      // Registrar goles y asistencias primero
      const players = room.getPlayerList();
      const winningTeam = scores.red > scores.blue ? 1 : 2;
      
      players.forEach(player => {
          if (!playerStats[player.id]) {
              playerStats[player.id] = initPlayerStats();
          }
          
          if (player.team === winningTeam) {
              playerStats[player.id].wins++;
              // Verificar clean sheet
              if ((winningTeam === 1 && scores.blue === 0) || 
                  (winningTeam === 2 && scores.red === 0)) {
                  playerStats[player.id].cs++;
              }
          } else if (player.team !== 0) {
              playerStats[player.id].losses++;
          }
      });

      // Guardar inmediatamente
      guardarEstadisticas().catch(e => console.error("Error guardando stats:", e));
      
   
      
  } catch (error) {
      console.error("Error en onTeamVictory:", error);
  }
  
    if (!scores) scores = { red: 0, blue: 0 };

  const players = room.getPlayerList();
  const redPlayers = players.filter(p => p.team === 1);
  const bluePlayers = players.filter(p => p.team === 2);

  // Determinar ganadores y perdedores
  const ganador = scores.red > scores.blue ? "RED" : 
                 scores.blue > scores.red ? "BLUE" : "EMPATE";
  const colorGanador = ganador === "RED" ? 0xFF8A80 : 
                      ganador === "BLUE" ? 0x90CAF9 : 0xE0E0E0;

  // Mensaje de resultado del partido
 // Mensaje final del partido
enviarMensajeGlobal("════════════════════════", 0x80DEEA);
enviarMensajeGlobal("       🏆 ꜰɪɴᴀʟ 🏆", 0xEEEEEE);
enviarMensajeGlobal(`🔴 RED ${scores.red} - ${scores.blue} AZUL 🔵`, colorGanador);
enviarMensajeGlobal(`🎰 ɢᴀɴᴀᴅᴏʀ: ${ganador}`, colorGanador);
enviarMensajeGlobal(`🔴 ᴀᴘᴏꜱᴛᴀʀᴏɴ ᴘᴏʀ RED: ${apuestas.red.size} | 🔵 ᴘᴏʀ BLUE: ${apuestas.blue.size}`, 0xFFF59D);

  // Mostrar ganadores de apuestas si hubo
  if (ganador !== "EMPATE" && (apuestas.red.size > 0 || apuestas.blue.size > 0)) {
      const ganadoresApuestas = ganador === "RED" ? apuestas.red : apuestas.blue;
      const perdedoresApuestas = ganador === "RED" ? apuestas.blue : apuestas.red;

      if (ganadoresApuestas.size > 0) {
        let listaGanadores = "⭐ ɢᴀɴᴀᴅᴏʀᴇꜱ ᴅᴇ ᴀᴘᴜᴇꜱᴛᴀꜱ ⭐\n";
          ganadoresApuestas.forEach(id => {
              const player = room.getPlayer(id);
              if (player) listaGanadores += `🎉 ${player.name}\n`;
          });
          enviarMensajeGlobal(listaGanadores, colorGanador);
      }

      if (perdedoresApuestas.size > 0) {
         // Apuestas perdidas
enviarMensajeGlobal(`💸 ${perdedoresApuestas.size} ᴊᴜɢᴀᴅᴏʀᴇꜱ ᴘᴇʀᴅɪᴇʀᴏɴ ꜱᴜꜱ ᴀᴘᴜᴇꜱᴛᴀꜱ`, 0xFF6D6D);

      }
  }

  enviarMensajeGlobal("════════════════════════", 0x80DEEA);

  // Actualizar estadísticas de los jugadores
  players.forEach(player => {
      if (player.team !== 0) {
          if ((ganador === "RED" && player.team === 1) || 
              (ganador === "BLUE" && player.team === 2)) {
              roleSystem.addWin(player.id);
          } else if (ganador !== "EMPATE") {
              roleSystem.addLoss(player.id);
          }
      }
  });

  // Limpiar jugadores en partida
  playersInGame.clear();

  // Reiniciar apuestas
  apuestas = {
      red: new Set(),
      blue: new Set(),
      votacionAbierta: false,
      tiempoInicio: null
  };

  // Balancear equipos automáticamente
  const perdedores = ganador === "RED" ? bluePlayers : redPlayers;
  perdedores.forEach(p => {
      if (p.team !== 0) room.setPlayerTeam(p.id, 0);
  });

  const ganadores = ganador === "RED" ? redPlayers : bluePlayers;
  ganadores.forEach(p => {
      if (p.team !== 1) room.setPlayerTeam(p.id, 1);
  });

  balancearEquipos();
};

let lastTouchPlayerId = null;
let lastKickTime = 0;

room.onPlayerBallKick = function(player) {
  
  playerLastActivity.set(player.id, Date.now());

    lastTouchPlayerId = player.id;
  lastKickTime = Date.now();

      // Actualizar trackers de toques
    penultimoTocador = ultimoTocador;
    ultimoTocador = player;

};

room.onTeamGoal = function(team) {
  const now = Date.now();
  
  // Detectar goleador (último toque en los últimos 3 segundos)
  if (lastTouchPlayerId && now - lastKickTime < 3000) {
    playerStats[lastTouchPlayerId] = playerStats[lastTouchPlayerId] || initPlayerStats();
    playerStats[lastTouchPlayerId].goals++;
    
    // Detectar asistencia (penúltimo jugador en tocar)
    const kickEvents = matchEvents.filter(e => e.type === "PATADA" && Date.now() - e.time < 5000);
    if (kickEvents.length >= 2) {
      const assisterId = kickEvents[kickEvents.length-2].playerId;
      if (assisterId && assisterId !== lastTouchPlayerId) {
        playerStats[assisterId] = playerStats[assisterId] || initPlayerStats();
        playerStats[assisterId].assists++;
      }
    }
  }
  
  guardarEstadisticas();
};

const connectionStatus = {};

room.onPlayerActivity = function(player) {
  
   playerLastActivity.set(player.id, Date.now());

    connectionStatus[player.id] = {
    lastActive: Date.now(),
    warnings: 0
  };
};

const AFK_SYSTEM = {
    // Tiempos en milisegundos
    TIMEOUT_SPECTATOR: 180000, // 3 minutos en espectador
    TIMEOUT_IN_GAME: 30000,    // 30 segundos en partida
    WARNING_TIME: 15000,       // 15 segundos para aviso
    
    // Estado de jugadores
    playerStates: new Map(), // { id: { lastActivity, team, warnings, status } }
    
    // Inicializar jugador
    initPlayer: function(playerId) {
        if (!this.playerStates.has(playerId)) {
            this.playerStates.set(playerId, {
                lastActivity: Date.now(),
                team: 0,
                warnings: 0,
                status: 'active',
                isAFK: false
            });
        }
    },
    
    // Actualizar actividad
    updateActivity: function(playerId) {
        const state = this.playerStates.get(playerId);
        if (state) {
            state.lastActivity = Date.now();
            state.warnings = 0;
            state.status = 'active';
            state.isAFK = false;
            
            // Si estaba marcado como AFK, quitarlo
            if (jugadoresAFK.has(playerId)) {
                jugadoresAFK.delete(playerId);
                const player = room.getPlayer(playerId);
                if (player) {
                    roleSystem.updatePlayerNameWithRole(player);
                    enviarMensajeGlobal(`✅ @${player.name} ya no está AFK`, 0x4CAF50);
                }
            }
        } else {
            this.initPlayer(playerId);
        }
    },
    
    // Verificar AFK de todos los jugadores
    checkAllPlayers: function() {
        const now = Date.now();
        const scores = room.getScores();
        const isGameInProgress = scores !== null;
        
        room.getPlayerList().forEach(player => {
            if (player.id === 0) return; // Ignorar host
            this.initPlayer(player.id);
            
            const state = this.playerStates.get(player.id);
            state.team = player.team;
            
            const inactiveTime = now - state.lastActivity;
            const isSpectator = player.team === 0;
            
            // Diferentes reglas según estado
            if (isSpectator) {
                // Espectador: 3 minutos sin actividad
                if (inactiveTime > this.TIMEOUT_SPECTATOR && !state.isAFK) {
                    this.markAsAFK(player);
                }
            } else if (isGameInProgress) {
                // En partida activa: 30 segundos sin actividad
                if (inactiveTime > this.TIMEOUT_IN_GAME && !state.isAFK) {
                    this.kickForAFK(player);
                } else if (inactiveTime > this.WARNING_TIME && state.warnings === 0) {
                    this.warnPlayer(player);
                }
            }
        });
    },
    
    // Marcar como AFK (solo espectadores)
    markAsAFK: function(player) {
        const state = this.playerStates.get(player.id);
        state.isAFK = true;
        state.status = 'afk';
        jugadoresAFK.add(player.id);
        
        roleSystem.updatePlayerNameWithRole(player);
        enviarMensajeGlobal(`💤 @${player.name} marcado como AFK (espectador)`, 0xFFB74D);
    },
    
    // Avisar al jugador
    warnPlayer: function(player) {
        const state = this.playerStates.get(player.id);
        state.warnings++;
        
        enviarMensajePrivado(
            player.id, 
            `⚠️ ¡Te estás quedando inactivo! Muévete o serás kickeado en 15 segundos.`,
            0xFFB74D
        );
        
        enviarMensajeGlobal(
            `⚠️ @${player.name} está inactivo en partida (aviso ${state.warnings} /2)`,
            0xFFB74D
        );
    },
    
    // Kickear por AFK en partida
    kickForAFK: function(player) {
        if (player.team === 0) return; // No kickear espectadores
        
        // Verificar si el jugador realmente está en partida
        const scores = room.getScores();
        if (scores === null) return; // No hay partida en curso
        
        room.kickPlayer(player.id, "AFK durante partida", false);
        
        enviarMensajeGlobal(
            `🚫 @${player.name} kickeado por AFK durante partida activa`,
            0xFF5555
        );
        
        // Remover del sistema
        this.playerStates.delete(player.id);
        jugadoresAFK.delete(player.id);
    },
    
    // Forzar estado AFK (comando !afk)
    toggleAFK: function(playerId) {
        const player = room.getPlayer(playerId);
        if (!player) return;
        
        if (jugadoresAFK.has(playerId)) {
            // Quitar AFK
            jugadoresAFK.delete(playerId);
            this.updateActivity(playerId);
            enviarMensajePrivado(playerId, "✅ Ya no estás AFK", 0x4CAF50);
        } else {
            // Poner AFK
            jugadoresAFK.add(playerId);
            if (player.team !== 0) {
                room.setPlayerTeam(playerId, 0);
            }
            
            const state = this.playerStates.get(playerId);
            if (state) {
                state.isAFK = true;
                state.status = 'manual-afk';
            }
            
            roleSystem.updatePlayerNameWithRole(player);
            enviarMensajePrivado(playerId, "💤 Ahora estás AFK (no te moverán de espectador)", 0xFFB74D);
        }
    }
};


room.onRoomLink = (link) => { console.log("LINK DE LA SALA:", link); };



// Configuración inicial
room.setDefaultStadium("Big");
room.setScoreLimit(3);
room.setTimeLimit(4);

// Frases automáticas cada 15 minutos
setInterval(() => {
  const frase = getRandomPhrase(frasesAleatorias);
  enviarMensajeGlobal(frase.texto, frase.color);
}, 900000);

// Función para dar admin
function darAdmin(playerId) {
  if (jugadoresVerificando.has(playerId)) {
      room.setPlayerAdmin(playerId, true);
enviarMensajePrivado(playerId, "✅ ᴀʜᴏʀᴀ ᴇʀᴇꜱ ᴀᴅᴍɪɴ!", 0x81C784);
      jugadoresVerificando.delete(playerId);
  }
}

const playerLastMovement = new Map();

setTimeout(() => {
    verificarYActivarPick();
}, 5000);

const spamCounters = new Map();

// Inicializar
setTimeout(sistemaSecundario, 2000);
