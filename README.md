🎮 Moctezuma Games
Plataforma educativa desarrollada con Next.js y Firebase Firestore 

Moctezuma Games es una aplicación web interactiva creada para transformar la capacitación corporativa en una experiencia dinámica, visual y divertida.
Desarrollada con Next.js y Firebase Firestore, esta plataforma gamificada permite a los colaboradores de Grupo Moctezuma aprender jugando, competir y medir su progreso en tiempo real.

⚙️ Stack Tecnológico

Next.js 14 (App Router) — Estructura modular, SSR/ISR y excelente rendimiento.

Firebase Firestore — Base de datos flexible, escalable y con consultas estructuradas.

Firebase Auth (opcional) — Permite sesiones autenticadas por correo.

Firebase Hosting — Despliegue ágil y seguro con CDN global.

CSS + JavaScript puro — Sin frameworks visuales: control total del diseño y animaciones.

Cada línea de código busca mantener la esencia del juego clásico, pero con la fluidez y elegancia del web moderno.

🧩 Arquitectura del Proyecto

Frontend (Next.js + JS Vanilla)

Cada minijuego vive como un módulo independiente en /app/games/[gameId].

Animaciones, timers y lógicas visuales escritas en JavaScript nativo.

Backend (Ãpp hosting cloud run)

Procesa puntuaciones, progreso, autenticación y ranking de jugadores.

Sin necesidad de servidor dedicado.

Base de datos (Firestore)

Estructurada en colecciones por jugador, juego y sesión.

Las puntuaciones se actualizan en tiempo real mediante snapshots de Firestore.

🚀 Cómo Iniciar

Instala las dependencias:

npm install


Inicia el servidor local:

npm run dev

Luego abre http://localhost:3000
 en tu navegador.
Puedes comenzar editando el archivo:

app/page.js

🔐 Configuración de Firebase

Crea un archivo .env.local en la raíz del proyecto:

NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...


Para entornos de desarrollo, Firestore puede operar con reglas de lectura y escritura abiertas:

{
  "rules": {
    "match": "/{document=**}" {
      "allow read, write: if true;"
    }
  }
}

🎨 Concepto y Filosofía

“El conocimiento no se impone, se conquista.”

Moctezuma Games nació bajo la visión de Lighthouse M4ch1n4, para Macako media group, buscando una forma de aprendizaje más humana, inmersiva y emocional.
Cada módulo está diseñado como un videojuego educativo que combina pedagogía corporativa con estética  gamin corporativo acorde al brandig del cliente.

🕹️ Módulos Actuales
Juego	Descripción	Estado
Seguridad en Planta	Trivia de reflejos y normas de seguridad industrial.	✅ Activo
Líder del Turno	Mini-RPG sobre liderazgo y toma de decisiones.	🧩 En desarrollo
Energía Verde	Simulación de eficiencia ambiental.	🚧 Prototipo

📦 Despliegue

Opción — Firebase Hosting


🧭 Roadmap

Integrar panel administrativo para métricas globales.

Sistema de niveles y recompensas por desempeño.


🧑‍💻 Créditos

Desarrollo y Dirección de arte:
RJMM / M4CH1N4 Labs
JTGM / El Faro studios
www.m4ch1n4.xyz
www.elfarostudios.mx

Cliente: Grupo Moctezuma
Inspiración: Aprender jugando. Competir creciendo.